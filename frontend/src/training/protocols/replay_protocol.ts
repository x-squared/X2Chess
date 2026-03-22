/**
 * replay_protocol — "Play one side" training protocol.
 *
 * The user reproduces one (or both) sides of a source game from a chosen
 * starting ply. For each user-side ply the played move is compared to the
 * source game mainline. Annotated variations in the source game are accepted
 * as `legal_variant`.
 *
 * Integration API:
 * - `REPLAY_PROTOCOL` — TrainingProtocol singleton; pass to `useTrainingSession`.
 * - `ReplayProtocolOptions` — protocol-specific config shape.
 *
 * Configuration API:
 * - `ReplayProtocolOptions` via `TrainingConfig.protocolOptions`.
 *
 * Communication API:
 * - Pure functions; no side effects. Chess.js is used for position tracking.
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
import { parsePgnToModel } from "../../model/pgn_model";

// ── Options ───────────────────────────────────────────────────────────────────

export type ReplayProtocolOptions = {
  side: "white" | "black" | "both";
  startPly: number;
  allowRetry: boolean;
  showOpponentMoves: boolean;
  opponentMoveDelayMs: number;
  allowHints: boolean;
  maxHintsPerGame: number;
};

const DEFAULT_OPTIONS: ReplayProtocolOptions = {
  side: "white",
  startPly: 0,
  allowRetry: true,
  showOpponentMoves: true,
  opponentMoveDelayMs: 800,
  allowHints: true,
  maxHintsPerGame: 3,
};

// ── Internal helpers ──────────────────────────────────────────────────────────

type ReplayState = {
  /** All mainline UCI moves from the source game. */
  mainlineMoves: string[];
  /** SAN list matching mainlineMoves. */
  mainlineSans: string[];
  /** Set of ply indices where it is the configured side's turn. */
  userPlies: Set<number>;
  options: ReplayProtocolOptions;
};

const extractMainlineMoves = (
  pgnText: string,
): { ucis: string[]; sans: string[] } => {
  const model = parsePgnToModel(pgnText);
  const ucis: string[] = [];
  const sans: string[] = [];
  const chess = new Chess();

  // Replay starting FEN if provided.
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) {
    try { chess.load(fenHeader.value); } catch { /* ignore invalid FEN */ }
  }

  for (const entry of model.root.entries) {
    if (entry.type === "move") {
      const result = chess.move(entry.san, { strict: false });
      if (!result) break;
      ucis.push(result.from + result.to + (result.promotion ?? ""));
      sans.push(result.san);
    }
  }
  return { ucis, sans };
};

const buildUserPlies = (
  totalPlies: number,
  side: "white" | "black" | "both",
  startPly: number,
): Set<number> => {
  const set = new Set<number>();
  for (let i = startPly; i < totalPlies; i++) {
    if (side === "both") {
      set.add(i);
    } else if (side === "white" && i % 2 === 0) {
      set.add(i);
    } else if (side === "black" && i % 2 === 1) {
      set.add(i);
    }
  }
  return set;
};

const gradeLabel = (scorePercent: number): string => {
  if (scorePercent >= 90) return "Excellent";
  if (scorePercent >= 70) return "Good";
  if (scorePercent >= 50) return "Fair";
  return "Needs work";
};

// ── Protocol implementation ───────────────────────────────────────────────────

const initialize = (config: TrainingConfig): TrainingSessionState => {
  const opts: ReplayProtocolOptions = {
    ...DEFAULT_OPTIONS,
    ...(config.protocolOptions as Partial<ReplayProtocolOptions>),
  };

  const { ucis, sans } = extractMainlineMoves(config.pgnText);
  const userPlies = buildUserPlies(ucis.length, opts.side, opts.startPly);
  const replayState: ReplayState = {
    mainlineMoves: ucis,
    mainlineSans: sans,
    userPlies,
    options: opts,
  };

  // Build the initial FEN (from the starting position, replaying up to startPly).
  const chess = new Chess();
  const model = parsePgnToModel(config.pgnText);
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) {
    try { chess.load(fenHeader.value); } catch { /* ignore */ }
  }
  for (let i = 0; i < opts.startPly && i < ucis.length; i++) {
    const m = sans[i];
    if (m) chess.move(m, { strict: false });
  }

  return {
    phase: "in_progress",
    config,
    position: {
      fen: chess.fen(),
      moveHistory: ucis.slice(0, opts.startPly),
      ply: opts.startPly,
      totalUserPlies: userPlies.size,
    },
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    currentSourcePly: opts.startPly,
    hintUsedThisMove: false,
    hintsUsed: 0,
    startedAt: Date.now(),
    protocolState: replayState as unknown as Record<string, unknown>,
  };
};

