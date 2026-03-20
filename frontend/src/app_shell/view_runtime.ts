import type { MovePositionRecord } from "../board/move_position";

/**
 * View Runtime module.
 *
 * Integration API:
 * - Primary exports from this module: `syncAppViewRuntime`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type ViewRuntimeState = {
  boardPreview: unknown | null;
  selectedMoveId: string | null;
  currentPly: number;
  movePositionById: Record<string, MovePositionRecord>;
  isDeveloperToolsEnabled: boolean;
  pendingFocusCommentId: string | null;
  moves: string[];
  isAnimating: boolean;
  undoStack: unknown[];
  redoStack: unknown[];
  moveDelayMs: number;
  pgnLayoutMode: string;
  appConfig: Record<string, unknown> | null | undefined;
  isDevDockOpen: boolean;
  activeDevTab: string;
};

type ViewRuntimeDeps = {
  state: ViewRuntimeState;
  boardCapabilities: unknown;
  t: (key: string, fallback?: string) => string;
  statusEl: Element | null;
  textEditorEl: Element | null;
  selectionRuntimeCapabilities: unknown;
  btnFirst: Element | null;
  btnPrev: Element | null;
  btnNext: Element | null;
  btnLast: Element | null;
  btnUndo: Element | null;
  btnRedo: Element | null;
  btnCommentLeft: Element | null;
  btnCommentRight: Element | null;
  btnLinebreak: Element | null;
  btnIndent: Element | null;
  btnPgnLayoutPlain: Element | null;
  btnPgnLayoutText: Element | null;
  btnPgnLayoutTree: Element | null;
  developerDockEl: Element | null;
  devTabBtnAst: Element | null;
  devTabBtnDom: Element | null;
  devTabBtnPgn: Element | null;
  devTabAstEl: Element | null;
  devTabDomEl: Element | null;
  devTabPgnEl: Element | null;
  runtimeBuildBadgeEl: Element | null;
  speedValue: Element | null;
};

/**
 * Synchronize render-time UI state (selection alignment, status text, control disabled states, and pending focus).
 *
 * @param {object} deps - Runtime dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {object} deps.boardCapabilities - Board capability adapter with current ply/count getters.
 * @param {Function} deps.t - Translation function `(key, fallback) => string`.
 * @param {HTMLElement|null} deps.statusEl - Status label element.
 * @param {HTMLElement|null} deps.textEditorEl - Text editor root element.
 * @param {object} deps.selectionRuntimeCapabilities - Selection runtime capabilities.
 * @param {HTMLButtonElement|null} deps.btnFirst - First button.
 * @param {HTMLButtonElement|null} deps.btnPrev - Prev button.
 * @param {HTMLButtonElement|null} deps.btnNext - Next button.
 * @param {HTMLButtonElement|null} deps.btnLast - Last button.
 * @param {HTMLButtonElement|null} deps.btnUndo - Undo button.
 * @param {HTMLButtonElement|null} deps.btnRedo - Redo button.
 * @param {HTMLButtonElement|null} deps.btnCommentLeft - Insert-comment-left button.
 * @param {HTMLButtonElement|null} deps.btnCommentRight - Insert-comment-right button.
 * @param {HTMLButtonElement|null} deps.btnLinebreak - Insert-linebreak button.
 * @param {HTMLButtonElement|null} deps.btnIndent - Insert-indent button.
 * @param {HTMLButtonElement|null} deps.btnPgnLayoutPlain - PGN Plain layout button.
 * @param {HTMLButtonElement|null} deps.btnPgnLayoutText - PGN Text layout button.
 * @param {HTMLButtonElement|null} deps.btnPgnLayoutTree - PGN Tree layout button (placeholder; behaves like Text).
 * @param {HTMLElement|null} deps.developerDockEl - Developer dock root element.
 * @param {HTMLButtonElement|null} deps.devTabBtnAst - AST tab button.
 * @param {HTMLButtonElement|null} deps.devTabBtnDom - DOM tab button.
 * @param {HTMLButtonElement|null} deps.devTabBtnPgn - PGN tab button.
 * @param {HTMLElement|null} deps.devTabAstEl - AST tab panel.
 * @param {HTMLElement|null} deps.devTabDomEl - DOM tab panel.
 * @param {HTMLElement|null} deps.devTabPgnEl - PGN tab panel.
 * @param {HTMLElement|null} deps.runtimeBuildBadgeEl - Build badge in menu footer.
 * @param {HTMLElement|null} deps.speedValue - Move speed value label.
 */
