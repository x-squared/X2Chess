/**
 * Editor selection runtime component.
 *
 * Integration API:
 * - `createSelectionRuntimeCapabilities(deps)` returns selection/focus/editor-option methods.
 *
 * Configuration API:
 * - Uses shared state and host callbacks for rendering and model updates.
 *
 * Communication API:
 * - Mutates selection/focus-related state and triggers render/model updates via callbacks.
 */

/**
 * Create selection/focus capabilities used by editor and board navigation.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {HTMLElement|null} deps.textEditorEl - Editor root element.
 * @param {Function} deps.getMovePositionById - Callback `(moveId, options) => position|null`.
 * @param {Function} deps.buildMainlinePlyByMoveIdFn - Callback `(pgnModel) => Record<string, number>`.
 * @param {Function} deps.findExistingCommentIdAroundMoveFn - Callback `(pgnModel, moveId, position) => string|null`.
 * @param {Function} deps.insertCommentAroundMoveFn - Callback `(pgnModel, moveId, position, rawText) => { model, insertedCommentId, created? }`.
 * @param {Function} deps.removeCommentByIdFn - Callback `(pgnModel, commentId) => model`.
 * @param {Function} deps.setCommentTextByIdFn - Callback `(pgnModel, commentId, text) => model`.
 * @param {Function} deps.resolveOwningMoveIdForCommentFn - Callback `(pgnModel, commentId) => string|null`.
 * @param {Function} deps.applyPgnModelUpdate - Callback `(nextModel, focusCommentId?, options?) => void`.
 * @param {Function} deps.onRender - Callback to refresh UI.
 * @returns {{focusCommentById: Function, formatFocusedComment: Function, getTextEditorOptions: Function, insertAroundSelectedMove: Function, selectMoveById: Function}} Selection runtime capabilities.
 */
