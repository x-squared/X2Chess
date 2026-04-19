/**
 * History module.
 *
 * Integration API:
 * - Primary exports from this module: `createEditorHistoryCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `sessionRef`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - State changes are reported via typed callbacks rather than a generic `onRender`.
 * - Undo/redo stacks live in `sessionRef.current` so each session retains its own
 *   history when the active session is switched.
 */

import type { ActiveSessionRef } from "../../sessions/services/game_session_state";
import type { LayoutMode } from "./plan/types";

type EditorSnapshot = {
  pgnModel: unknown;
  pgnText: string;
  currentPly: number;
  selectedMoveId: string | null;
  pgnLayoutMode: LayoutMode;
};

type EditorHistoryDeps = {
  sessionRef: ActiveSessionRef;
  pgnInput: Element | null;
  onSyncChessParseState: (source: string) => void;
  /** Called after undo/redo restores PGN/session state and should mirror to React. */
  onPgnChange: (pgnText: string, pgnModel: unknown, moves: string[]) => void;
  /** Called whenever the undo or redo stack depth changes. */
  onUndoRedoDepthChange: (undoDepth: number, redoDepth: number) => void;
  historyLimit?: number;
};

export const createEditorHistoryCapabilities = ({
  sessionRef,
  pgnInput,
  onSyncChessParseState,
  onPgnChange,
  onUndoRedoDepthChange,
  historyLimit = 200,
}: EditorHistoryDeps) => {
  const cloneModelState = <TValue>(model: TValue): TValue => structuredClone(model);

  const getUndoStack = (): EditorSnapshot[] => sessionRef.current.undoStack as EditorSnapshot[];
  const getRedoStack = (): EditorSnapshot[] => sessionRef.current.redoStack as EditorSnapshot[];

  const captureEditorSnapshot = (): EditorSnapshot => {
    const g = sessionRef.current;
    return {
      pgnModel: cloneModelState(g.pgnModel),
      pgnText: g.pgnText,
      currentPly: g.currentPly,
      selectedMoveId: g.selectedMoveId,
      pgnLayoutMode: g.pgnLayoutMode,
    };
  };

  const pushUndoSnapshot = (snapshot: EditorSnapshot): void => {
    const undoStack = getUndoStack();
    undoStack.push(snapshot);
    if (undoStack.length > historyLimit) undoStack.shift();
    onUndoRedoDepthChange(undoStack.length, getRedoStack().length);
  };

  /** Clear the redo stack — call when a new edit is recorded so redo is no longer valid. */
  const clearRedoStack = (): void => {
    getRedoStack().length = 0;
    onUndoRedoDepthChange(getUndoStack().length, 0);
  };

  const applyEditorSnapshot = (snapshot: EditorSnapshot | null | undefined): void => {
    if (!snapshot) return;
    const g = sessionRef.current;
    g.boardPreview = null;
    g.pgnModel = cloneModelState(snapshot.pgnModel) as typeof g.pgnModel;
    g.pgnText = snapshot.pgnText;
    g.currentPly = snapshot.currentPly;
    g.selectedMoveId = snapshot.selectedMoveId ?? null;
    g.pgnLayoutMode = snapshot.pgnLayoutMode;
    if (pgnInput instanceof HTMLTextAreaElement) pgnInput.value = g.pgnText;
    onSyncChessParseState(g.pgnText);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
  };

  const performUndo = (): void => {
    const undoStack = getUndoStack();
    const redoStack = getRedoStack();
    if (undoStack.length === 0) return;
    const previous: EditorSnapshot | undefined = undoStack.pop();
    redoStack.push(captureEditorSnapshot());
    applyEditorSnapshot(previous);
    onUndoRedoDepthChange(undoStack.length, redoStack.length);
  };

  const performRedo = (): void => {
    const undoStack = getUndoStack();
    const redoStack = getRedoStack();
    if (redoStack.length === 0) return;
    const next: EditorSnapshot | undefined = redoStack.pop();
    undoStack.push(captureEditorSnapshot());
    if (undoStack.length > historyLimit) undoStack.shift();
    applyEditorSnapshot(next);
    onUndoRedoDepthChange(undoStack.length, redoStack.length);
  };

  return {
    captureEditorSnapshot,
    clearRedoStack,
    performRedo,
    performUndo,
    pushUndoSnapshot,
  };
};
