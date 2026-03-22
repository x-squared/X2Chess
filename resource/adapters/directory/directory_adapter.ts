import {
  PgnResourceError,
  type PgnCreateGameResult,
  type PgnListGamesResult,
  type PgnLoadGameResult,
  type PgnSaveGameResult,
} from "../../domain/actions";
import type { PgnSaveOptions, PgnResourceAdapter } from "../../domain/contracts";
import type { PgnGameRef } from "../../domain/game_ref";
import type { PgnResourceRef } from "../../domain/resource_ref";

/**
 * Canonical directory-resource adapter.
 *
 * Integration API:
 * - Primary export: `createDirectoryAdapter`.
 * - Serves canonical `directory` kind and delegates actual behavior via injected callbacks.
 *
 * Configuration API:
 * - `DirectoryAdapterDeps` callbacks configure list/load/save/create operations.
 *
 * Communication API:
 * - No direct I/O in this module; all side effects are delegated to caller-supplied callbacks.
 */
type DirectoryAdapterDeps = {
  listGames?: (resourceRef: PgnResourceRef) => Promise<PgnListGamesResult>;
  loadGame?: (gameRef: PgnGameRef) => Promise<PgnLoadGameResult>;
  saveGame?: (gameRef: PgnGameRef, pgnText: string, options?: PgnSaveOptions) => Promise<PgnSaveGameResult>;
  createGame?: (resourceRef: PgnResourceRef, pgnText: string, title: string) => Promise<PgnCreateGameResult>;
  reorder?: (gameRef: PgnGameRef, neighborGameRef: PgnGameRef) => Promise<void>;
};

/**
 * Create canonical directory adapter.
 *
 * @param deps Optional operation callbacks.
 * @returns Canonical adapter implementing kind `directory`.
 * @throws PgnResourceError when an operation is called without configured callback.
 */
export const createDirectoryAdapter = (deps: DirectoryAdapterDeps = {}): PgnResourceAdapter => ({
  kind: "directory",
  list: async (resourceRef: PgnResourceRef): Promise<PgnListGamesResult> => {
    const listGames = deps.listGames;
    if (!listGames) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter list is not implemented.");
    }
    return listGames(resourceRef);
  },
  load: async (gameRef: PgnGameRef): Promise<PgnLoadGameResult> => {
    const loadGame = deps.loadGame;
    if (!loadGame) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter load is not implemented.");
    }
    return loadGame(gameRef);
  },
  save: async (gameRef: PgnGameRef, pgnText: string, options?: PgnSaveOptions): Promise<PgnSaveGameResult> => {
    const saveGame = deps.saveGame;
    if (!saveGame) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter save is not implemented.");
    }
    return saveGame(gameRef, pgnText, options);
  },
  create: async (resourceRef: PgnResourceRef, pgnText: string, title: string): Promise<PgnCreateGameResult> => {
    const createGame = deps.createGame;
    if (!createGame) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter create is not implemented.");
    }
    return createGame(resourceRef, pgnText, title);
  },

  reorder: deps.reorder
    ? async (gameRef: PgnGameRef, neighborGameRef: PgnGameRef): Promise<void> => {
        return deps.reorder!(gameRef, neighborGameRef);
      }
    : undefined,
});
