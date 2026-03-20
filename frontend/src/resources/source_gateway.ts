import { createFileSourceAdapter } from "./sources/file_adapter";
import { createPgnDbSourceAdapter } from "./sources/pgn_db_adapter";
import { createSourceRegistry } from "./sources/registry";
import { createSqliteSourceAdapter } from "./sources/sqlite_adapter";

/**
 * Source gateway service.
 *
 * Integration API:
 * - Build once with `createSourceGateway({ state })`.
 * - Use returned methods for all source-facing operations (`list/load/save`,
 *   root selection, default DEV preload).
 *
 * Configuration API:
 * - Active behavior is configured by:
 *   - registered adapters (`file`, `sqlite`, future kinds),
 *   - `state.activeSourceKind`,
 *   - source root values already present in shared state.
 *
 * Communication API:
 * - Inbound: caller asks for list/load/save using kind or `sourceRef`.
 * - Outbound: calls resolved adapter methods (`list`, `load`, `save`) and returns
 *   normalized payloads to caller.
 * - Side effects: updates source-selection fields in shared state when root
 *   selection/preload methods are used.
 */

/**
 * Create source gateway.
 *
 * @param {object} deps - Gateway dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {{chooseFileSourceRoot: Function, chooseResourceByPicker: Function, createGameInResource: Function, getAdapterKinds: Function, listGames: Function, loadBySourceRef: Function, maybePreloadDefaultDevSource: Function, saveBySourceRef: Function}} Gateway API.
 */
export const createSourceGateway = ({ state }) => {
  const fileAdapter = createFileSourceAdapter({ state });
  const pgnDbAdapter = createPgnDbSourceAdapter();
  const sqliteAdapter = createSqliteSourceAdapter();
  const registry = createSourceRegistry([fileAdapter, pgnDbAdapter, sqliteAdapter]);

  /**
   * Select local file source root.
   *
   * @returns {Promise<void>} Resolves when root selection is applied.
   */
  const chooseFileSourceRoot = async () => {
    const root = await fileAdapter.pickSourceRoot();
    if (!root) return;
    fileAdapter.applySourceRoot(root);
    state.activeSourceKind = "file";
  };

  /**
   * Pick a resource (folder or file) and return normalized resource reference.
   *
   * @returns {Promise<{resourceRef: object}|null>} Selected resource descriptor.
   */
  const chooseResourceByPicker = async () => {
    const selected = await fileAdapter.pickResourceTarget();
    if (!selected) return null;
    if (selected.type === "folder") {
      fileAdapter.applySourceRoot(selected.sourceRoot);
      state.activeSourceKind = "file";
      return {
        resourceRef: {
          kind: "file",
          locator: state.gameDirectoryPath || "local-files",
        },
      };
    }
    if (selected.type === "pgn-db") {
      state.activeSourceKind = "pgn-db";
      return {
        resourceRef: { kind: "pgn-db", locator: selected.locator },
      };
    }
    if (selected.type === "sqlite") {
      state.activeSourceKind = "sqlite";
      return {
        resourceRef: { kind: "sqlite", locator: selected.locator },
      };
    }
    return null;
  };

  /**
   * Attempt DEV-mode preload from default local games source.
   *
   * @returns {Promise<boolean>} True when source root was resolved.
   */
  const maybePreloadDefaultDevSource = async () => {
    if (state.appMode !== "DEV") return false;
    const root = await fileAdapter.detectDefaultSourceRoot();
    if (!root) return false;
    fileAdapter.applySourceRoot(root);
    state.activeSourceKind = "file";
    return true;
  };

  /**
   * List games for selected source kind.
   *
   * @param {string} [kind=state.activeSourceKind] - Source kind.
   * @returns {Promise<Array<{sourceRef: object, titleHint: string, revisionToken: string}>>} Source game descriptors.
   */
  const listGames = async (kind = state.activeSourceKind || "file") => {
    const adapter = registry.getAdapterByKind(kind);
    return adapter.list();
  };

  /**
   * Load game by source reference.
   *
   * @param {object} sourceRef - Source reference.
   * @returns {Promise<{pgnText: string, revisionToken: string, titleHint: string}>} Loaded payload.
   */
  const loadBySourceRef = async (sourceRef) => {
    const adapter = registry.getAdapterForSourceRef(sourceRef);
    return adapter.load(sourceRef);
  };

  /**
   * Save game by source reference.
   *
   * @param {object} sourceRef - Source reference.
   * @param {string} pgnText - Serialized PGN.
   * @param {string} revisionToken - Prior revision token.
   * @param {object} [options={}] - Save options.
   * @returns {Promise<{revisionToken: string}>} Save result.
   */
  const saveBySourceRef = async (sourceRef, pgnText, revisionToken, options = {}) => {
    const adapter = registry.getAdapterForSourceRef(sourceRef);
    return adapter.save(sourceRef, pgnText, revisionToken, options);
  };

  /**
   * Create a new persisted game in a target resource.
   *
   * @param {object} resourceRef - Target resource reference.
   * @param {string} pgnText - PGN content.
   * @param {string} [titleHint=""] - Preferred game title.
   * @returns {Promise<{sourceRef: object, revisionToken: string, titleHint: string}>} Created source payload.
   */
  const createGameInResource = async (resourceRef, pgnText, titleHint = "") => {
    const adapter = registry.getAdapterForSourceRef(resourceRef || { kind: "file" });
    if (typeof adapter.createInResource !== "function") {
      throw new Error(`Source kind '${String(resourceRef?.kind || "")}' cannot create new games yet.`);
    }
    return adapter.createInResource(resourceRef, pgnText, titleHint);
  };

  return {
    chooseFileSourceRoot,
    chooseResourceByPicker,
    createGameInResource,
    getAdapterKinds: () => registry.listKinds(),
    listGames,
    listGamesForResource: async (resourceRef) => {
      const adapter = registry.getAdapterForSourceRef(resourceRef || { kind: "file" });
      return adapter.list({ sourceRef: resourceRef || null });
    },
    loadBySourceRef,
    maybePreloadDefaultDevSource,
    saveBySourceRef,
  };
};

