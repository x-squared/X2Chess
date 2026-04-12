/**
 * useTodoDialog — TODO annotation dialog state for PgnTextEditor.
 *
 * Manages the open/close lifecycle and save/edit handlers for the TODO
 * annotation insert/edit dialog.
 *
 * Integration API:
 * - `const { todoDialog, handleEditTodo, handleInsertTodo, handleTodoDialogSave,
 *     handleTodoDialogClose, handleDeleteTodo } = useTodoDialog(services)`
 *   — call inside PgnTextEditor.
 *
 * Communication API:
 * - Inbound: calls `services.saveCommentText` and `services.insertComment`.
 * - Outbound: `todoDialog` state for conditional rendering of `<TodoInsertDialog>`.
 */

import { useState, useCallback } from "react";
import { parseTodoAnnotations, replaceTodoAnnotation, appendTodoAnnotation } from "../../resources/services/todo_parser";
import type { TodoAnnotation } from "../../resources/services/todo_parser";
import type { AppStartupServices } from "../../../core/contracts/app_services";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TodoDialogState = {
  /** ID of the comment being edited/created. */
  commentId: string;
  /** Raw text of the comment (for edit). */
  rawText: string;
  /** Index of the annotation being edited, or -1 for insert. */
  editIndex: number;
  /** Pre-filled value when editing. */
  initial?: TodoAnnotation;
};

export type UseTodoDialogResult = {
  todoDialog: TodoDialogState | null;
  handleEditTodo: (commentId: string, index: number, rawText: string) => void;
  handleInsertTodo: (moveId: string) => void;
  handleTodoDialogSave: (moveId: string, annotation: TodoAnnotation) => void;
  handleTodoDialogClose: () => void;
  handleDeleteTodo: (commentId: string, index: number, rawText: string) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useTodoDialog = (services: AppStartupServices): UseTodoDialogResult => {
  const [todoDialog, setTodoDialog] = useState<TodoDialogState | null>(null);

  const handleEditTodo = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const annotations = parseTodoAnnotations(rawText);
      setTodoDialog({ commentId, rawText, editIndex: index, initial: annotations[index] });
    },
    [],
  );

  const handleInsertTodo = useCallback(
    (moveId: string): void => {
      const comment = services.insertComment(moveId, "after");
      if (!comment) return;
      setTodoDialog({ commentId: comment.id, rawText: comment.rawText, editIndex: -1, initial: undefined });
    },
    [services],
  );

  const handleTodoDialogSave = useCallback(
    (_moveId: string, annotation: TodoAnnotation): void => {
      if (!todoDialog) return;
      if (todoDialog.commentId && todoDialog.editIndex >= 0) {
        const updated = replaceTodoAnnotation(todoDialog.rawText, todoDialog.editIndex, annotation);
        services.saveCommentText(todoDialog.commentId, updated);
      } else if (todoDialog.commentId) {
        const updated = appendTodoAnnotation(todoDialog.rawText, annotation);
        services.saveCommentText(todoDialog.commentId, updated);
      }
      setTodoDialog(null);
    },
    [todoDialog, services],
  );

  const handleTodoDialogClose = useCallback((): void => {
    setTodoDialog(null);
  }, []);

  const handleDeleteTodo = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const updated = replaceTodoAnnotation(rawText, index, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  return { todoDialog, handleEditTodo, handleInsertTodo, handleTodoDialogSave, handleTodoDialogClose, handleDeleteTodo };
};
