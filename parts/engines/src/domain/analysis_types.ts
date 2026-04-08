/**
 * analysis_types — high-level analysis result types for engine output.
 *
 * Integration API:
 * - Exports: `EngineVariation`, `AnalysisSnapshot`, `EngineBestMove`,
 *   `EnginePosition`, `AnalysisOptions`, `MoveSearchOptions`.
 *
 * Communication API:
 * - Pure types; no I/O or side effects.
 */

import type { EngineScore } from "./uci_types";

export type EnginePosition = {
  /** Starting FEN — use "startpos" for the initial position. */
  fen: string;
  /** UCI moves played from that FEN. */
  moves: string[];
};

export type AnalysisOptions = {
  depth?: number;
  /** Analysis time limit in milliseconds. */
  movetime?: number;
  /** Number of principal variations to report (default 1). */
  multiPv?: number;
  /** Restrict search to these UCI moves. */
  searchMoves?: string[];
  /** Run indefinitely until `stopAnalysis()` is called. */
  infinite?: boolean;
};

export type MoveSearchOptions = {
  movetime?: number;
  depth?: number;
  wtime?: number;
  btime?: number;
  winc?: number;
  binc?: number;
};

export type EngineVariation = {
  /** 1-based MultiPV index. */
  multipvIndex: number;
  depth: number;
  selDepth?: number;
  score: EngineScore;
  /** Principal variation as UCI moves. */
  pv: string[];
  /** SAN representation of the PV (computed externally from position). */
  pvSan?: string[];
  nodes?: number;
  nps?: number;
  /** Hash table usage in per-mille (‰). */
  hashFull?: number;
  tbHits?: number;
};

export type EngineBestMove = {
  uci: string;
  san?: string;
  /** Engine's expected reply (for pondering). */
  ponder?: string;
};
