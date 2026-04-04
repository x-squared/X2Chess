import type { PgnCreateGameResult, PgnListGamesResult, PgnLoadGameResult, PgnSaveGameResult } from "./actions";
import type { PgnGameRef } from "./game_ref";
import type { PgnResourceKind } from "./kinds";
import type { PgnResourceRef } from "./resource_ref";
import type { MoveFrequencyEntry } from "./move_frequency";

/**
 * Controls how multiple values are matched in `searchByMetadataValues`.
 *
 * `"any"` — return games that have at least one of the given values for the key.
 * `"all"` — return games that have every one of the given values for the key.
 */
export type MetadataSearchMode = "any" | "all";

/**
 * Canonical adapter contracts.
 *
 * Integration API:
 * - Primary exports: `PgnSaveOptions`, `PgnResourceAdapter`.
 *
 * Configuration API:
 * - Save precondition is configured through `expectedRevisionToken`.
 *
 * Communication API:
 * - Defines async request/response shape expected by resource client dispatch.
 */
export type PgnSaveOptions = {
  expectedRevisionToken?: string;
};

/**
 * Adapter interface that every canonical resource kind must implement.
 */
export interface PgnResourceAdapter {
  readonly kind: PgnResourceKind;

  /**
   * List available games in one resource container.
   *
   * @param resourceRef Resource locator.
   */
  list(resourceRef: PgnResourceRef): Promise<PgnListGamesResult>;

  /**
   * Load one game.
   *
   * @param gameRef Game locator.
   */
  load(gameRef: PgnGameRef): Promise<PgnLoadGameResult>;

  /**
   * Save one game.
   *
   * @param gameRef Game locator.
   * @param pgnText Serialized PGN text.
   * @param options Optional revision precondition.
   */
  save(gameRef: PgnGameRef, pgnText: string, options?: PgnSaveOptions): Promise<PgnSaveGameResult>;

  /**
   * Create one game in a resource.
   *
   * @param resourceRef Resource locator.
   * @param pgnText Initial PGN text.
   * @param title Title hint.
   */
  create(resourceRef: PgnResourceRef, pgnText: string, title: string): Promise<PgnCreateGameResult>;

  /**
   * Swap the display order of two games.
   * Optional: only adapters that support explicit ordering need to implement this.
   *
   * @param gameRef First game reference.
   * @param neighborGameRef Second game reference (the swap target).
   */
  reorder?(gameRef: PgnGameRef, neighborGameRef: PgnGameRef): Promise<void>;

  /**
   * Search for games that contain a given position, identified by a pre-computed
   * FEN hash (first 4 space-delimited fields, FNV-1a 16-char hex string).
   * Optional: only adapters with position indexes need to implement this.
   *
   * @param positionHash 16-char hex string computed by the frontend position indexer.
   * @param resourceRef Resource to search within.
   */
  searchByPositionHash?(positionHash: string, resourceRef: PgnResourceRef): Promise<PgnGameRef[]>;

  /**
   * Search for games whose header metadata (White, Black, Event) matches the
   * query string (case-insensitive substring match).
   * Optional: only adapters that persist structured metadata need to implement this.
   *
   * @param query Substring to match against player names, event, etc.
   * @param resourceRef Resource to search within.
   */
  searchByText?(query: string, resourceRef: PgnResourceRef): Promise<PgnGameRef[]>;

  /**
   * Return move-frequency statistics for all moves played from the given position
   * across the games in this resource.
   * Optional: only adapters with a move-edge index need to implement this.
   *
   * @param positionHash 16-char hex FNV-1a hash of the position to explore.
   * @param resourceRef Resource to query.
   */
  explorePosition?(positionHash: string, resourceRef: PgnResourceRef): Promise<MoveFrequencyEntry[]>;

  /**
   * Search for games where a specific metadata key matches one or more values.
   *
   * `mode: "any"` — game must have at least one of the given values for the key
   *   (SQL: `val_str IN (…)`).
   * `mode: "all"` — game must have every one of the given values for the key
   *   (SQL: `IN (…) GROUP BY game_id HAVING COUNT(DISTINCT val_str) = N`).
   *
   * Designed for multi-valued fields such as user-defined "character" tags where a
   * user selects several values from a controlled vocabulary.
   * Optional: only adapters with a structured metadata index need to implement this.
   *
   * @param key Metadata key to filter on (e.g. `"Character"`).
   * @param values Values to match against.
   * @param mode Whether any or all values must be present.
   * @param resourceRef Resource to search within.
   */
  searchByMetadataValues?(
    key: string,
    values: string[],
    mode: MetadataSearchMode,
    resourceRef: PgnResourceRef,
  ): Promise<PgnGameRef[]>;
}