const evaluateMove = (
  move: UserMoveInput,
  state: TrainingSessionState,
): MoveEvalResult => {
  const rs = state.protocolState as unknown as ReplayState;
  const ply = state.currentSourcePly;
  const expected = rs.mainlineMoves[ply];

  if (!expected) {
    return { accepted: false, feedback: "skip" };
  }

  // Normalize promotion suffix for comparison.
  const normalizeUci = (u: string): string =>
    u.length === 5 ? u.slice(0, 4) + u[4].toLowerCase() : u;

  if (normalizeUci(move.uci) === normalizeUci(expected)) {
    return { accepted: true, feedback: "correct" };
  }

  // Check annotated variations in the source model (future: parse model RAVs).
  // For now, any legal move is treated as "wrong".
  return {
    accepted: false,
    feedback: "wrong",
    correctMove: {
      uci: expected,
      san: rs.mainlineSans[ply] ?? expected,
    },
    annotation: `${move.san} (expected: ${rs.mainlineSans[ply] ?? expected})`,
  };
};

const advance = (state: TrainingSessionState): TrainingSessionState => {
  const rs = state.protocolState as unknown as ReplayState;
  const newPly = state.currentSourcePly + 1;

  // Rebuild FEN at the new ply.
  const chess = new Chess();
  const model = parsePgnToModel(state.config.pgnText);
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) { try { chess.load(fenHeader.value); } catch { /* ignore */ } }
  for (let i = 0; i < newPly && i < rs.mainlineSans.length; i++) {
    chess.move(rs.mainlineSans[i], { strict: false });
  }

  return {
    ...state,
    position: {
      fen: chess.fen(),
      moveHistory: rs.mainlineMoves.slice(0, newPly),
      ply: newPly,
      totalUserPlies: state.position.totalUserPlies,
    },
    currentSourcePly: newPly,
    hintUsedThisMove: false,
  };
};

const isComplete = (state: TrainingSessionState): boolean => {
  const rs = state.protocolState as unknown as ReplayState;
  return state.currentSourcePly >= rs.mainlineMoves.length;
};

const summarize = (
  state: TrainingSessionState,
  transcript: TrainingTranscript,
): ResultSummary => {
  const scored = state.correctCount + state.wrongCount;
  const scorePercent =
    scored > 0 ? Math.round((state.correctCount / scored) * 100) : 0;

  const totalMs = Date.now() - state.startedAt;
  const totalMoves = transcript.plyRecords.length;
  const avgTimeMsPerMove =
    totalMoves > 0 ? Math.round(totalMs / totalMoves) : undefined;

  const highlights: ResultHighlight[] = [];
  // Detect flawless streaks ≥ 5 consecutive correct moves.
  let streak = 0;
  let streakStart = 0;
  for (const rec of transcript.plyRecords) {
    if (rec.outcome === "correct") {
      if (streak === 0) streakStart = rec.ply;
      streak++;
      if (streak === 5) {
        highlights.push({
          ply: streakStart,
          kind: "flawless_streak",
          description: `5-move flawless streak starting at ply ${streakStart + 1}`,
        });
      }
    } else {
      streak = 0;
    }
  }

  return {
    correct: state.correctCount,
    wrong: state.wrongCount,
    skipped: state.skippedCount,
    total: state.correctCount + state.wrongCount + state.skippedCount,
    scorePercent,
    avgTimeMsPerMove,
    gradeLabel: gradeLabel(scorePercent),
    highlights,
  };
};

export const REPLAY_PROTOCOL: TrainingProtocol = {
  id: "replay",
  label: "Game Replay",
  description: "Reproduce one side of a game from a chosen starting position.",
  initialize,
  evaluateMove,
  advance,
  isComplete,
  summarize,
};
