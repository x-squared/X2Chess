import type { MovePositionRecord, PgnModelForMoves } from "../board/move_position";

/**
 * Selection Runtime module.
 *
 * Integration API:
 * - Primary exports from this module: `createSelectionRuntimeCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult;
}["bivarianceHack"];

type SelectionState = {
  selectedMoveId: string | null;
  pgnModel: unknown;
  moves: string[];
  currentPly: number;
  boardPreview: { fen?: string; lastMove?: [string, string] | null } | null;
  animationRunId: number;
  isAnimating: boolean;
  pendingFocusCommentId: string | null;
  pgnLayoutMode: string;
};

type MovePosition = MovePositionRecord;

type InsertCommentResult = {
  model: unknown;
  insertedCommentId: string | null;
  created?: boolean;
};

type SelectionRuntimeDeps = {
  state: SelectionState;
  textEditorEl: Element | null;
  getMovePositionById: (moveId: string | null, options: { allowResolve: boolean }) => MovePosition | null;
  buildMainlinePlyByMoveIdFn: (pgnModel: PgnModelForMoves) => Record<string, number>;
  findExistingCommentIdAroundMoveFn: BivariantCallback<[pgnModel: unknown, moveId: string, position: "before" | "after"], string | null>;
  insertCommentAroundMoveFn: BivariantCallback<[pgnModel: unknown, moveId: string, position: "before" | "after", rawText: string], InsertCommentResult>;
  removeCommentByIdFn: (pgnModel: unknown, commentId: string) => unknown;
  setCommentTextByIdFn: (pgnModel: unknown, commentId: string, text: string) => unknown;
  resolveOwningMoveIdForCommentFn: (pgnModel: unknown, commentId: string) => string | null;
  applyPgnModelUpdate: (nextModel: unknown, focusCommentId?: string | null, options?: Record<string, unknown>) => void;
  onRender: () => void;
};

type EditorOptions = {
  layoutMode: "plain" | "text" | "tree";
  highlightCommentId: string | null;
  selectedMoveId: string | null;
  onResolveExistingComment: (moveId: string, position: string) => string | null;
  onCommentEdit: (commentId: string, editedText: string) => void;
  onCommentFocus: (commentId: string, opts?: { focusFirstCommentAtStart?: boolean }) => void;
  onInsertComment: (moveId: string, position: string) => void;
  onMoveSelect: (moveId: string) => void;
};

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
}: SelectionRuntimeDeps) => {
  const runtimeState: SelectionState = state;

  const selectMoveById = (moveId: string): boolean => {
    runtimeState.selectedMoveId = moveId;
    const target: MovePosition | null = getMovePositionById(moveId, { allowResolve: true });
    if (!target) {
      const mainlinePlyByMoveId: Record<string, number> = buildMainlinePlyByMoveIdFn(runtimeState.pgnModel as PgnModelForMoves);
      const fallbackPly: number | undefined = mainlinePlyByMoveId?.[moveId];
      if (Number.isInteger(fallbackPly)) {
        runtimeState.animationRunId += 1;
        runtimeState.isAnimating = false;
        runtimeState.boardPreview = null;
        runtimeState.currentPly = Math.max(0, Math.min(fallbackPly as number, runtimeState.moves.length));
        onRender();
        return true;
      }
      runtimeState.boardPreview = null;
      onRender();
      return true;
    }
    if (Number.isInteger(target.mainlinePly)) {
      if (target.mainlinePly === runtimeState.currentPly) {
        runtimeState.boardPreview = null;
        onRender();
        return true;
      }
      runtimeState.animationRunId += 1;
      runtimeState.isAnimating = false;
      runtimeState.boardPreview = null;
      runtimeState.currentPly = target.mainlinePly as number;
      onRender();
      return true;
    }
    runtimeState.boardPreview = {
      fen: target.fen,
      lastMove: target.lastMove,
    };
    onRender();
    return true;
  };

  const focusCommentById = (commentId: string | null | undefined): boolean => {
    if (!(textEditorEl instanceof HTMLElement) || !commentId) return false;
    const el: Element | null = textEditorEl.querySelector(`[data-comment-id="${commentId}"]`);
    if (!(el instanceof HTMLElement)) return false;
    el.focus();
    const selection: Selection | null = window.getSelection();
    if (!selection) return true;
    const range: Range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const formatFocusedComment = (style: string): boolean => {
    if (!(textEditorEl instanceof HTMLElement)) return false;
    const allowedStyles: Set<string> = new Set(["bold", "italic", "underline"]);
    const command: string | null = allowedStyles.has(style) ? style : null;
    if (!command) return false;

    const selection: Selection | null = window.getSelection();
    let anchorElement: Element | null = null;
    if (selection?.anchorNode instanceof Element) {
      anchorElement = selection.anchorNode;
    } else if (selection?.anchorNode instanceof Node) {
      anchorElement = selection.anchorNode.parentElement;
    } else if (document.activeElement instanceof Element) {
      anchorElement = document.activeElement;
    }
    const commentEl: Element | null = anchorElement?.closest?.('[data-kind="comment"][contenteditable="true"]') ?? null;
    if (!(commentEl instanceof HTMLElement)) return false;
    commentEl.focus();
    document.execCommand(command);
    return true;
  };

  const insertAroundSelectedMove = (position: "before" | "after", rawText: string = ""): void => {
    const moveId: string | null = runtimeState.selectedMoveId;
    if (!moveId) return;
    const { model, insertedCommentId }: InsertCommentResult = insertCommentAroundMoveFn(runtimeState.pgnModel, moveId, position, rawText);
    applyPgnModelUpdate(model, insertedCommentId);
  };

  const getTextEditorOptions = (): EditorOptions => ({
    layoutMode: runtimeState.pgnLayoutMode === "plain" || runtimeState.pgnLayoutMode === "text" || runtimeState.pgnLayoutMode === "tree"
      ? runtimeState.pgnLayoutMode
      : "plain",
    highlightCommentId: runtimeState.pendingFocusCommentId,
    selectedMoveId: runtimeState.selectedMoveId,
    onResolveExistingComment: (moveId: string, position: string): string | null => {
      const safePosition: "before" | "after" = position === "before" ? "before" : "after";
      return findExistingCommentIdAroundMoveFn(runtimeState.pgnModel, moveId, safePosition);
    },
    onCommentEdit: (commentId: string, editedText: string): void => {
      const nextModel: unknown = !editedText.trim()
        ? removeCommentByIdFn(runtimeState.pgnModel, commentId)
        : setCommentTextByIdFn(runtimeState.pgnModel, commentId, editedText);
      applyPgnModelUpdate(nextModel);
    },
    onCommentFocus: (commentId: string, opts: { focusFirstCommentAtStart?: boolean } = {}): void => {
      const { focusFirstCommentAtStart } = opts;
      if (focusFirstCommentAtStart) {
        runtimeState.selectedMoveId = null;
        runtimeState.boardPreview = null;
        runtimeState.animationRunId += 1;
        runtimeState.isAnimating = false;
        runtimeState.currentPly = 0;
        onRender();
        return;
      }
      const owningMoveId: string | null = resolveOwningMoveIdForCommentFn(runtimeState.pgnModel, commentId);
      if (!owningMoveId) return;
      selectMoveById(owningMoveId);
    },
    onInsertComment: (moveId: string, position: string): void => {
      const safePosition: "before" | "after" = position === "before" ? "before" : "after";
      const { model, insertedCommentId, created }: InsertCommentResult = insertCommentAroundMoveFn(runtimeState.pgnModel, moveId, safePosition, "");
      runtimeState.selectedMoveId = moveId;
      runtimeState.pendingFocusCommentId = insertedCommentId;
      if (!created) {
        onRender();
        return;
      }
      applyPgnModelUpdate(model, insertedCommentId);
    },
    onMoveSelect: (moveId: string): void => {
      selectMoveById(moveId);
    },
  });

  return {
    getMovePositionById,
    focusCommentById,
    formatFocusedComment,
    getTextEditorOptions,
    insertAroundSelectedMove,
    selectMoveById,
  };
};
