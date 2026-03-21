import type {
  PgnCreateGameResult,
  PgnListGamesResult,
  PgnLoadGameResult,
  PgnSaveGameResult,
} from "../domain/actions";
import type { PgnSaveOptions } from "../domain/contracts";
import type { PgnGameRef } from "../domain/game_ref";
import type { PgnResourceKind } from "../domain/kinds";
import type { PgnResourceRef } from "../domain/resource_ref";

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
   * Swap the display order of two games.
   * Throws if the adapter for the given kind does not support reordering.
   *
   * @param gameRef First game reference.
   * @param neighborGameRef Second game reference (the swap target).
   */
  reorderGame: (gameRef: PgnGameRef, neighborGameRef: PgnGameRef) => Promise<void>;
};
