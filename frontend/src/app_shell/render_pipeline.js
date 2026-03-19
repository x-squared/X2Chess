import { syncAppViewRuntime } from "./view_runtime";

/**
 * App render pipeline component.
 *
 * Integration API:
 * - `createAppRenderPipeline(deps)` returns render functions for full and live-input views.
 *
 * Configuration API:
 * - Host provides state, UI refs, render callbacks, and translation function.
 *
 * Communication API:
 * - Performs DOM rendering calls and applies view-runtime synchronization.
 */

/**
 * Create render pipeline helpers for full app render and live-input render.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {Function} deps.t - Translation resolver `(key, fallback) => string`.
 * @param {object} deps.boardCapabilities - Board capability adapter with ply/count getters.
 * @param {object} deps.selectionRuntimeCapabilities - Selection runtime capabilities.
 * @param {object} deps.els - UI element references used during render.
 * @param {Function} deps.buildGameAtPly - Callback `(ply) => Chess` for board render context.
 * @param {Function} deps.renderBoard - Callback `(game) => void`.
 * @param {Function} deps.renderMovesPanel - Callback `({movesEl, moves, pgnModel, t}) => void`.
 * @param {Function} deps.renderTextEditor - Callback `() => void` for text editor rendering.
 * @param {Function} deps.renderAstPanel - Callback `() => void` for AST panel rendering.
 * @param {Function} deps.renderDomView - Callback `() => void` for DOM panel rendering.
 * @param {Function} deps.renderResourceViewer - Callback `() => void` for resource viewer render.
 * @param {Function} deps.renderGameInfoSummary - Callback `() => void` for metadata summary rendering.
 * @param {Function} deps.syncGameInfoEditorValues - Callback `() => void` for metadata editor value sync.
 * @param {Function} deps.syncGameInfoEditorUi - Callback `() => void` for metadata editor open/close UI.
 * @returns {{renderFull: Function, renderLiveInput: Function}} Render pipeline functions.
 */
export const createAppRenderPipeline = ({
  state,
  t,
  boardCapabilities,
  selectionRuntimeCapabilities,
  els,
  buildGameAtPly,
  renderBoard,
  renderMovesPanel,
  renderTextEditor,
  renderAstPanel,
  renderDomView,
  renderResourceViewer,
  renderGameInfoSummary,
  syncGameInfoEditorValues,
  syncGameInfoEditorUi,
}) => {
  /**
   * Render full app frame and synchronize render-time runtime UI state.
   */
  const renderFull = () => {
    const game = buildGameAtPly(state.currentPly);
    renderBoard(game);
    renderMovesPanel({
      movesEl: els.movesEl,
      moves: state.moves,
      pgnModel: state.pgnModel,
      t,
    });
    if (els.errorEl) {
      els.errorEl.textContent = state.errorMessage;
    }
    renderTextEditor();
    const shouldRenderAst = state.isDeveloperToolsEnabled
      && state.isDevDockOpen
      && state.activeDevTab === "ast";
    const shouldRenderDom = state.isDeveloperToolsEnabled
      && state.isDevDockOpen
      && state.activeDevTab === "dom";
    if (shouldRenderAst) renderAstPanel();
    if (shouldRenderDom) renderDomView();
    renderResourceViewer();
    renderGameInfoSummary();
    syncGameInfoEditorValues();
    syncGameInfoEditorUi();
    syncAppViewRuntime({
      state,
      boardCapabilities,
      t,
      statusEl: els.statusEl,
      textEditorEl: els.textEditorEl,
      selectionRuntimeCapabilities,
      btnFirst: els.btnFirst,
      btnPrev: els.btnPrev,
      btnNext: els.btnNext,
      btnLast: els.btnLast,
      btnUndo: els.btnUndo,
      btnRedo: els.btnRedo,
      btnCommentLeft: els.btnCommentLeft,
      btnCommentRight: els.btnCommentRight,
      btnLinebreak: els.btnLinebreak,
      btnIndent: els.btnIndent,
      btnFirstCommentIntro: els.btnFirstCommentIntro,
      getFirstCommentMetadata: () => (
        typeof els.getFirstCommentMetadata === "function"
          ? els.getFirstCommentMetadata()
          : { exists: false, isIntro: false }
      ),
      developerDockEl: els.developerDockEl,
      devTabBtnAst: els.devTabBtnAst,
      devTabBtnDom: els.devTabBtnDom,
      devTabBtnPgn: els.devTabBtnPgn,
      devTabAstEl: els.devTabAstEl,
      devTabDomEl: els.devTabDomEl,
      devTabPgnEl: els.devTabPgnEl,
      runtimeBuildBadgeEl: els.runtimeBuildBadgeEl,
      speedValue: els.speedValue,
    });
  };

  /**
   * Render lightweight frame used while PGN text input is actively edited.
   */
  const renderLiveInput = () => {
    renderTextEditor();
    const shouldRenderAst = state.isDeveloperToolsEnabled
      && state.isDevDockOpen
      && state.activeDevTab === "ast";
    const shouldRenderDom = state.isDeveloperToolsEnabled
      && state.isDevDockOpen
      && state.activeDevTab === "dom";
    if (shouldRenderAst) renderAstPanel();
    if (shouldRenderDom) renderDomView();
    renderResourceViewer();
    renderGameInfoSummary();
    syncGameInfoEditorValues();
    syncGameInfoEditorUi();
    renderBoard(buildGameAtPly(state.currentPly));
    if (els.statusEl) {
      els.statusEl.textContent = `${t("status.label", "Position")}: ${state.currentPly}/${state.moves.length}`;
    }
    renderMovesPanel({
      movesEl: els.movesEl,
      moves: state.moves,
      pgnModel: state.pgnModel,
      t,
    });
    if (els.errorEl) {
      els.errorEl.textContent = state.errorMessage;
    }
    syncAppViewRuntime({
      state,
      boardCapabilities,
      t,
      statusEl: els.statusEl,
      textEditorEl: els.textEditorEl,
      selectionRuntimeCapabilities,
      btnFirst: els.btnFirst,
      btnPrev: els.btnPrev,
      btnNext: els.btnNext,
      btnLast: els.btnLast,
      btnUndo: els.btnUndo,
      btnRedo: els.btnRedo,
      btnCommentLeft: els.btnCommentLeft,
      btnCommentRight: els.btnCommentRight,
      btnLinebreak: els.btnLinebreak,
      btnIndent: els.btnIndent,
      btnFirstCommentIntro: els.btnFirstCommentIntro,
      getFirstCommentMetadata: () => (
        typeof els.getFirstCommentMetadata === "function"
          ? els.getFirstCommentMetadata()
          : { exists: false, isIntro: false }
      ),
      developerDockEl: els.developerDockEl,
      devTabBtnAst: els.devTabBtnAst,
      devTabBtnDom: els.devTabBtnDom,
      devTabBtnPgn: els.devTabBtnPgn,
      devTabAstEl: els.devTabAstEl,
      devTabDomEl: els.devTabDomEl,
      devTabPgnEl: els.devTabPgnEl,
      runtimeBuildBadgeEl: els.runtimeBuildBadgeEl,
      speedValue: els.speedValue,
    });
  };

  return {
    renderFull,
    renderLiveInput,
  };
};
