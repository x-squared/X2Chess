import { createPlayerStoreService } from "./player_store_service";
import { createRuntimeConfigService } from "./runtime_config_service";
import { createSourceGateway } from "./source_gateway";

/**
 * Resources composition component.
 *
 * Integration API:
 * - Call `createResourcesCapabilities(deps)` once from `main.js`.
 * - Use the returned methods to:
 *   - choose and query game resources,
 *   - load/save games by source reference,
 *   - load runtime config and player store data.
 * - This component is orchestration only. It coordinates services and exposes a
 *   stable API to the composition root.
 *
 * Configuration API:
 * - Configure behavior via injected dependencies:
 *   - `deps.state`: shared runtime state (current source roots, mode, etc.).
 *   - `deps.t`: translation callback used for user-facing status text.
 *   - `deps.onSetSaveStatus(message, kind)`: host callback for status updates.
 *   - `deps.onApplyRuntimeConfig(config)`: host callback that applies loaded config.
 *   - `deps.onLoadPgn` and `deps.pgnInput`: optional bridge for compatibility flows.
 * - Source-specific behavior is configured in adapters behind `source_gateway`
 *   (`file`, `sqlite`, future sources).
 *
 * Communication API:
 * - Inbound:
 *   - Host calls methods like `listSourceGames`, `loadGameBySourceRef`,
 *     and `loadRuntimeConfigFromClientDataAndDefaults`.
 * - Outbound:
 *   - Calls `onSetSaveStatus(...)` for success/error/progress messages.
 *   - Calls `onApplyRuntimeConfig(...)` after config resolution.
 *   - Calls `onLoadPgn()` after writing loaded PGN into `pgnInput` (if provided).
 * - Side effects:
 *   - Reads/writes local resources through delegated services; no direct rendering.
 */

/**
 * Create resources capabilities.
 *
 * @param {object} deps - Dependencies.
 * @param {object} deps.state - Shared app state.
 * @param {Function} deps.t - Translation callback `(key, fallback) => string`.
 * @param {Function} deps.onSetSaveStatus - Callback `(message, kind) => void`.
 * @param {Function} deps.onApplyRuntimeConfig - Callback `(config) => void`.
 * @param {Function} [deps.onLoadPgn] - Optional callback to parse/render loaded PGN.
 * @param {Function} [deps.onInitializeWithDefaultPgn] - Optional callback for default PGN fallback.
 * @param {HTMLTextAreaElement|null} [deps.pgnInput] - Optional PGN textarea.
 * @returns {{
 *   chooseClientGamesFolder: Function,
 *   getAvailableSourceKinds: Function,
 *   listGamesForResource: Function,
 *   listSourceGames: Function,
 *   loadGameBySourceRef: Function,
 *   loadPlayerStoreFromClientData: Function,
 *   loadRuntimeConfigFromClientDataAndDefaults: Function,
 *   saveGameBySourceRef: Function,
 *   savePlayerStoreToClientData: Function,
 *   scheduleAutosave: Function
 * }} Public resources capabilities used by startup/session flows.
 */
export const createResourcesCapabilities = ({
  state,
  t,
  onSetSaveStatus,
  onApplyRuntimeConfig,
  onLoadPgn,
  onInitializeWithDefaultPgn,
  pgnInput,
}) => {
  const runtimeConfigService = createRuntimeConfigService({ state });
  const playerStoreService = createPlayerStoreService({ state });
  const sourceGateway = createSourceGateway({ state });

  const listSourceGames = async (kind = "file") => sourceGateway.listGames(kind);
  const listGamesForResource = async (resourceRef) => sourceGateway.listGamesForResource(resourceRef);

  /**
   * Choose local file source root and refresh listed games.
   *
   * @returns {Promise<Array<{sourceRef: object, titleHint: string, revisionToken: string}>>} Listed game descriptors.
   */
  const chooseClientGamesFolder = async () => {
    try {
      await sourceGateway.chooseFileSourceRoot();
      const runtimeConfig = await runtimeConfigService.loadRuntimeConfigFromClientData();
      onApplyRuntimeConfig(runtimeConfig);
      const listed = await listSourceGames("file");
      if (listed.length > 0) {
        onSetSaveStatus(`${t("pgn.source.folderSelected", "Folder")}`, "");
      } else {
        onSetSaveStatus(t("pgn.source.folderHint", "Choose a local folder (for example run/DEV)."), "");
      }
      return listed;
    } catch (error) {
      onSetSaveStatus(String(error?.message || t("pgn.save.error", "Autosave failed")), "error");
      return [];
    }
  };

  /**
   * Load game from source reference and hydrate active editor state (compatibility path).
   *
   * @param {object} sourceRef - Source reference.
   * @returns {Promise<{pgnText: string, revisionToken: string, titleHint: string}>} Load result.
   */
  const loadGameBySourceRef = async (sourceRef) => {
    const payload = await sourceGateway.loadBySourceRef(sourceRef);
    if (pgnInput) pgnInput.value = payload.pgnText;
    if (typeof onLoadPgn === "function") onLoadPgn();
    onSetSaveStatus("", "");
    return payload;
  };

  /**
   * Save game by source reference.
   *
   * @param {object} sourceRef - Source reference.
   * @param {string} pgnText - PGN content.
   * @param {string} revisionToken - Prior revision token.
   * @param {object} [options={}] - Save options.
   * @returns {Promise<{revisionToken: string}>} Save result.
   */
  const saveGameBySourceRef = async (sourceRef, pgnText, revisionToken, options = {}) => (
    sourceGateway.saveBySourceRef(sourceRef, pgnText, revisionToken, options)
  );

  /**
   * Load runtime config from source-root aware services.
   */
  const loadRuntimeConfigFromClientDataAndDefaults = async () => {
    await sourceGateway.maybePreloadDefaultDevSource();
    const runtimeConfig = await runtimeConfigService.loadRuntimeConfigFromClientDataAndDefaults();
    onApplyRuntimeConfig(runtimeConfig);
    return runtimeConfig;
  };

  /**
   * Compatibility no-op. Autosave is now handled by session persistence.
   */
  const scheduleAutosave = () => {};

  return {
    chooseClientGamesFolder,
    getAvailableSourceKinds: () => sourceGateway.getAdapterKinds(),
    listGamesForResource,
    listSourceGames,
    loadGameBySourceRef,
    loadPlayerStoreFromClientData: playerStoreService.loadPlayerStoreFromClientData,
    loadRuntimeConfigFromClientDataAndDefaults,
    saveGameBySourceRef,
    savePlayerStoreToClientData: playerStoreService.savePlayerStoreToClientData,
    scheduleAutosave,
  };
};

