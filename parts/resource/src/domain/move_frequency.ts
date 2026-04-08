/**
 * Move frequency types — result of an opening/position explorer query.
 *
 * Integration API:
 * - Primary export: `MoveFrequencyEntry`.
 * - Returned by `explorePosition` on adapters that support move-edge indexes.
 *
 * Communication API:
 * - Pure value type; no I/O.
 */

/**
 * Aggregated statistics for one move played from a given position
 * across one or more game collections.
 */
export type MoveFrequencyEntry = {
  /** Standard Algebraic Notation. */
  san: string;
  /** UCI coordinate notation (e.g. "e2e4"). Unique key within a position. */
  uci: string;
  /** Total number of games in which this move was played. */
  count: number;
  /** Games won by White after this move. */
  whiteWins: number;
  /** Games drawn after this move. */
  draws: number;
  /** Games won by Black after this move. */
  blackWins: number;
};
