/**
 * Position index type contracts.
 *
 * Integration API:
 * - Primary export: `PositionRecord`.
 * - The implementation function `buildPositionIndex` is injected via
 *   `createDbAdapter` options so the `resource/` package stays free of
 *   chess-engine dependencies.
 *
 * Communication API:
 * - Type-only; no runtime code.
 */

export type PositionRecord = {
  /** Zero-based half-move number (0 = starting position). */
  ply: number;
  /** 16-char hex FEN hash (ignores move counters). */
  hash: string;
};

/** Function signature for the injectable position-index builder. */
export type BuildPositionIndex = (pgnText: string) => PositionRecord[];