export const createSelectionRuntimeCapabilities = ({
  state,
  textEditorEl,
  getMovePositionById,
  buildMainlinePlyByMoveIdFn,
  findExistingCommentIdAroundMoveFn,
  insertCommentAroundMoveFn,
  removeCommentByIdFn,
  setCommentTextByIdFn,
  resolveOwningMoveIdForCommentFn,
  applyPgnModelUpdate,
  onRender,
}) => {
  /**
   * Select move and synchronize board preview/mainline ply position.
   *
   * @param {string} moveId - Target move id.
   * @returns {boolean} True when selection processing completed.
   */
  const selectMoveById = (moveId) => {
    state.selectedMoveId = moveId;
    const target = getMovePositionById(moveId, { allowResolve: true });
    if (!target) {
      const mainlinePlyByMoveId = buildMainlinePlyByMoveIdFn(state.pgnModel);
      const fallbackPly = mainlinePlyByMoveId?.[moveId];
      if (Number.isInteger(fallbackPly)) {
        state.animationRunId += 1;
        state.isAnimating = false;
        state.boardPreview = null;
        state.currentPly = Math.max(0, Math.min(fallbackPly, state.moves.length));
        onRender();
        return true;
      }
      // Keep token-level selection even if board-position mapping is unavailable.
      state.boardPreview = null;
      onRender();
      return true;
    }
    if (Number.isInteger(target.mainlinePly)) {
      if (target.mainlinePly === state.currentPly) {
        state.boardPreview = null;
        onRender();
        return true;
      }
      // Move selection should jump immediately, without replay animation.
      state.animationRunId += 1;
      state.isAnimating = false;
      state.boardPreview = null;
      state.currentPly = target.mainlinePly;
      onRender();
      return true;
    }
    state.boardPreview = {
      fen: target.fen,
      lastMove: target.lastMove,
    };
    onRender();
    return true;
  };

  /**
   * Focus editable comment by id and place caret at end.
   *
   * @param {string|null|undefined} commentId - Comment id to focus.
   * @returns {boolean} True when focus target exists (or selection unavailable but focus succeeded).
   */
  const focusCommentById = (commentId) => {
    if (!textEditorEl || !commentId) return false;
    const el = textEditorEl.querySelector(`[data-comment-id="${commentId}"]`);
    if (!el) return false;
    el.focus();
    const selection = window.getSelection();
    if (!selection) return true;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  /**
   * Apply inline text formatting to current selection inside focused comment.
   *
   * @param {"bold"|"italic"|"underline"} style - Formatting style.
   * @returns {boolean} True when a comment context was found and command executed.
   */
  const formatFocusedComment = (style) => {
    if (!textEditorEl) return false;
    const allowedStyles = new Set(["bold", "italic", "underline"]);
    const command = allowedStyles.has(style) ? style : null;
    if (!command) return false;

    const selection = window.getSelection();
    let anchorElement: Element | null = null;
    if (selection?.anchorNode instanceof Element) {
      anchorElement = selection.anchorNode;
    } else if (selection?.anchorNode instanceof Node) {
      anchorElement = selection.anchorNode.parentElement;
    } else if (document.activeElement instanceof Element) {
      anchorElement = document.activeElement;
    }
    const commentEl = anchorElement?.closest?.('[data-kind="comment"][contenteditable="true"]') ?? null;
    if (!(commentEl instanceof HTMLElement)) return false;
    commentEl.focus();
    document.execCommand(command);
    return true;
  };

  /**
   * Insert comment token around currently selected move.
   *
   * @param {"before"|"after"} position - Relative insertion position.
   * @param {string} [rawText=""] - Initial raw comment text.
   */
  const insertAroundSelectedMove = (position, rawText = "") => {
    const moveId = state.selectedMoveId;
    if (!moveId) return;
    const { model, insertedCommentId } = insertCommentAroundMoveFn(state.pgnModel, moveId, position, rawText);
    applyPgnModelUpdate(model, insertedCommentId);
  };

  /**
   * Build text editor callback/options object.
   *
   * @returns {object} Editor option callbacks and selection/highlight values.
   */
  const getTextEditorOptions = () => ({
    layoutMode: state.pgnLayoutMode === "plain" || state.pgnLayoutMode === "text" || state.pgnLayoutMode === "tree"
      ? state.pgnLayoutMode
      : "plain",
    highlightCommentId: state.pendingFocusCommentId,
    selectedMoveId: state.selectedMoveId,
    onResolveExistingComment: (moveId, position) => findExistingCommentIdAroundMoveFn(state.pgnModel, moveId, position),
    onCommentEdit: (commentId, editedText) => {
      const nextModel = !editedText.trim()
        ? removeCommentByIdFn(state.pgnModel, commentId)
        : setCommentTextByIdFn(state.pgnModel, commentId, editedText);
      applyPgnModelUpdate(nextModel);
    },
    onCommentFocus: (commentId, opts: { focusFirstCommentAtStart?: boolean } = {}) => {
      const { focusFirstCommentAtStart } = opts;
      if (focusFirstCommentAtStart) {
        state.selectedMoveId = null;
        state.boardPreview = null;
        state.animationRunId += 1;
        state.isAnimating = false;
        state.currentPly = 0;
        onRender();
        return;
      }
      const owningMoveId = resolveOwningMoveIdForCommentFn(state.pgnModel, commentId);
      if (!owningMoveId) return;
      selectMoveById(owningMoveId);
    },
    onInsertComment: (moveId, position) => {
      const { model, insertedCommentId, created } = insertCommentAroundMoveFn(state.pgnModel, moveId, position, "");
      state.selectedMoveId = moveId;
      state.pendingFocusCommentId = insertedCommentId;
      if (!created) {
        onRender();
        return;
      }
      applyPgnModelUpdate(model, insertedCommentId);
    },
    onMoveSelect: (moveId) => {
      selectMoveById(moveId);
    },
  });

  return {
    focusCommentById,
    formatFocusedComment,
    getTextEditorOptions,
    insertAroundSelectedMove,
    selectMoveById,
  };
};
