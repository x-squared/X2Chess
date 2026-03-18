/**
 * App wiring component.
 *
 * Integration API:
 * - `createAppWiringCapabilities(deps)` returns event-binding and startup helpers.
 *
 * Configuration API:
 * - Receives DOM refs and callback functions from host composition root.
 *
 * Communication API:
 * - Binds UI events to host callbacks and orchestrates startup sequence.
 */

/**
 * Create app wiring capabilities for event registration and startup orchestration.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared runtime state.
 * @param {Function} deps.t - Translation resolver `(key, fallback) => string`.
 * @param {object} deps.els - DOM element refs used by event binding.
 * @param {object} deps.actions - Callback action set invoked by event handlers.
 * @returns {{bindDomEvents: Function, initializeGameLibrary: Function, startApp: Function}} Wiring capabilities.
 */
export const createAppWiringCapabilities = ({ state, t, els, actions }) => {
  /**
   * Initialize game library from selected client data root.
   *
   * @returns {Promise<boolean>} True when at least one game was loaded.
   */
  const initializeGameLibrary = async () => {
    const files = await actions.fetchGameFilesFromClientData();
    if (files.length === 0) {
      actions.setSaveStatus(t("pgn.source.folderHint", "Choose a local folder (for example run/DEV)."), "");
      return false;
    }
    const first = files[0];
    try {
      await actions.loadGameByName(first);
      return true;
    } catch (error) {
      actions.setSaveStatus(String(error?.message || t("pgn.save.error", "Autosave failed")), "error");
      return false;
    }
  };

  /**
   * Bind DOM event handlers to host action callbacks.
   */
  const bindDomEvents = () => {
    if (els.btnFirst) els.btnFirst.addEventListener("click", () => actions.gotoPly(0, { animate: false }));
    if (els.btnPrev) {
      els.btnPrev.addEventListener("click", () => {
        void actions.gotoRelativeStep(-1);
      });
    }
    if (els.btnNext) {
      els.btnNext.addEventListener("click", () => {
        void actions.gotoRelativeStep(1);
      });
    }
    if (els.btnLast) els.btnLast.addEventListener("click", () => actions.gotoPly(state.moves.length, { animate: false }));
    if (els.btnLoad) els.btnLoad.addEventListener("click", () => actions.loadPgn());
    if (els.btnUndo) els.btnUndo.addEventListener("click", () => actions.performUndo());
    if (els.btnRedo) els.btnRedo.addEventListener("click", () => actions.performRedo());
    if (els.btnCommentLeft) els.btnCommentLeft.addEventListener("click", () => actions.insertAroundSelectedMove("before", ""));
    if (els.btnCommentRight) els.btnCommentRight.addEventListener("click", () => actions.insertAroundSelectedMove("after", ""));
    if (els.btnLinebreak) els.btnLinebreak.addEventListener("click", () => actions.insertAroundSelectedMove("after", "\\n"));
    if (els.btnIndent) els.btnIndent.addEventListener("click", () => actions.insertAroundSelectedMove("after", "\\i"));
    if (els.btnDefaultIndent) {
      els.btnDefaultIndent.addEventListener("click", () => {
        actions.applyDefaultIndent();
      });
    }
    if (els.btnPickGamesFolder) {
      els.btnPickGamesFolder.addEventListener("click", () => {
        void actions.chooseClientGamesFolder();
      });
    }
    if (els.gameSelect) {
      els.gameSelect.addEventListener("change", () => {
        const fileName = els.gameSelect.value;
        state.selectedGameFile = fileName;
        if (!fileName) {
          actions.setSaveStatus("", "");
          return;
        }
        void actions.loadGameByName(fileName).catch((error) => {
          actions.setSaveStatus(String(error?.message || t("pgn.save.error", "Autosave failed")), "error");
        });
      });
    }
    if (els.pgnInput) {
      els.pgnInput.addEventListener("input", () => {
        actions.handleLivePgnInput();
      });
      els.pgnInput.addEventListener("drop", () => {
        window.setTimeout(() => {
          actions.loadPgn();
        }, 0);
      });
    }
  };

  /**
   * Run app startup sequence:
   * - hydrate visual assets
   * - load runtime config/default data root
   * - initialize board
   * - initialize game library or fallback default PGN
   */
  const startApp = () => {
    void actions.hydrateVisualAssets();
    actions.loadRuntimeConfigFromClientDataAndDefaults().then(() => {
      actions.ensureBoard().then(() => initializeGameLibrary().then((loadedGame) => {
        if (!loadedGame && !state.selectedGameFile) actions.initializeWithDefaultPgn();
      }));
    });
  };

  return {
    bindDomEvents,
    initializeGameLibrary,
    startApp,
  };
};
