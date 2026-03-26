/**
 * useAnchorRefDialog — anchor reference picker dialog state for PgnTextEditor.
 *
 * Manages the open/close lifecycle and save/delete handlers for the anchor
 * reference insertion/edit dialog.
 *
 * Integration API:
 * - `const { anchorRefDialog, handleOpenAnchorRefDialog, handleEditAnchorRef,
 *     handleConfirmAnchorRef, handleDeleteAnchorRef, handleCloseAnchorRefDialog }
 *     = useAnchorRefDialog(services)` — call inside PgnTextEditor.
 *
 * Communication API:
 * - Inbound: calls `services.saveCommentText`.
 * - Outbound: `anchorRefDialog` state for conditional rendering of `<AnchorPickerDialog>`.
 */

import { useState, useCallback } from "react";
import {
  replaceAnchorRefAnnotation,
  appendAnchorRefAnnotation,
} from "../resources_viewer/anchor_parser";
import type { AppStartupServices } from "../state/ServiceContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnchorRefDialogState = {
  /** Comment node ID that will receive the `[%anchorref ...]`. */
  commentId: string;
  /** Current raw text of that comment. */
  rawText: string;
  /** Index of the annotation being edited (-1 for insert). */
  editIndex: number;
  /** ID of the anchor currently referenced (pre-selected row when editing). */
  currentId?: string;
};

export type UseAnchorRefDialogResult = {
  anchorRefDialog: AnchorRefDialogState | null;
  /** Open the picker to insert a new anchor reference into a comment. */
  handleOpenAnchorRefDialog: (commentId: string, rawText: string) => void;
  /** Open the picker to edit an existing anchor reference at `index`. */
  handleEditAnchorRef: (commentId: string, index: number, rawText: string, currentId: string) => void;
  /** Confirm the selected anchor ID and write `[%anchorref id="..."]` to the comment. */
  handleConfirmAnchorRef: (anchorId: string) => void;
  /** Delete the anchor reference at `index` in `rawText`. */
  handleDeleteAnchorRef: (commentId: string, index: number, rawText: string) => void;
  handleCloseAnchorRefDialog: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAnchorRefDialog = (services: AppStartupServices): UseAnchorRefDialogResult => {
  const [anchorRefDialog, setAnchorRefDialog] = useState<AnchorRefDialogState | null>(null);

  const handleOpenAnchorRefDialog = useCallback(
    (commentId: string, rawText: string): void => {
      setAnchorRefDialog({ commentId, rawText, editIndex: -1 });
    },
    [],
  );

  const handleEditAnchorRef = useCallback(
    (commentId: string, index: number, rawText: string, currentId: string): void => {
      setAnchorRefDialog({ commentId, rawText, editIndex: index, currentId });
    },
    [],
  );

  const handleConfirmAnchorRef = useCallback(
    (anchorId: string): void => {
      if (!anchorRefDialog) return;
      let updated: string;
      if (anchorRefDialog.editIndex >= 0) {
        updated = replaceAnchorRefAnnotation(
          anchorRefDialog.rawText,
          anchorRefDialog.editIndex,
          { id: anchorId },
        );
      } else {
        updated = appendAnchorRefAnnotation(anchorRefDialog.rawText, { id: anchorId });
      }
      services.saveCommentText(anchorRefDialog.commentId, updated);
      setAnchorRefDialog(null);
    },
    [anchorRefDialog, services],
  );

  const handleDeleteAnchorRef = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const updated = replaceAnchorRefAnnotation(rawText, index, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  const handleCloseAnchorRefDialog = useCallback((): void => {
    setAnchorRefDialog(null);
  }, []);

  return {
    anchorRefDialog,
    handleOpenAnchorRefDialog,
    handleEditAnchorRef,
    handleConfirmAnchorRef,
    handleDeleteAnchorRef,
    handleCloseAnchorRefDialog,
  };
};
