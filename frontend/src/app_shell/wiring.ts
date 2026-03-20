/**
 * App wiring component.
 *
 * Integration API:
 * - Call `createAppWiringCapabilities(deps)` from composition root.
 * - Use returned methods:
 *   - `bindDomEvents()` to attach UI listeners
 *   - `startApp()` to run startup orchestration
 *
 * Configuration API:
 * - Configure by supplying:
 *   - DOM refs in `deps.els`,
 *   - action callbacks in `deps.actions`,
 *   - shared state/translator for context-dependent behavior.
 *
 * Communication API:
 * - Converts raw DOM events into semantic action calls.
 * - Runs startup chain: hydrate assets -> load config -> load player store ->
 *   ensure board -> initialize first game session.
 */

/**
 * Create app wiring capabilities for event registration and startup orchestration.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared runtime state.
 * @param {Function} deps.t - Translation resolver `(key, fallback) => string`.
 * @param {object} deps.els - DOM element refs used by event binding.
 * @param {object} deps.actions - Callback action set invoked by event handlers.
 * @returns {{bindDomEvents: Function, startApp: Function}} Wiring capabilities.
 */
export const createAppWiringCapabilities = ({ state, t, els, actions }) => {
  /**
   * Bind DOM event handlers to host action callbacks.
   */
  const bindDomEvents = () => {
    const isPlayerNameField = (key) => (
      typeof actions.isPlayerNameField === "function" ? actions.isPlayerNameField(key) : false
    );
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
    if (els.btnCommentBold) els.btnCommentBold.addEventListener("click", () => actions.formatCommentStyle("bold"));
    if (els.btnCommentItalic) els.btnCommentItalic.addEventListener("click", () => actions.formatCommentStyle("italic"));
    if (els.btnCommentUnderline) els.btnCommentUnderline.addEventListener("click", () => actions.formatCommentStyle("underline"));
    if (els.btnUndo) els.btnUndo.addEventListener("click", () => actions.performUndo());
    if (els.btnRedo) els.btnRedo.addEventListener("click", () => actions.performRedo());
    if (els.btnCommentLeft) els.btnCommentLeft.addEventListener("click", () => actions.insertAroundSelectedMove("before", ""));
    if (els.btnCommentRight) els.btnCommentRight.addEventListener("click", () => actions.insertAroundSelectedMove("after", ""));
    if (els.btnLinebreak) els.btnLinebreak.addEventListener("click", () => actions.insertAroundSelectedMove("after", "\\n"));
    if (els.btnIndent) els.btnIndent.addEventListener("click", () => actions.insertAroundSelectedMove("after", "\\i"));
    const bindPgnLayout = (btn) => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        const mode = btn.dataset?.pgnLayout;
        if (mode === "plain" || mode === "text" || mode === "tree") {
          actions.setPgnLayoutMode(mode);
        }
      });
    };
    bindPgnLayout(els.btnPgnLayoutPlain);
    bindPgnLayout(els.btnPgnLayoutText);
    bindPgnLayout(els.btnPgnLayoutTree);
    if (els.btnDefaultIndent) {
      els.btnDefaultIndent.addEventListener("click", () => {
        actions.applyDefaultIndent();
      });
    }
    if (els.devTabBtnAst) {
      els.devTabBtnAst.addEventListener("click", () => {
        actions.selectDevTab("ast");
      });
    }
    if (els.devTabBtnDom) {
      els.devTabBtnDom.addEventListener("click", () => {
        actions.selectDevTab("dom");
      });
    }
    if (els.devTabBtnPgn) {
      els.devTabBtnPgn.addEventListener("click", () => {
        actions.selectDevTab("pgn");
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
    if (els.btnGameInfoEdit) {
      els.btnGameInfoEdit.addEventListener("click", () => {
        actions.toggleGameInfoEditor();
      });
    }
    if (Array.isArray(els.gameInfoInputs)) {
      els.gameInfoInputs.forEach((input) => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
        const key = input.dataset.headerKey;
        if (!key) return;
        if (input instanceof HTMLInputElement && isPlayerNameField(key)) {
          input.addEventListener("input", (event) => {
            actions.handlePlayerNameInput(key, input, event);
          });
          input.addEventListener("keydown", (event) => {
            actions.handlePlayerNameKeydown(event, key, input);
          });
          input.addEventListener("blur", () => {
            actions.commitPlayerNameInput(key, input.value);
          });
        }
        input.addEventListener("change", () => {
          if (input instanceof HTMLInputElement && isPlayerNameField(key)) {
            actions.commitPlayerNameInput(key, input.value);
            return;
          }
          actions.updateGameInfoHeader(key, input.value);
        });
      });
    }
    if (Array.isArray(els.gameInfoSuggestionEls)) {
      els.gameInfoSuggestionEls.forEach((container) => {
        if (!(container instanceof HTMLElement)) return;
        const fieldKey = container.dataset.playerSuggestionsFor;
        if (!fieldKey) return;
        container.addEventListener("mousedown", (event) => {
          event.preventDefault();
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const optionEl = target.closest("[data-player-suggestion-value]");
          if (!(optionEl instanceof HTMLElement)) return;
          const playerName = optionEl.dataset.playerSuggestionValue;
          if (!playerName) return;
          actions.pickPlayerNameSuggestion(fieldKey, playerName);
        });
      });
    }
  };

  /**
   * Run app startup sequence:
   * - hydrate visual assets
   * - load runtime config/default data root
   * - initialize board
   * - initialize default PGN in active game tab
   */
  const startApp = () => {
    void actions.hydrateVisualAssets();
    actions.loadRuntimeConfigFromClientDataAndDefaults().then(() => {
      actions.loadPlayerStore().then(() => {
        actions.ensureBoard().then(() => {
          actions.initializeWithDefaultPgn();
        });
      });
    });
  };

  return {
    bindDomEvents,
    startApp,
  };
};
