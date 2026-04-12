/**
 * useQaDialog — Q/A annotation dialog state for PgnTextEditor.
 *
 * Manages the open/close lifecycle and save/edit handlers for the Q/A
 * annotation insert/edit dialog (UV10/UV11).
 * 
 * 
 * The Q/A dialog alows to add questionss and answres to moves which may be 
 * used to generate study prompts.
 *
 * Integration API:
 * - `const { qaDialog, handleEditQa, handleInsertQa, handleQaDialogSave, handleQaDialogClose }
 *     = useQaDialog(services)` — call inside PgnTextEditor.
 *
 * Communication API:
 * - Inbound: calls `services.saveCommentText` and `services.insertComment`.
 * - Outbound: `qaDialog` state for conditional rendering of `<QaInsertDialog>`.
 */

import { useState, useCallback } from "react";
import { parseQaAnnotations, replaceQaAnnotation, appendQaAnnotation } from "../../resources/services/qa_parser";
import type { QaAnnotation } from "../../resources/services/qa_parser";
import type { AppStartupServices } from "../../../core/contracts/app_services";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QaDialogState = {
  /** ID of the comment being edited/created. */
  commentId: string;
  /** Raw text of the comment (for edit). */
  rawText: string;
  /** Index of the annotation being edited, or -1 for insert. */
  editIndex: number;
  /** Pre-filled values when editing. */
  initial?: QaAnnotation;
};

export type UseQaDialogResult = {
  qaDialog: QaDialogState | null;
  handleEditQa: (commentId: string, index: number, rawText: string) => void;
  handleInsertQa: (moveId: string) => void;
  handleQaDialogSave: (moveId: string, annotation: QaAnnotation) => void;
  handleQaDialogClose: () => void;
  handleDeleteQa: (commentId: string, index: number, rawText: string) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useQaDialog = (services: AppStartupServices): UseQaDialogResult => {
  const [qaDialog, setQaDialog] = useState<QaDialogState | null>(null);

  const handleEditQa = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const annotations = parseQaAnnotations(rawText);
      setQaDialog({ commentId, rawText, editIndex: index, initial: annotations[index] });
    },
    [],
  );

  const handleInsertQa = useCallback(
    (moveId: string): void => {
      // Create (or find) the comment first so we have its ID and current raw text.
      const comment = services.insertComment(moveId, "after");
      if (!comment) return;
      setQaDialog({ commentId: comment.id, rawText: comment.rawText, editIndex: -1, initial: undefined });
    },
    [services],
  );

  const handleQaDialogSave = useCallback(
    (_moveId: string, annotation: QaAnnotation): void => {
      if (!qaDialog) return;
      if (qaDialog.commentId && qaDialog.editIndex >= 0) {
        const updated = replaceQaAnnotation(qaDialog.rawText, qaDialog.editIndex, annotation);
        services.saveCommentText(qaDialog.commentId, updated);
      } else if (qaDialog.commentId) {
        const updated = appendQaAnnotation(qaDialog.rawText, annotation);
        services.saveCommentText(qaDialog.commentId, updated);
      }
      setQaDialog(null);
    },
    [qaDialog, services],
  );

  const handleQaDialogClose = useCallback((): void => {
    setQaDialog(null);
  }, []);

  const handleDeleteQa = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const updated = replaceQaAnnotation(rawText, index, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  return { qaDialog, handleEditQa, handleInsertQa, handleQaDialogSave, handleQaDialogClose, handleDeleteQa };
};
