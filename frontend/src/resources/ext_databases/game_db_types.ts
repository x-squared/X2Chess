/**
 * game_db_types — game database adapter contract and shared types (E5).
 *
 * Integration API:
 * - Exports: `GameDatabaseAdapter`, `GameSearchQuery`, `GameSearchResult`,
 *   `ExtGameEntry`, `ExtGameRef`.
 *
 * Configuration API:
 * - No configuration at this layer; each adapter is self-contained.
 *
 * Communication API:
 * - Pure type contracts; no side effects.
 */

// ── Query types ─────────────────────────────────────────────────────────────

export type GameSearchQuery = {
  /** Filter by player name. */
  player?: { name: string; color?: "white" | "black" | "any" };
  /** Filter by FEN position (position search). */
  position?: string;
  /** Filter by event name (substring match). */
  event?: string;
  /** Earliest game date in ISO format "YYYY-MM-DD". */
  dateFrom?: string;
  /** Latest game date in ISO format "YYYY-MM-DD". */
  dateTo?: string;
  /** Max number of results to return. Default: 20. */
  maxResults?: number;
};

// ── Result types ──────────────────────────────────────────────────────────

export type ExtGameRef = {
  /** Stable adapter-specific identifier for re-fetching the full PGN. */
  id: string;
  /** Adapter that owns this reference. */
  adapterId: string;
};

export type ExtGameEntry = {
  ref: ExtGameRef;
  white: string;
  black: string;
  result: string;
  event: string;
  date: string;
  whiteElo?: number;
  blackElo?: number;
  eco?: string;
  opening?: string;
  timeControl?: string;
};

export type GameSearchResult = {
  entries: ExtGameEntry[];
  /** True if there are more results beyond `maxResults`. */
  hasMore: boolean;
  /** Total count estimate, if available from the provider. */
  totalEstimate?: number;
};

// ── Adapter interface ─────────────────────────────────────────────────────

export type GameDatabaseAdapter = {
  /** Stable identifier, e.g. "lichess". */
  readonly id: string;
  /** Display name, e.g. "Lichess.org". */
  readonly label: string;
  /** Whether the adapter supports position search. */
  readonly supportsPositionSearch: boolean;

  /** Search for games matching the query. */
  search(query: GameSearchQuery): Promise<GameSearchResult>;
  /** Load the full PGN text for a specific game. */
  loadGame(ref: ExtGameRef): Promise<string>;
};
