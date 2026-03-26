/**
 * useAnchorDefDialog — anchor definition dialog state for PgnTextEditor.
 *
 * Manages the open/close lifecycle and save/edit/delete handlers for the anchor
 * definition insert/edit dialog.
 *
 * Integration API:
 * - `const { anchorDefDialog, handleOpenAnchorDefDialog, handleEditAnchorDef,
 *     handleConfirmAnchorDef, handleDeleteAnchorDef, handleCloseAnchorDefDialog }
 *     = useAnchorDefDialog(services)` — call inside PgnTextEditor.
 *
 * Communication API:
 * - Inbound: calls `services.insertComment` and `services.saveCommentText`.
 * - Outbound: `anchorDefDialog` state for conditional rendering of `<AnchorDefDialog>`.
 */

import { useState, useCallback } from "react";
import {
  parseAnchorAnnotations,
  replaceAnchorAnnotation,
  appendAnchorAnnotation,
} from "../resources_viewer/anchor_parser";
import type { AnchorAnnotation } from "../resources_viewer/anchor_parser";
import type { AppStartupServices } from "../state/ServiceContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnchorDefDialogState = {
  /** Move node ID where the anchor is/will be placed. */
  moveId: string;
  /** ID of the comment to modify/create. */
  commentId: string;
  /** Current raw text of that comment. */
  rawText: string;
  /** Pre-filled values when editing an existing anchor. -1 for insert. */
  editIndex: number;
  /** Initial values when editing. */
  initial?: AnchorAnnotation;
  /** Suggested ID (pre-filled for insert; ignored for edit). */
  suggestedId: string;
};

export type UseAnchorDefDialogResult = {
  anchorDefDialog: AnchorDefDialogState | null;
  /** Open dialog to place a new anchor after `moveId`. */
  handleOpenAnchorDefDialog: (moveId: string, moveSan: string) => void;
  /** Open dialog to edit the anchor at `index` in `rawText`. */
  handleEditAnchorDef: (commentId: string, index: number, rawText: string, moveId: string) => void;
  /** Confirm placement or edit: append/replace the anchor in the comment. */
  handleConfirmAnchorDef: (annotation: AnchorAnnotation) => void;
  /** Delete the anchor at `index` in `rawText`. */
  handleDeleteAnchorDef: (commentId: string, index: number, rawText: string) => void;
  handleCloseAnchorDefDialog: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Build a suggested anchor ID from a move SAN (e.g. "Nd5" → "Nd5-1"). */
const buildSuggestedId = (moveSan: string, existingIds: Set<string>): string => {
  const base: string = moveSan.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "anchor";
  if (!existingIds.has(base)) return base;
  for (let n = 2; n <= 99; n += 1) {
    const candidate: string = `${base}${n}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
};

export const useAnchorDefDialog = (services: AppStartupServices): UseAnchorDefDialogResult => {
  const [anchorDefDialog, setAnchorDefDialog] = useState<AnchorDefDialogState | null>(null);

  const handleOpenAnchorDefDialog = useCallback(
    (moveId: string, moveSan: string): void => {
      const comment = services.insertComment(moveId, "after");
      if (!comment) return;
      setAnchorDefDialog({
        moveId,
        commentId: comment.id,
        rawText: comment.rawText,
        editIndex: -1,
        initial: undefined,
        suggestedId: buildSuggestedId(moveSan, new Set()),
      });
    },
    [services],
  );

  const handleEditAnchorDef = useCallback(
    (commentId: string, index: number, rawText: string, moveId: string): void => {
      const annotations = parseAnchorAnnotations(rawText);
      setAnchorDefDialog({
        moveId,
        commentId,
        rawText,
        editIndex: index,
        initial: annotations[index],
        suggestedId: "",
      });
    },
    [],
  );

  const handleConfirmAnchorDef = useCallback(
    (annotation: AnchorAnnotation): void => {
      if (!anchorDefDialog) return;
      let updated: string;
      if (anchorDefDialog.editIndex >= 0) {
        updated = replaceAnchorAnnotation(
          anchorDefDialog.rawText,
          anchorDefDialog.editIndex,
          annotation,
        );
      } else {
        updated = appendAnchorAnnotation(anchorDefDialog.rawText, annotation);
      }
      services.saveCommentText(anchorDefDialog.commentId, updated);
      setAnchorDefDialog(null);
    },
    [anchorDefDialog, services],
  );

  const handleDeleteAnchorDef = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const updated = replaceAnchorAnnotation(rawText, index, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  const handleCloseAnchorDefDialog = useCallback((): void => {
    setAnchorDefDialog(null);
  }, []);

  return {
    anchorDefDialog,
    handleOpenAnchorDefDialog,
    handleEditAnchorDef,
    handleConfirmAnchorDef,
    handleDeleteAnchorDef,
    handleCloseAnchorDefDialog,
  };
};
