/**
 * App view runtime component.
 *
 * Integration API:
 * - Call `syncAppViewRuntime(deps)` at the end of each render cycle.
 * - Provide all control refs that need enabled/disabled, selected, or hidden
 *   synchronization with current runtime state.
 *
 * Configuration API:
 * - Behavior is configured by incoming state values (for example `isDevDockOpen`,
 *   `activeDevTab`, `appConfig.textEditor.showAstView/showDomView`) and injected
 *   helper callbacks (`getFirstCommentMetadata`, `focusCommentById`).
 *
 * Communication API:
 * - Updates button disabled states, status labels, and dock tab visibility.
 * - Applies pending comment focus requests and clears `state.pendingFocusCommentId`.
 * - Keeps `state.selectedMoveId` aligned with current ply when possible.
 */

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
}) => {
  if (!state.boardPreview) {
    if (!state.selectedMoveId) {
      if (state.currentPly <= 0) {
        state.selectedMoveId = null;
      } else {
        const selectedFromPly = Object.entries(state.movePositionById || {})
          .find(([, position]) => {
            const pos = position as { mainlinePly?: number };
            return Number.isInteger(pos?.mainlinePly) && pos.mainlinePly === state.currentPly;
          })?.[0] ?? null;
        state.selectedMoveId = selectedFromPly;
      }
    } else if (state.selectedMoveId && state.movePositionById?.[state.selectedMoveId]) {
      const selectedFromPly = Object.entries(state.movePositionById || {})
        .find(([, position]) => {
          const pos = position as { mainlinePly?: number };
          return Number.isInteger(pos?.mainlinePly) && pos.mainlinePly === state.currentPly;
        })?.[0] ?? null;
      // Keep explicit selection in sync with mainline ply only when selectable mapping exists.
      if (selectedFromPly) state.selectedMoveId = selectedFromPly;
    }
  }

  if (statusEl) {
    const currentPly = boardCapabilities.getCurrentPly();
    const totalMoves = boardCapabilities.getMoveCount();
    statusEl.textContent = state.boardPreview
      ? `${t("status.label", "Position")}: preview`
      : `${t("status.label", "Position")}: ${currentPly}/${totalMoves}`;
    statusEl.hidden = !state.isDeveloperToolsEnabled;
  }

  if (state.pendingFocusCommentId) {
    const focusTarget = state.pendingFocusCommentId;
    window.requestAnimationFrame(() => {
      if (selectionRuntimeCapabilities.focusCommentById(focusTarget)) {
        window.setTimeout(() => {
          const current = textEditorEl?.querySelector(`[data-comment-id="${focusTarget}"]`);
          if (current) current.classList.remove("text-editor-comment-new");
        }, 1600);
      }
    });
    state.pendingFocusCommentId = null;
  }

  const atStart = state.currentPly === 0;
  const atEnd = state.currentPly === state.moves.length;
  if (btnFirst) btnFirst.disabled = atStart || state.isAnimating;
  if (btnPrev) btnPrev.disabled = atStart || state.isAnimating;
  if (btnNext) btnNext.disabled = atEnd || state.isAnimating;
  if (btnLast) btnLast.disabled = atEnd || state.isAnimating;
  if (btnUndo) btnUndo.disabled = state.undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = state.redoStack.length === 0;
  if (speedValue) speedValue.textContent = String(state.moveDelayMs);
  const hasSelectedMove = Boolean(state.selectedMoveId);
  if (btnCommentLeft) btnCommentLeft.disabled = !hasSelectedMove;
  if (btnCommentRight) btnCommentRight.disabled = !hasSelectedMove;
  if (btnLinebreak) btnLinebreak.disabled = !hasSelectedMove;
  if (btnIndent) btnIndent.disabled = !hasSelectedMove;
  const pgnLayoutMode = state.pgnLayoutMode === "plain" || state.pgnLayoutMode === "text" || state.pgnLayoutMode === "tree"
    ? state.pgnLayoutMode
    : "plain";
  const syncPgnLayoutButton = (btn) => {
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
  const textEditorConfig = state.appConfig?.textEditor && typeof state.appConfig.textEditor === "object"
    ? state.appConfig.textEditor
    : {};
  const showAstView = textEditorConfig.showAstView !== false;
  const showDomView = textEditorConfig.showDomView !== false;
  if (developerDockEl) developerDockEl.hidden = !dockVisible;
  if (runtimeBuildBadgeEl) runtimeBuildBadgeEl.hidden = !state.isDeveloperToolsEnabled;

  const isAstTab = state.activeDevTab === "ast";
  const isDomTab = state.activeDevTab === "dom";
  const isPgnTab = state.activeDevTab === "pgn";
  if (devTabBtnAst) devTabBtnAst.hidden = !showAstView;
  if (devTabBtnDom) devTabBtnDom.hidden = !showDomView;
  if (devTabBtnAst) devTabBtnAst.setAttribute("aria-selected", isAstTab ? "true" : "false");
  if (devTabBtnDom) devTabBtnDom.setAttribute("aria-selected", isDomTab ? "true" : "false");
  if (devTabBtnPgn) devTabBtnPgn.setAttribute("aria-selected", isPgnTab ? "true" : "false");
  if (devTabAstEl) devTabAstEl.hidden = !dockVisible || !showAstView || !isAstTab;
  if (devTabDomEl) devTabDomEl.hidden = !dockVisible || !showDomView || !isDomTab;
  if (devTabPgnEl) devTabPgnEl.hidden = !dockVisible || !isPgnTab;
};
