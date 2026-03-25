/**
 * useLinkDialog — game-link annotation dialog state for PgnTextEditor.
 *
 * Manages the open/close lifecycle and selection handlers for the game-link
 * annotation insert/edit flow (opens `GamePickerDialog`).
 *
 * Integration API:
 * - `const { linkDialog, handleInsertLink, handleEditLink,
 *     handleLinkPickerSelect, handleLinkDialogClose, handleDeleteLink }
 *     = useLinkDialog(services)` — call inside PgnTextEditor.
 *
 * Communication API:
 * - Inbound: calls `services.insertComment`, `services.saveCommentText`, and
 *   `services.getActiveSessionResourceRef`.
 * - Outbound: `linkDialog` state for conditional rendering of `<GamePickerDialog>`.
 */

import { useState, useCallback } from "react";
import { parseLinkAnnotations, replaceLinkAnnotation, appendLinkAnnotation } from "../resources_viewer/link_parser";
import type { LinkAnnotation } from "../resources_viewer/link_parser";
import type { AppStartupServices } from "../state/ServiceContext";
import type { ResourceRef } from "../resources_viewer/viewer_utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LinkDialogState = {
  /** ID of the comment being edited/created. */
  commentId: string;
  /** Raw text of the comment (for edit). */
  rawText: string;
  /** Index of the annotation being edited, or -1 for insert. */
  editIndex: number;
  /** Pre-filled values when editing an existing link. */
  initial?: LinkAnnotation;
  /** Resource ref resolved at open time; passed to GamePickerDialog. */
  resourceRef: ResourceRef;
};

export type UseLinkDialogResult = {
  linkDialog: LinkDialogState | null;
  handleInsertLink: (moveId: string) => void;
  handleEditLink: (commentId: string, index: number, rawText: string) => void;
  handleLinkPickerSelect: (row: { recordId: string; label: string }) => void;
  handleLinkDialogClose: () => void;
  handleDeleteLink: (commentId: string, index: number, rawText: string) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manage the game-link annotation dialog state.
 *
 * @param services - App service callbacks from `useServiceContext()`.
 * @returns Stable handlers and current dialog state.
 */
export const useLinkDialog = (services: AppStartupServices): UseLinkDialogResult => {
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);

  const handleInsertLink = useCallback(
    (moveId: string): void => {
      const resourceRef: { kind: string; locator: string } | null =
        services.getActiveSessionResourceRef();
      if (!resourceRef) return;
      const comment = services.insertComment(moveId, "after");
      if (!comment) return;
      setLinkDialog({
        commentId: comment.id,
        rawText: comment.rawText,
        editIndex: -1,
        initial: undefined,
        resourceRef,
      });
    },
    [services],
  );

  const handleEditLink = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const resourceRef: { kind: string; locator: string } | null =
        services.getActiveSessionResourceRef();
      if (!resourceRef) return;
      const annotations: LinkAnnotation[] = parseLinkAnnotations(rawText);
      setLinkDialog({
        commentId,
        rawText,
        editIndex: index,
        initial: annotations[index],
        resourceRef,
      });
    },
    [services],
  );

  const handleLinkPickerSelect = useCallback(
    (row: { recordId: string; label: string }): void => {
      if (!linkDialog) return;
      const annotation: LinkAnnotation = { recordId: row.recordId, label: row.label };
      let updated: string;
      if (linkDialog.editIndex >= 0) {
        updated = replaceLinkAnnotation(linkDialog.rawText, linkDialog.editIndex, annotation);
      } else {
        updated = appendLinkAnnotation(linkDialog.rawText, annotation);
      }
      services.saveCommentText(linkDialog.commentId, updated);
      setLinkDialog(null);
    },
    [linkDialog, services],
  );

  const handleLinkDialogClose = useCallback((): void => {
    setLinkDialog(null);
  }, []);

  const handleDeleteLink = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const updated: string = replaceLinkAnnotation(rawText, index, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  return {
    linkDialog,
    handleInsertLink,
    handleEditLink,
    handleLinkPickerSelect,
    handleLinkDialogClose,
    handleDeleteLink,
  };
};
