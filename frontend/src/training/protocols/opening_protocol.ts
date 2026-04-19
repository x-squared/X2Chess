/**
 * opening_protocol — Opening repertoire trainer.
 *
 * Walks the game from the very first move. The user plays one side (or both);
 * the opponent's moves are chosen randomly from the available continuations in
 * the PGN tree (mainline + variations). When the current line has no further
 * moves the session ends and the user is shown the result screen where they
 * can start again.
 *
 * Integration API:
 * - `OPENING_PROTOCOL` — TrainingProtocol singleton; pass to `useTrainingSession`.
 *
 * Configuration API:
 * - `OpeningProtocolOptions` via `TrainingConfig.protocolOptions`.
 *
 * Communication API:
 * - Pure functions; no side effects.
 */

import { Chess } from "chess.js";
import type {
  TrainingProtocol,
  TrainingConfig,
  TrainingSessionState,
  UserMoveInput,
  MoveEvalResult,
  ResultSummary,
  ResultHighlight,
} from "../domain/training_protocol";
import type { TrainingTranscript } from "../domain/training_transcript";
import { parsePgnToModel } from "../../../../parts/pgnparser/src/pgn_model";

// ── Options ───────────────────────────────────────────────────────────────────

export type OpeningProtocolOptions = {
  /** Which side the user plays. */
  side: "white" | "black" | "both";
  /** Maximum number of moves to train (0 = no limit — play to end of line). */
  maxMoves: number;
};

const DEFAULT_OPTIONS: OpeningProtocolOptions = {
  side: "white",
  maxMoves: 0,
};

// ── Move-tree extraction ──────────────────────────────────────────────────────

/**
 * Build a map of FEN → list of available continuations (UCIs) from every
 * position reachable in the PGN tree, including all variations.
 */
const buildFenMap = (
  pgnText: string,
): { fenMap: Map<string, string[]>; startFen: string } => {
  const model = parsePgnToModel(pgnText);
  const fenMap = new Map<string, string[]>();

  const chess = new Chess();
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) {
    try { chess.load(fenHeader.value); } catch { /* ignore invalid FEN */ }
  }
  const startFen = chess.fen();

  const walk = (entries: typeof model.root.entries, walker: Chess): void => {
    for (const entry of entries) {
      if (entry.type !== "move") continue;

      const fenBefore = walker.fen();
      const result = walker.move(entry.san, { strict: false });
      if (!result) continue;

      const uci = result.from + result.to + (result.promotion ?? "");
      const existing = fenMap.get(fenBefore);
      if (existing) {
        if (!existing.includes(uci)) existing.push(uci);
      } else {
        fenMap.set(fenBefore, [uci]);
      }

      // Walk variations (RAVs) — each starts from fenBefore.
      if ("ravs" in entry && Array.isArray(entry.ravs)) {
        for (const rav of entry.ravs as { entries: typeof model.root.entries }[]) {
          const ravChess = new Chess();
          try { ravChess.load(fenBefore); } catch { continue; }
          walk(rav.entries, ravChess);
        }
      }
    }
  };

  walk(model.root.entries, chess);
  return { fenMap, startFen };
};

// ── Protocol state ────────────────────────────────────────────────────────────

type OpeningWalkState = {
  fenMap: Map<string, string[]>;
  side: "white" | "black" | "both";
  currentFen: string;
  currentPly: number;
  /** Total user plies is unknown until the line ends; updated when complete. */
  totalUserPlies: number;
  maxMoves: number;
  /** Move history (UCIs) so far in this run. */
  moveHistory: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True when it is the given side's turn in this FEN. */
const isUserTurn = (fen: string, side: "white" | "black" | "both"): boolean => {
  if (side === "both") return true;
  const sideToMove = fen.split(" ")[1];
  return (side === "white" && sideToMove === "w") ||
         (side === "black" && sideToMove === "b");
};

/** Pick a random element from an array. */
const pickRandom = <T>(arr: T[]): T | undefined =>
  arr.length === 0 ? undefined : arr[Math.floor(Math.random() * arr.length)];

/**
 * Starting from `fen`, auto-play all consecutive opponent moves (choosing
 * randomly from the available continuations) until a user-turn position or the
 * end of a known line. Returns the resulting FEN, ply count, and move history.
 */
const skipOpponentMoves = (
  startFen: string,
  startPly: number,
  startHistory: string[],
  side: "white" | "black" | "both",
  fenMap: Map<string, string[]>,
): { fen: string; ply: number; history: string[] } => {
  let fen = startFen;
  let ply = startPly;
  const history = [...startHistory];

  while (!isUserTurn(fen, side)) {
    const moves = fenMap.get(fen);
    if (!moves?.length) break;
    const uci = pickRandom(moves)!;
    const chess = new Chess();
    try { chess.load(fen); } catch { break; }
    const result = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!result) break;
    history.push(uci);
    fen = chess.fen();
    ply++;
  }

  return { fen, ply, history };
};

const gradeLabel = (pct: number): string => {
  if (pct >= 90) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Fair";
  return "Needs work";
};

// ── Protocol implementation ───────────────────────────────────────────────────

// Stores the last accepted user UCI between evaluateMove() and advance().
// Safe because the protocol is a singleton and both calls happen synchronously
// in the same event loop tick.
let _pendingUserUci: string | null = null;

