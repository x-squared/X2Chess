import { createPlayerStoreService } from "./player_store_service";
import { createRuntimeConfigService } from "./runtime_config_service";
import { createSourceGateway } from "./source_gateway";

/**
 * Resources composition component.
 *
 * Integration API:
 * - Create once via `createResourcesCapabilities(deps)`.
 * - Use returned methods directly from composition root/session flows:
 *   - `chooseClientGamesFolder()`
 *   - `listSourceGames(kind)` / `listGamesForResource(resourceRef)`
 *   - `loadGameBySourceRef(sourceRef)` / `saveGameBySourceRef(...)`
 *   - `loadRuntimeConfigFromClientDataAndDefaults()`
 *   - player store load/save helpers.
 *
 * Configuration API:
 * - Required injected dependencies:
 *   - `state` for active runtime/source context,
 *   - `t` for user-facing status texts,
 *   - `onSetSaveStatus(message, kind)` for save/load feedback,
 *   - `onApplyRuntimeConfig(config)` to apply loaded runtime config.
 * - Optional compatibility bridge:
 *   - `onLoadPgn` and `pgnInput` to hydrate legacy raw-PGN flow after load.
 * - Source behavior is configured by adapters registered in source gateway.
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
 *   - Reads/writes local resources and shared resource state; no direct rendering.
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
 *   chooseResourceByPicker: Function,
 *   getAvailableSourceKinds: Function,
 *   listGamesForResource: Function,
 *   listSourceGames: Function,
 *   loadGameBySourceRef: Function,
 *   createGameInResource: Function,
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
   * Open a resource picker that can select either a folder or supported file resource.
   *
   * @returns {Promise<{resourceRef: object}|null>} Picked resource descriptor.
   */
  const chooseResourceByPicker = async () => {
    try {
      const selected = await sourceGateway.chooseResourceByPicker();
      if (!selected) return null;
      onSetSaveStatus("", "");
      return selected;
    } catch (error) {
      onSetSaveStatus(String(error?.message || t("resources.error", "Unable to load resource games.")), "error");
      return null;
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
   * Create a new game entry inside a target resource.
   *
   * @param {object} resourceRef - Target resource reference.
   * @param {string} pgnText - PGN content.
   * @param {string} [titleHint=""] - Preferred title/file name stem.
   * @returns {Promise<{sourceRef: object, revisionToken: string, titleHint: string}>} Created source payload.
   */
  const createGameInResource = async (resourceRef, pgnText, titleHint = "") => (
    sourceGateway.createGameInResource(resourceRef, pgnText, titleHint)
  );

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
    chooseResourceByPicker,
    getAvailableSourceKinds: () => sourceGateway.getAdapterKinds(),
    listGamesForResource,
    listSourceGames,
    createGameInResource,
    loadGameBySourceRef,
    loadPlayerStoreFromClientData: playerStoreService.loadPlayerStoreFromClientData,
    loadRuntimeConfigFromClientDataAndDefaults,
    saveGameBySourceRef,
    savePlayerStoreToClientData: playerStoreService.savePlayerStoreToClientData,
    scheduleAutosave,
  };
};

