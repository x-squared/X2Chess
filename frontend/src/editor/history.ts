/**
 * History module.
 *
 * Integration API:
 * - Primary exports from this module: `createEditorHistoryCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type EditorSnapshot = {
  pgnModel: unknown;
  pgnText: string;
  currentPly: number;
  selectedMoveId: string | null;
};

type EditorHistoryState = {
  pgnModel: unknown;
  pgnText: string;
  currentPly: number;
  selectedMoveId: string | null;
  animationRunId: number;
  isAnimating: boolean;
  boardPreview: unknown | null;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
};

type EditorHistoryDeps = {
  state: Record<string, unknown>;
  pgnInput: Element | null;
  onSyncChessParseState: (source: string) => void;
  onRender: () => void;
  historyLimit?: number;
};

export const createEditorHistoryCapabilities = ({
  state,
  pgnInput,
  onSyncChessParseState,
  onRender,
  historyLimit = 200,
}: EditorHistoryDeps) => {
  const runtimeState: EditorHistoryState = state as EditorHistoryState;

  const cloneModelState = <TValue>(model: TValue): TValue => JSON.parse(JSON.stringify(model)) as TValue;

  const captureEditorSnapshot = (): EditorSnapshot => ({
    pgnModel: cloneModelState(runtimeState.pgnModel),
    pgnText: runtimeState.pgnText,
    currentPly: runtimeState.currentPly,
    selectedMoveId: runtimeState.selectedMoveId,
  });

  const pushUndoSnapshot = (snapshot: EditorSnapshot): void => {
    runtimeState.undoStack.push(snapshot);
    if (runtimeState.undoStack.length > historyLimit) runtimeState.undoStack.shift();
  };

  const applyEditorSnapshot = (snapshot: EditorSnapshot | null | undefined): void => {
    if (!snapshot) return;
    runtimeState.animationRunId += 1;
    runtimeState.isAnimating = false;
    runtimeState.boardPreview = null;
    runtimeState.pgnModel = cloneModelState(snapshot.pgnModel);
    runtimeState.pgnText = snapshot.pgnText;
    runtimeState.currentPly = snapshot.currentPly;
    runtimeState.selectedMoveId = snapshot.selectedMoveId ?? null;
    if (pgnInput instanceof HTMLTextAreaElement) pgnInput.value = runtimeState.pgnText;
    onSyncChessParseState(runtimeState.pgnText);
    onRender();
  };

  const performUndo = (): void => {
    if (runtimeState.undoStack.length === 0) return;
    const previous: EditorSnapshot | undefined = runtimeState.undoStack.pop();
    runtimeState.redoStack.push(captureEditorSnapshot());
    applyEditorSnapshot(previous);
  };

  const performRedo = (): void => {
    if (runtimeState.redoStack.length === 0) return;
    const next: EditorSnapshot | undefined = runtimeState.redoStack.pop();
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
