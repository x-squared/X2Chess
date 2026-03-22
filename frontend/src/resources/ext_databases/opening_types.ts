/**
 * opening_types — domain contracts for the opening explorer integration (E1).
 *
 * Integration API:
 * - Exports: `OpeningMove`, `OpeningResult`, `OpeningDatabaseAdapter`, `OpeningQueryOptions`.
 *
 * Communication API:
 * - Pure type definitions; no I/O or side effects.
 */

/** Statistics for a single move in the opening tree. */
export type OpeningMove = {
  /** UCI move (e.g. "e2e4"). */
  uci: string;
  /** SAN move (e.g. "e4"). */
  san: string;
  /** Number of games won by the side to move. */
  white: number;
  /** Number of drawn games. */
  draws: number;
  /** Number of games won by the opponent. */
  black: number;
  /** Average rating of the player to move (optional). */
  averageRating?: number;
};

/** Result of an opening database query for a specific position. */
export type OpeningResult = {
  /** Total number of games in the database at this position. */
  totalGames: number;
  /** Win/draw/loss from the perspective of the side to move. */
  white: number;
  draws: number;
  black: number;
  /** Moves available from this position, sorted by frequency. */
  moves: OpeningMove[];
  /** Opening name/variation, if known. */
  openingName?: string;
};

/** Options for querying the opening database. */
export type OpeningQueryOptions = {
  /** "masters" = OTB master games only; "lichess" = online club games. */
  source: "masters" | "lichess";
  /** Speed variants to include (only used for "lichess" source). */
  speeds?: string[];
  /** Rating buckets to include (only used for "lichess" source). */
  ratings?: number[];
};

/** Contract for an opening database adapter. */
export type OpeningDatabaseAdapter = {
  readonly id: string;
  readonly label: string;
  /**
   * Query the opening database for statistics at the given FEN position.
   * Resolves to null when no data is available (position not in DB, network error, etc.).
   */
  query(fen: string, options: OpeningQueryOptions): Promise<OpeningResult | null>;
};
