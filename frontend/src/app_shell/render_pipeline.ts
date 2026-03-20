import { syncAppViewRuntime } from "./view_runtime";
import type { MovePositionRecord } from "../board/move_position";

type RenderPipelineState = {
  currentPly: number;
  moves: string[];
  pgnModel: unknown;
  errorMessage: string;
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: string;
  boardPreview: unknown | null;
  selectedMoveId: string | null;
  movePositionById: Record<string, MovePositionRecord>;
  pendingFocusCommentId: string | null;
  undoStack: unknown[];
  redoStack: unknown[];
  moveDelayMs: number;
  pgnLayoutMode: string;
  appConfig: Record<string, unknown>;
  isAnimating: boolean;
};

type RenderPipelineDeps = {
  state: RenderPipelineState;
  t: (key: string, fallback?: string) => string;
  boardCapabilities: unknown;
  selectionRuntimeCapabilities: unknown;
  els: Record<string, Element | null>;
  buildGameAtPly: (ply: number) => unknown;
  renderBoard: (game: unknown) => void;
  renderMovesPanel: (params: {
    movesEl: Element | null;
    moves: string[];
    pgnModel: unknown;
    t: (key: string, fallback?: string) => string;
  }) => void;
  renderTextEditor: () => void;
  renderAstPanel: () => void;
  renderDomView: () => void;
  renderResourceViewer: () => void;
  renderGameInfoSummary: () => void;
  syncGameInfoEditorValues: () => void;
  syncGameInfoEditorUi: () => void;
};

type RenderPipelineCapabilities = {
  renderFull: () => void;
  renderLiveInput: () => void;
};

/**
 * Render Pipeline module.
 *
 * Integration API:
 * - Primary exports from this module: `createAppRenderPipeline`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
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
}: RenderPipelineDeps): RenderPipelineCapabilities => {
  /**
   * Render full app frame and synchronize render-time runtime UI state.
   */
  const renderFull = (): void => {
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
      btnPgnLayoutPlain: els.btnPgnLayoutPlain,
      btnPgnLayoutText: els.btnPgnLayoutText,
      btnPgnLayoutTree: els.btnPgnLayoutTree,
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
  const renderLiveInput = (): void => {
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
      btnPgnLayoutPlain: els.btnPgnLayoutPlain,
      btnPgnLayoutText: els.btnPgnLayoutText,
      btnPgnLayoutTree: els.btnPgnLayoutTree,
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
