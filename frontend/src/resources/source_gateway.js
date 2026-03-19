import { createFileSourceAdapter } from "./sources/file_adapter";
import { createSourceRegistry } from "./sources/registry";
import { createSqliteSourceAdapter } from "./sources/sqlite_adapter";

/**
 * Source gateway service.
 *
 * Integration API:
 * - `createSourceGateway(deps)`
 *
 * Configuration API:
 * - Registers source adapters and tracks active source kind/root in shared state.
 *
 * Communication API:
 * - Provides uniform list/load/save operations via source references.
 */

/**
 * Create source gateway.
 *
 * @param {object} deps - Gateway dependencies.
 * @param {object} deps.state - Shared app state.
 * @returns {{chooseFileSourceRoot: Function, getAdapterKinds: Function, listGames: Function, loadBySourceRef: Function, maybePreloadDefaultDevSource: Function, saveBySourceRef: Function}} Gateway API.
 */
export const createSourceGateway = ({ state }) => {
  const fileAdapter = createFileSourceAdapter({ state });
  const sqliteAdapter = createSqliteSourceAdapter();
  const registry = createSourceRegistry([fileAdapter, sqliteAdapter]);

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

  return {
    chooseFileSourceRoot,
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

