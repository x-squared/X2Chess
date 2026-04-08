/**
 * Move-edge index type contracts.
 *
 * Integration API:
 * - Primary exports: `MoveEdge`, `BuildMoveEdgeIndex`.
 * - The implementation is injected into `createDbAdapter` options so the
 *   `resource/` package stays free of chess-engine dependencies.
 *
 * Communication API:
 * - Type-only; no runtime code.
 */

/**
 * One directed edge in the move graph: the position before the move,
 * the move itself, and the game result.
 */
export type MoveEdge = {
  /** 16-char hex FNV-1a hash of the position before the move. */
  positionHash: string;
  /** Standard Algebraic Notation of the move. */
  moveSan: string;
  /** UCI coordinate notation of the move (e.g. "e2e4", "e7e8q"). */
  moveUci: string;
  /** PGN result string: "1-0", "0-1", "1/2-1/2", or "*". */
  result: string;
};

/** Function signature for the injectable move-edge index builder. */
export type BuildMoveEdgeIndex = (pgnText: string) => MoveEdge[];
