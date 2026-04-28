import type {
  PgnCreateGameResult,
  PgnListGamesResult,
  PgnLoadGameResult,
  PgnSaveGameResult,
} from "../domain/actions";
import type { MetadataSearchMode, PgnSaveOptions } from "../domain/contracts";
import type { PgnGameRef } from "../domain/game_ref";
import type { PgnResourceKind } from "../domain/kinds";
import type { PgnResourceRef } from "../domain/resource_ref";
import type { MoveFrequencyEntry } from "../domain/move_frequency";

/**
 * Resource client capability contracts.
 *
 * Integration API:
 * - Primary export: `ResourceCapabilities`.
 * - Used by resource consumers (for example frontend gateway/facade) as the canonical client boundary.
 *
 * Configuration API:
 * - Method inputs (`resourceRef`, `gameRef`, `pgnText`, `title`, `options`) fully configure each operation.
 *
 * Communication API:
 * - Async request/response contract only; implementations may perform file, directory, or database I/O.
 */
export type ResourceCapabilities = {
  /**
   * Return all supported canonical resource kinds.
   *
   * @returns Ordered list of resource kinds.
   */
  getKinds: () => PgnResourceKind[];

  /**
   * List games available in one resource container.
   *
   * @param resourceRef Canonical resource locator.
   * @returns List payload with game entries and metadata.
   */
  listGames: (resourceRef: PgnResourceRef) => Promise<PgnListGamesResult>;

  /**
   * Load one game from a resource.
   *
   * @param gameRef Canonical game locator.
   * @returns PGN text and revision metadata.
   */
  loadGame: (gameRef: PgnGameRef) => Promise<PgnLoadGameResult>;

  /**
   * Persist one game.
   *
   * @param gameRef Canonical game locator.
   * @param pgnText Serialized PGN text.
   * @param options Optional save preconditions (for example expected revision token).
   * @returns Updated revision metadata.
   */
  saveGame: (gameRef: PgnGameRef, pgnText: string, options?: PgnSaveOptions) => Promise<PgnSaveGameResult>;

  /**
   * Create a new game in a resource.
   *
   * @param resourceRef Target resource locator.
   * @param pgnText Initial PGN text for the new record.
   * @param title Human-readable title hint.
   * @returns Created canonical game reference and revision metadata.
   */
  createGame: (resourceRef: PgnResourceRef, pgnText: string, title: string) => Promise<PgnCreateGameResult>;

  /**
   * Delete one game from a resource.
   *
   * @param gameRef Canonical game locator.
   */
  deleteGame: (gameRef: PgnGameRef) => Promise<void>;

  /**
   * Move `gameRef` to immediately after `afterRef` in display order.
   * Pass `null` for `afterRef` to move the game to the front.
   * Throws `unsupported_operation` when the adapter does not support ordering.
   *
   * @param gameRef The game to relocate.
   * @param afterRef The game that should immediately precede it, or `null` for front.
   */
  reorderGame: (gameRef: PgnGameRef, afterRef: PgnGameRef | null) => Promise<void>;

  /**
   * Search a resource for games containing the given position hash.
   * Returns an empty array when the adapter does not support position search.
   *
   * @param positionHash 16-char hex FNV-1a hash of the first four FEN fields.
   * @param resourceRef Resource to search within.
   */
  searchByPositionHash: (positionHash: string, resourceRef: PgnResourceRef) => Promise<PgnGameRef[]>;

  /**
   * Search a resource for games whose metadata (White, Black, Event) contains
   * the query string (case-insensitive substring match).
   * Returns an empty array when the adapter does not support text search.
   *
   * @param query Substring to match.
   * @param resourceRef Resource to search within.
   */
  searchByText: (query: string, resourceRef: PgnResourceRef) => Promise<PgnGameRef[]>;

  /**
   * Return aggregated move-frequency statistics for the given position across
   * all games in one resource.
   * Returns an empty array when the adapter does not support move-edge indexes.
   *
   * @param positionHash 16-char hex FNV-1a hash of the position to explore.
   * @param resourceRef Resource to query.
   */
  explorePosition: (positionHash: string, resourceRef: PgnResourceRef) => Promise<MoveFrequencyEntry[]>;

  /**
   * Search a resource for games where a metadata key matches one or more values.
   * Returns an empty array when the adapter does not support structured metadata search.
   *
   * `mode: "any"` — game must have at least one of the given values for the key.
   * `mode: "all"` — game must have every one of the given values for the key.
   *
   * @param key Metadata key to filter on (e.g. `"Character"`).
   * @param values Values to match against.
   * @param mode Whether any or all values must be present.
   * @param resourceRef Resource to search within.
   */
  searchByMetadataValues: (
    key: string,
    values: string[],
    mode: MetadataSearchMode,
    resourceRef: PgnResourceRef,
  ) => Promise<PgnGameRef[]>;

  /**
   * Return the schema ID persisted inside a resource, or `null` if none.
   * Returns `null` for adapters that do not support schema association (e.g. single-file PGN).
   *
   * @param resourceRef Resource locator.
   */
  getResourceSchemaId: (resourceRef: PgnResourceRef) => Promise<string | null>;

  /**
   * Persist (or clear) the schema ID inside a resource so it travels with the resource
   * when copied to another installation.
   * No-op for adapters that do not support schema association.
   *
   * @param resourceRef Resource locator.
   * @param schemaId Schema UUID to associate, or `null` to clear.
   */
  setResourceSchemaId: (resourceRef: PgnResourceRef, schemaId: string | null) => Promise<void>;
};
