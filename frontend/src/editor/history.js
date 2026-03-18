/**
 * Editor history component.
 *
 * Integration API:
 * - `createEditorHistoryCapabilities(deps)` returns undo/redo capabilities.
 *
 * Configuration API:
 * - `deps.historyLimit` controls maximum undo stack size.
 *
 * Communication API:
 * - Mutates shared editor state and invokes host sync/render callbacks after restore.
 */

/**
 * Create editor history capabilities for undo/redo and snapshot restore.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state object.
 * @param {HTMLTextAreaElement|null} deps.pgnInput - PGN textarea element.
 * @param {Function} deps.onSyncChessParseState - Callback `(source: string) => void` to rebuild parse state.
 * @param {Function} deps.onRender - Callback to re-render UI.
 * @param {number} [deps.historyLimit=200] - Maximum undo snapshot count to retain.
 * @returns {object} History capability methods.
 */
export const createEditorHistoryCapabilities = ({
  state,
  pgnInput,
  onSyncChessParseState,
  onRender,
  historyLimit = 200,
}) => {
  /**
   * Deep-clone PGN model snapshot state.
   *
   * @param {object} model - PGN model object.
   * @returns {object} Cloned model.
   */
  const cloneModelState = (model) => JSON.parse(JSON.stringify(model));

  /**
   * Capture current editor snapshot.
   *
   * @returns {{pgnModel: object, pgnText: string, currentPly: number, selectedMoveId: (string|null)}} Snapshot object.
   */
  const captureEditorSnapshot = () => ({
    pgnModel: cloneModelState(state.pgnModel),
    pgnText: state.pgnText,
    currentPly: state.currentPly,
    selectedMoveId: state.selectedMoveId,
  });

  /**
   * Push snapshot onto undo stack and enforce size cap.
   *
   * @param {object} snapshot - Snapshot captured by `captureEditorSnapshot`.
   */
  const pushUndoSnapshot = (snapshot) => {
    state.undoStack.push(snapshot);
    if (state.undoStack.length > historyLimit) state.undoStack.shift();
  };

  /**
   * Apply a snapshot into state, then rebuild parse state and render.
   *
   * @param {object|null|undefined} snapshot - Snapshot to restore.
   */
  const applyEditorSnapshot = (snapshot) => {
    if (!snapshot) return;
    state.animationRunId += 1;
    state.isAnimating = false;
    state.boardPreview = null;
    state.pgnModel = cloneModelState(snapshot.pgnModel);
    state.pgnText = snapshot.pgnText;
    state.currentPly = snapshot.currentPly;
    state.selectedMoveId = snapshot.selectedMoveId ?? null;
    if (pgnInput) pgnInput.value = state.pgnText;
    onSyncChessParseState(state.pgnText);
    onRender();
  };

  /**
   * Restore previous snapshot from undo stack and push current state to redo.
   */
  const performUndo = () => {
    if (state.undoStack.length === 0) return;
    const previous = state.undoStack.pop();
    state.redoStack.push(captureEditorSnapshot());
    applyEditorSnapshot(previous);
  };

  /**
   * Restore next snapshot from redo stack and push current state to undo.
   */
  const performRedo = () => {
    if (state.redoStack.length === 0) return;
    const next = state.redoStack.pop();
    pushUndoSnapshot(captureEditorSnapshot());
    applyEditorSnapshot(next);
  };

  return {
    captureEditorSnapshot,
    performRedo,
    performUndo,
    pushUndoSnapshot,
  };
};
