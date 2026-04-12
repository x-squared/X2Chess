/**
 * useTrainDialog — `[%train]` annotation dialog state for PgnTextEditor.
 *
 * Manages the open/close lifecycle and save/edit/delete handlers for the
 * `[%train]` annotation insert/edit dialog.
 *
 * Integration API:
 * - `const { trainDialog, handleEditTrain, handleInsertTrain,
 *            handleTrainDialogSave, handleTrainDialogClose, handleDeleteTrain }
 *     = useTrainDialog(services)` — call inside PgnTextEditor.
 *
 * Communication API:
 * - Inbound: calls `services.saveCommentText` and `services.insertComment`.
 * - Outbound: `trainDialog` state for conditional rendering of `<TrainInsertDialog>`.
 */

import { useState, useCallback } from "react";
import {
  parseTrainTag,
  replaceTrainTag,
  appendTrainTag,
} from "../../resources/services/train_tag_parser";
import type { TrainTag } from "../../resources/services/train_tag_parser";
import type { AppStartupServices } from "../../../core/contracts/app_services";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TrainDialogState = {
  commentId: string;
  rawText: string;
  initial?: TrainTag;
};

export type UseTrainDialogResult = {
  trainDialog: TrainDialogState | null;
  handleEditTrain: (commentId: string, rawText: string) => void;
  handleInsertTrain: (moveId: string) => void;
  handleTrainDialogSave: (tag: TrainTag) => void;
  handleTrainDialogClose: () => void;
  handleDeleteTrain: (commentId: string, rawText: string) => void;
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export const useTrainDialog = (services: AppStartupServices): UseTrainDialogResult => {
  const [trainDialog, setTrainDialog] = useState<TrainDialogState | null>(null);

  const handleEditTrain = useCallback(
    (commentId: string, rawText: string): void => {
      const existing = parseTrainTag(rawText);
      setTrainDialog({ commentId, rawText, initial: existing ?? undefined });
    },
    [],
  );

  const handleInsertTrain = useCallback(
    (moveId: string): void => {
      // The [%train] tag must live in the comment *before* the move.
      const comment = services.insertComment(moveId, "before");
      if (!comment) return;
      setTrainDialog({ commentId: comment.id, rawText: comment.rawText, initial: undefined });
    },
    [services],
  );

  const handleTrainDialogSave = useCallback(
    (tag: TrainTag): void => {
      if (!trainDialog) return;
      const updated = appendTrainTag(trainDialog.rawText, tag);
      services.saveCommentText(trainDialog.commentId, updated);
      setTrainDialog(null);
    },
    [trainDialog, services],
  );

  const handleTrainDialogClose = useCallback((): void => {
    setTrainDialog(null);
  }, []);

  const handleDeleteTrain = useCallback(
    (commentId: string, rawText: string): void => {
      const updated = replaceTrainTag(rawText, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  return {
    trainDialog,
    handleEditTrain,
    handleInsertTrain,
    handleTrainDialogSave,
    handleTrainDialogClose,
    handleDeleteTrain,
  };
};
