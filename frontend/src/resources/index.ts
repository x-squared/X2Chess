import { createPlayerStoreService } from "./player_store_service";
import { createRuntimeConfigService } from "./runtime_config_service";
import { createSourceGateway } from "./source_gateway";

/**
 * Index module.
 *
 * Integration API:
 * - Primary exports from this module: `createResourcesCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

/**
 * Create resources facade used by bootstrap/session flows.
 *
 * This factory composes source selection, PGN load/save bridge behavior,
 * runtime-config loading, and player-store persistence behind one boundary API.
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
}: any): any => {
  const runtimeConfigService = createRuntimeConfigService({ state });
  const playerStoreService = createPlayerStoreService({ state });
  const sourceGateway = createSourceGateway({ state });

  /**
   * List games for one source kind via gateway.
   *
   * @param kind Canonical or compatibility kind token.
   * @returns Resource game rows for the selected kind.
   */
  const listSourceGames = async (kind: any = "file"): Promise<any> => sourceGateway.listGames(kind);

  /**
   * List games for one explicit resource reference.
   *
   * @param resourceRef Resource reference containing `kind` and `locator`.
   * @returns Resource game rows for the target resource.
   */
  const listGamesForResource = async (resourceRef: any): Promise<any> => sourceGateway.listGamesForResource(resourceRef);

  /**
   * Choose local file source root and refresh listed games.
   *
   * @returns {Promise<Array<{sourceRef: object, titleHint: string, revisionToken: string}>>} Listed game descriptors.
   */
  const chooseClientGamesFolder = async (): Promise<any> => {
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("pgn.save.error", "Autosave failed"), "error");
      return [];
    }
  };

  /**
   * Open a resource picker that can select either a folder or supported file resource.
   *
   * @returns {Promise<{resourceRef: object}|null>} Picked resource descriptor.
   */
  const chooseResourceByPicker = async (): Promise<any> => {
    try {
      const selected = await sourceGateway.chooseResourceByPicker();
      if (!selected) return null;
      onSetSaveStatus("", "");
      return selected;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("resources.error", "Unable to load resource games."), "error");
      return null;
    }
  };

  /**
   * Load game from source reference and hydrate active editor state (compatibility path).
   *
   * @param {object} sourceRef - Source reference.
   * @returns {Promise<{pgnText: string, revisionToken: string, titleHint: string}>} Load result.
   */
  const loadGameBySourceRef = async (sourceRef: any): Promise<any> => {
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
  const createGameInResource = async (resourceRef: any, pgnText: any, titleHint: any = ""): Promise<any> => (
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
  const saveGameBySourceRef = async (sourceRef: any, pgnText: any, revisionToken: any, options: any = {}): Promise<any> => (
    sourceGateway.saveBySourceRef(sourceRef, pgnText, revisionToken, options)
  );

  /**
   * Load runtime config from source-root aware services.
   */
  /**
   * Load runtime config after optional default-source preload.
   *
   * @returns Runtime config object applied through `onApplyRuntimeConfig`.
   */
  const loadRuntimeConfigFromClientDataAndDefaults = async (): Promise<any> => {
    await sourceGateway.maybePreloadDefaultDevSource();
    const runtimeConfig = await runtimeConfigService.loadRuntimeConfigFromClientDataAndDefaults();
    onApplyRuntimeConfig(runtimeConfig);
    return runtimeConfig;
  };

  /**
   * Compatibility no-op. Autosave is now handled by session persistence.
   */
  const scheduleAutosave = (): any => {};

  return {
    chooseClientGamesFolder,
    chooseResourceByPicker,
    getAvailableSourceKinds: (): any => sourceGateway.getAdapterKinds(),
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

