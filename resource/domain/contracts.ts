import type { PgnCreateGameResult, PgnListGamesResult, PgnLoadGameResult, PgnSaveGameResult } from "./actions";
import type { PgnGameRef } from "./game_ref";
import type { PgnResourceKind } from "./kinds";
import type { PgnResourceRef } from "./resource_ref";

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
}
