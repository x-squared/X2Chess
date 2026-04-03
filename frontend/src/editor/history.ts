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
 * - This module communicates through `sessionRef.current`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import type { ActiveSessionRef } from "../game_sessions/game_session_state";

type EditorSnapshot = {
  pgnModel: unknown;
  pgnText: string;
  currentPly: number;
  selectedMoveId: string | null;
  pgnLayoutMode: string;
};

type EditorHistoryDeps = {
  sessionRef: ActiveSessionRef;
  pgnInput: Element | null;
  onSyncChessParseState: (source: string) => void;
  onRender: () => void;
  historyLimit?: number;
};

export const createEditorHistoryCapabilities = ({
  sessionRef,
  pgnInput,
  onSyncChessParseState,
  onRender,
  historyLimit = 200,
}: EditorHistoryDeps) => {
  const cloneModelState = <TValue>(model: TValue): TValue => structuredClone(model);

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
    const undoStack = sessionRef.current.undoStack as EditorSnapshot[];
    undoStack.push(snapshot);
    if (undoStack.length > historyLimit) undoStack.shift();
  };

  const applyEditorSnapshot = (snapshot: EditorSnapshot | null | undefined): void => {
    if (!snapshot) return;
    const g = sessionRef.current;
    g.animationRunId += 1;
    g.isAnimating = false;
    g.boardPreview = null;
    g.pgnModel = cloneModelState(snapshot.pgnModel) as typeof g.pgnModel;
    g.pgnText = snapshot.pgnText;
    g.currentPly = snapshot.currentPly;
    g.selectedMoveId = snapshot.selectedMoveId ?? null;
    g.pgnLayoutMode = snapshot.pgnLayoutMode;
    if (pgnInput instanceof HTMLTextAreaElement) pgnInput.value = g.pgnText;
    onSyncChessParseState(g.pgnText);
    onRender();
  };

  const performUndo = (): void => {
    const g = sessionRef.current;
    const undoStack = g.undoStack as EditorSnapshot[];
    if (undoStack.length === 0) return;
    const previous: EditorSnapshot | undefined = undoStack.pop();
    (g.redoStack as EditorSnapshot[]).push(captureEditorSnapshot());
    applyEditorSnapshot(previous);
  };

  const performRedo = (): void => {
    const g = sessionRef.current;
    const redoStack = g.redoStack as EditorSnapshot[];
    if (redoStack.length === 0) return;
    const next: EditorSnapshot | undefined = redoStack.pop();
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