const initialize = (config: TrainingConfig): TrainingSessionState => {
  const opts: OpeningProtocolOptions = {
    ...DEFAULT_OPTIONS,
    ...(config.protocolOptions as Partial<OpeningProtocolOptions>),
  };

  const { fenMap, startFen } = buildFenMap(config.pgnText);

  // Skip any leading opponent moves so the board shows the first user position.
  const { fen, ply, history } = skipOpponentMoves(
    startFen, 0, [], opts.side, fenMap,
  );

  const openingState: OpeningWalkState = {
    fenMap,
    side: opts.side,
    currentFen: fen,
    currentPly: ply,
    totalUserPlies: 0, // unknown until line ends
    maxMoves: opts.maxMoves,
    moveHistory: history,
  };

  return {
    phase: "in_progress",
    config,
    position: {
      fen,
      moveHistory: history,
      ply,
      totalUserPlies: 0,
    },
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    currentSourcePly: ply,
    hintUsedThisMove: false,
    hintsUsed: 0,
    startedAt: Date.now(),
    protocolState: openingState as unknown as Record<string, unknown>,
  };
};

const evaluateMove = (
  move: UserMoveInput,
  state: TrainingSessionState,
): MoveEvalResult => {
  const ps = state.protocolState as unknown as OpeningWalkState;
  const available = ps.fenMap.get(ps.currentFen);

  if (!available?.length) {
    return { accepted: false, feedback: "skip" };
  }

  if (available.includes(move.uci)) {
    _pendingUserUci = move.uci;
    return { accepted: true, feedback: "correct" };
  }

  // Apply any available move as the canonical answer for the hint.
  const correctUci = available[0]!;
  const chess = new Chess();
  let correctSan = correctUci;
  try {
    chess.load(ps.currentFen);
    const r = chess.move({ from: correctUci.slice(0, 2), to: correctUci.slice(2, 4), promotion: correctUci[4] });
    if (r) correctSan = r.san;
  } catch { /* ignore */ }

  return {
    accepted: false,
    feedback: "wrong",
    correctMove: { uci: correctUci, san: correctSan },
  };
};

const advance = (state: TrainingSessionState): TrainingSessionState => {
  const ps = state.protocolState as unknown as OpeningWalkState;

  // Retrieve the UCI stored by evaluateMove() and clear it.
  const userUci = _pendingUserUci;
  _pendingUserUci = null;

  // Compute FEN after user's move.
  let fenAfterUser = ps.currentFen;
  const chess = new Chess();
  if (userUci) {
    try {
      chess.load(ps.currentFen);
      chess.move({ from: userUci.slice(0, 2), to: userUci.slice(2, 4), promotion: userUci[4] });
      fenAfterUser = chess.fen();
    } catch { /* keep currentFen */ }
  }

  const historyAfterUser = [...ps.moveHistory, ...(userUci ? [userUci] : [])];
  const plyAfterUser = ps.currentPly + 1;

  // Auto-play opponent moves until the next user turn (or end of line).
  const { fen: nextFen, ply: nextPly, history: nextHistory } = skipOpponentMoves(
    fenAfterUser, plyAfterUser, historyAfterUser, ps.side, ps.fenMap,
  );

  const newPs: OpeningWalkState = {
    ...ps,
    currentFen: nextFen,
    currentPly: nextPly,
    moveHistory: nextHistory,
  };

  return {
    ...state,
    position: {
      fen: nextFen,
      moveHistory: nextHistory,
      ply: nextPly,
      totalUserPlies: state.position.totalUserPlies,
    },
    currentSourcePly: nextPly,
    hintUsedThisMove: false,
    protocolState: newPs as unknown as Record<string, unknown>,
  };
};

const isComplete = (state: TrainingSessionState): boolean => {
  const ps = state.protocolState as unknown as OpeningWalkState;
  const moves = ps.fenMap.get(ps.currentFen);
  const lineEnded = !moves?.length;
  const limitReached =
    ps.maxMoves > 0 &&
    state.correctCount + state.wrongCount + state.skippedCount >= ps.maxMoves;
  return lineEnded || limitReached;
};

const summarize = (
  state: TrainingSessionState,
  _transcript: TrainingTranscript,
): ResultSummary => {
  const total = state.correctCount + state.wrongCount + state.skippedCount;
  const scored = state.correctCount + state.wrongCount;
  const scorePercent = scored > 0 ? Math.round((state.correctCount / scored) * 100) : 0;
  const elapsedMs = Date.now() - state.startedAt;
  const avgTimeMsPerMove = total > 0 ? Math.round(elapsedMs / total) : undefined;
  const highlights: ResultHighlight[] = [];

  return {
    correct: state.correctCount,
    wrong: state.wrongCount,
    skipped: state.skippedCount,
    total,
    scorePercent,
    avgTimeMsPerMove,
    gradeLabel: gradeLabel(scorePercent),
    highlights,
  };
};

export const OPENING_PROTOCOL: TrainingProtocol = {
  id: "opening",
  label: "Opening Trainer",
  description: "Walk through the game from move 1. Opponent moves are chosen randomly from available variations.",
  initialize,
  evaluateMove,
  advance,
  isComplete,
  summarize,
};
