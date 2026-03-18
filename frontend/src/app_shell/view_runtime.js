/**
 * App view runtime component.
 *
 * Integration API:
 * - `syncAppViewRuntime(deps)` synchronizes render-time view state and controls.
 *
 * Configuration API:
 * - Uses host-provided UI refs, translation function, and board capabilities.
 *
 * Communication API:
 * - Mutates shared state for selection/focus cleanup and updates DOM control state.
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
 * @param {HTMLButtonElement|null} deps.btnFirstCommentIntro - First-comment intro toggle button.
 * @param {Function} deps.getFirstCommentMetadata - Callback returning first-comment role metadata.
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
  btnFirstCommentIntro,
  getFirstCommentMetadata,
  speedValue,
}) => {
  if (!state.boardPreview) {
    if (!state.selectedMoveId) {
      if (state.currentPly <= 0) {
        state.selectedMoveId = null;
      } else {
        const selectedFromPly = Object.entries(state.movePositionById || {})
          .find(([, position]) => Number.isInteger(position?.mainlinePly) && position.mainlinePly === state.currentPly)?.[0] ?? null;
        state.selectedMoveId = selectedFromPly;
      }
    } else if (state.selectedMoveId && state.movePositionById?.[state.selectedMoveId]) {
      const selectedFromPly = Object.entries(state.movePositionById || {})
        .find(([, position]) => Number.isInteger(position?.mainlinePly) && position.mainlinePly === state.currentPly)?.[0] ?? null;
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
  if (btnFirstCommentIntro) {
    const firstCommentMeta = typeof getFirstCommentMetadata === "function"
      ? getFirstCommentMetadata()
      : { exists: false, isIntro: false };
    btnFirstCommentIntro.disabled = !firstCommentMeta.exists;
    btnFirstCommentIntro.setAttribute("aria-pressed", firstCommentMeta.isIntro ? "true" : "false");
    btnFirstCommentIntro.classList.toggle("active", Boolean(firstCommentMeta.isIntro));
  }
};
