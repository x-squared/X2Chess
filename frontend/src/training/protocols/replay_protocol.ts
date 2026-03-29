/**
 * replay_protocol — "Play one side" training protocol.
 *
 * The user reproduces one (or both) sides of a source game from a chosen
 * starting ply. For each user-side ply the played move is evaluated against
 * the source game mainline, RAV annotations, NAGs, and optional [%train] tags
 * via the `move_acceptance` module.
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
import type { PgnMoveNode } from "../../model/pgn_model";
import { parsePgnToModel } from "../../model/pgn_model";
import {
  acceptMove,
  EVAL_ACCEPT_THRESHOLD_CP,
  EVAL_INFERIOR_THRESHOLD_CP,
} from "../domain/move_acceptance";

// ── Options ───────────────────────────────────────────────────────────────────

export type ReplayProtocolOptions = {
  side: "white" | "black" | "both";
  startPly: number;
  allowRetry: boolean;
  showOpponentMoves: boolean;
  opponentMoveDelayMs: number;
  allowHints: boolean;
  maxHintsPerGame: number;
  /**
   * Whether to accept moves in the inferior (?!) set or require the user
   * to find a better move. Default: "reject".
   */
  inferiorMovePolicy: "accept" | "reject";
  /**
   * Centipawn threshold below which a non-annotated legal move is accepted
   * as equivalent (requires [%eval] in PGN). Default: 30.
   */
  evalAcceptThresholdCp: number;
  /**
   * Centipawn threshold below which a non-annotated legal move is treated
   * as ?! (inferior). Default: 80.
   */
  evalInferiorThresholdCp: number;
};

const DEFAULT_OPTIONS: ReplayProtocolOptions = {
  side: "white",
  startPly: 0,
  allowRetry: true,
  showOpponentMoves: true,
  opponentMoveDelayMs: 800,
  allowHints: true,
  maxHintsPerGame: 3,
  inferiorMovePolicy: "reject",
  evalAcceptThresholdCp: EVAL_ACCEPT_THRESHOLD_CP,
  evalInferiorThresholdCp: EVAL_INFERIOR_THRESHOLD_CP,
};

// ── Internal helpers ──────────────────────────────────────────────────────────

type ReplayState = {
  mainlineMoves: string[];
  mainlineSans: string[];
  mainlineNodes: PgnMoveNode[];
  /** FEN at each ply (index i = FEN before ply i's move). */
  plyFens: string[];
  userPlies: Set<number>;
  options: ReplayProtocolOptions;
};

const extractMainline = (
  pgnText: string,
): { ucis: string[]; sans: string[]; nodes: PgnMoveNode[]; plyFens: string[] } => {
  const model = parsePgnToModel(pgnText);
  const ucis: string[] = [];
  const sans: string[] = [];
  const nodes: PgnMoveNode[] = [];
  const plyFens: string[] = [];
  const chess = new Chess();

  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) {
    try { chess.load(fenHeader.value); } catch { /* ignore invalid FEN */ }
  }

  for (const entry of model.root.entries) {
    if (entry.type !== "move") continue;
    plyFens.push(chess.fen());
    const result = chess.move(entry.san, { strict: false });
    if (!result) break;
    ucis.push(result.from + result.to + (result.promotion ?? ""));
    sans.push(result.san);
    nodes.push(entry);
  }

  return { ucis, sans, nodes, plyFens };
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

  const { ucis, sans, nodes, plyFens } = extractMainline(config.pgnText);
  const userPlies = buildUserPlies(ucis.length, opts.side, opts.startPly);

  const replayState: ReplayState = {
    mainlineMoves: ucis,
    mainlineSans: sans,
    mainlineNodes: nodes,
    plyFens,
    userPlies,
    options: opts,
  };

  const chess = new Chess();
  const model = parsePgnToModel(config.pgnText);
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) {
    try { chess.load(fenHeader.value); } catch { /* ignore */ }
  }
  for (let i = 0; i < opts.startPly && i < sans.length; i++) {
    chess.move(sans[i], { strict: false });
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
  const node = rs.mainlineNodes[ply];
  const mainlineUci = rs.mainlineMoves[ply];

  if (!node || !mainlineUci) {
    return { accepted: false, feedback: "skip" };
  }

  return acceptMove({
    userMove: move,
    node,
    positionFen: rs.plyFens[ply] ?? state.position.fen,
    mainlineUci,
    inferiorMovePolicy: rs.options.inferiorMovePolicy,
    evalAcceptThresholdCp: rs.options.evalAcceptThresholdCp,
    evalInferiorThresholdCp: rs.options.evalInferiorThresholdCp,
  });
};

const advance = (state: TrainingSessionState): TrainingSessionState => {
  const rs = state.protocolState as unknown as ReplayState;
  const newPly = state.currentSourcePly + 1;

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
  // Weighted scoring:
  //   correct / correct_better / correct_dubious / legal_variant → 1.0
  //   inferior (accepted) → 0.5
  //   wrong → 0.0
  //   skip / engine_filled → excluded from denominator
  let weightedCorrect = 0;
  let denominator = 0;

  for (const rec of transcript.plyRecords) {
    if (rec.outcome === "skip" || rec.outcome === "engine_filled") continue;
    denominator++;
    if (
      rec.outcome === "correct" ||
      rec.outcome === "correct_better" ||
      rec.outcome === "correct_dubious" ||
      rec.outcome === "legal_variant"
    ) {
      weightedCorrect += 1.0;
    } else if (rec.outcome === "inferior") {
      weightedCorrect += 0.5;
    }
  }

  const scorePercent =
    denominator > 0 ? Math.round((weightedCorrect / denominator) * 100) : 0;

  const totalMs = Date.now() - state.startedAt;
  const totalMoves = transcript.plyRecords.length;
  const avgTimeMsPerMove =
    totalMoves > 0 ? Math.round(totalMs / totalMoves) : undefined;

  const highlights: ResultHighlight[] = [];

  // Flawless streaks ≥ 5 consecutive fully-correct moves
  let streak = 0;
  let streakStart = 0;
  for (const rec of transcript.plyRecords) {
    if (rec.outcome === "correct" || rec.outcome === "correct_better") {
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

  // correct_better highlights
  for (const rec of transcript.plyRecords) {
    if (rec.outcome === "correct_better") {
      highlights.push({
        ply: rec.ply,
        kind: "best_move",
        description: `Found improvement over the game move at ply ${rec.ply + 1}`,
      });
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