export const syncAppViewRuntime = ({
  state,
  boardCapabilities,
  t,
  statusEl,
  textEditorEl,
  selectionRuntimeCapabilities,
  btnFirst,
  btnPrev,
  btnNext,
  btnLast,
  btnUndo,
  btnRedo,
  btnCommentLeft,
  btnCommentRight,
  btnLinebreak,
  btnIndent,
  btnPgnLayoutPlain,
  btnPgnLayoutText,
  btnPgnLayoutTree,
  developerDockEl,
  devTabBtnAst,
  devTabBtnDom,
  devTabBtnPgn,
  devTabAstEl,
  devTabDomEl,
  devTabPgnEl,
  runtimeBuildBadgeEl,
  speedValue,
}: ViewRuntimeDeps): void => {
  const boardApi = boardCapabilities as { getCurrentPly: () => number; getMoveCount: () => number };
  const selectionApi = selectionRuntimeCapabilities as { focusCommentById: (commentId: string) => boolean };
  const setHidden = (el: Element | null, hidden: boolean): void => {
    if (el instanceof HTMLElement) el.hidden = hidden;
  };

  const setButtonDisabled = (el: Element | null, disabled: boolean): void => {
    if (el instanceof HTMLButtonElement) el.disabled = disabled;
  };

  if (!state.boardPreview) {
    if (!state.selectedMoveId) {
      if (state.currentPly <= 0) {
        state.selectedMoveId = null;
      } else {
        const selectedFromPly = Object.entries(state.movePositionById || {})
          .find(([, position]: [string, MovePositionRecord]): boolean => {
            const pos = position as { mainlinePly?: number };
            return Number.isInteger(pos?.mainlinePly) && pos.mainlinePly === state.currentPly;
          })?.[0] ?? null;
        state.selectedMoveId = selectedFromPly;
      }
    } else if (state.selectedMoveId && state.movePositionById?.[state.selectedMoveId]) {
      const selectedFromPly = Object.entries(state.movePositionById || {})
        .find(([, position]: [string, MovePositionRecord]): boolean => {
          const pos = position as { mainlinePly?: number };
          return Number.isInteger(pos?.mainlinePly) && pos.mainlinePly === state.currentPly;
        })?.[0] ?? null;
      // Keep explicit selection in sync with mainline ply only when selectable mapping exists.
      if (selectedFromPly) state.selectedMoveId = selectedFromPly;
    }
  }

  if (statusEl) {
    const currentPly = boardApi.getCurrentPly();
    const totalMoves = boardApi.getMoveCount();
    statusEl.textContent = state.boardPreview
      ? `${t("status.label", "Position")}: preview`
      : `${t("status.label", "Position")}: ${currentPly}/${totalMoves}`;
    if (statusEl instanceof HTMLElement) statusEl.hidden = !state.isDeveloperToolsEnabled;
  }

  if (state.pendingFocusCommentId) {
    const focusTarget = state.pendingFocusCommentId;
    window.requestAnimationFrame((): void => {
      if (selectionApi.focusCommentById(focusTarget)) {
        window.setTimeout((): void => {
          const current = textEditorEl?.querySelector(`[data-comment-id="${focusTarget}"]`);
          if (current) current.classList.remove("text-editor-comment-new");
        }, 1600);
      }
    });
    state.pendingFocusCommentId = null;
  }

  const atStart = state.currentPly === 0;
  const atEnd = state.currentPly === state.moves.length;
  setButtonDisabled(btnFirst, atStart || state.isAnimating);
  setButtonDisabled(btnPrev, atStart || state.isAnimating);
  setButtonDisabled(btnNext, atEnd || state.isAnimating);
  setButtonDisabled(btnLast, atEnd || state.isAnimating);
  setButtonDisabled(btnUndo, state.undoStack.length === 0);
  setButtonDisabled(btnRedo, state.redoStack.length === 0);
  if (speedValue) speedValue.textContent = String(state.moveDelayMs);
  const hasSelectedMove = Boolean(state.selectedMoveId);
  setButtonDisabled(btnCommentLeft, !hasSelectedMove);
  setButtonDisabled(btnCommentRight, !hasSelectedMove);
  setButtonDisabled(btnLinebreak, !hasSelectedMove);
  setButtonDisabled(btnIndent, !hasSelectedMove);
  const pgnLayoutMode = state.pgnLayoutMode === "plain" || state.pgnLayoutMode === "text" || state.pgnLayoutMode === "tree"
    ? state.pgnLayoutMode
    : "plain";
  const syncPgnLayoutButton = (btn: Element | null): void => {
    if (!btn || !(btn instanceof HTMLElement)) return;
    const mode = btn.dataset.pgnLayout;
    if (!mode) return;
    const pressed = mode === pgnLayoutMode;
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.classList.toggle("active", pressed);
  };
  syncPgnLayoutButton(btnPgnLayoutPlain);
  syncPgnLayoutButton(btnPgnLayoutText);
  syncPgnLayoutButton(btnPgnLayoutTree);

  const dockVisible = state.isDeveloperToolsEnabled && state.isDevDockOpen;
  const textEditorConfig: Record<string, unknown> = state.appConfig?.textEditor && typeof state.appConfig.textEditor === "object"
    ? (state.appConfig.textEditor as Record<string, unknown>)
    : {};
  const showAstView = textEditorConfig.showAstView !== false;
  const showDomView = textEditorConfig.showDomView !== false;
  setHidden(developerDockEl, !dockVisible);
  setHidden(runtimeBuildBadgeEl, !state.isDeveloperToolsEnabled);

  const isAstTab = state.activeDevTab === "ast";
  const isDomTab = state.activeDevTab === "dom";
  const isPgnTab = state.activeDevTab === "pgn";
  setHidden(devTabBtnAst, !showAstView);
  setHidden(devTabBtnDom, !showDomView);
  if (devTabBtnAst) devTabBtnAst.setAttribute("aria-selected", isAstTab ? "true" : "false");
  if (devTabBtnDom) devTabBtnDom.setAttribute("aria-selected", isDomTab ? "true" : "false");
  if (devTabBtnPgn) devTabBtnPgn.setAttribute("aria-selected", isPgnTab ? "true" : "false");
  setHidden(devTabAstEl, !dockVisible || !showAstView || !isAstTab);
  setHidden(devTabDomEl, !dockVisible || !showDomView || !isDomTab);
  setHidden(devTabPgnEl, !dockVisible || !isPgnTab);
};
