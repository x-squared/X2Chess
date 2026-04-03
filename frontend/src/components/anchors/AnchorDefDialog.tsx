/**
 * AnchorDefDialog — dialog for placing or editing an anchor definition at a move.
 *
 * Integration API:
 * - `<AnchorDefDialog state={...} allAnchors={...} onConfirm={...} onCancel={...} t={...} />`
 *
 * Communication API:
 * - `onConfirm(annotation)` — called with the new/edited anchor on save.
 * - `onCancel()` — called when the dialog is dismissed.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactElement,
  type ChangeEvent,
} from "react";
import type { AnchorAnnotation } from "../../resources_viewer/anchor_parser";
import type { AnchorDefDialogState } from "../../editor/useAnchorDefDialog";
import type { ResolvedAnchor } from "../../editor/resolveAnchors";
import { AnchorList } from "./AnchorList";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnchorDefDialogProps = {
  state: AnchorDefDialogState;
  /** All anchors already in the game (for the existing-anchors list and ID conflict check). */
  allAnchors: ResolvedAnchor[];
  onConfirm: (annotation: AnchorAnnotation) => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Modal dialog for placing or editing an anchor definition.
 * Shows an ID + text form at the top; existing anchors listed below for context.
 */
export const AnchorDefDialog = ({
  state,
  allAnchors,
  onConfirm,
  onCancel,
  t,
}: AnchorDefDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [id, setId] = useState<string>(state.initial?.id ?? state.suggestedId);
  const [text, setText] = useState<string>(state.initial?.text ?? "");
  const [listQuery, setListQuery] = useState<string>("");

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const isEditing: boolean = state.editIndex >= 0;

  // ID conflict: another anchor (not the one being edited) already uses this ID.
  const takenIds: Set<string> = new Set(
    allAnchors
      .filter((a) => !isEditing || a.id !== state.initial?.id)
      .map((a) => a.id),
  );
  const idTrimmed: string = id.trim();
  const textTrimmed: string = text.trim();
  const isIdConflict: boolean = idTrimmed.length > 0 && takenIds.has(idTrimmed);
  const canSave: boolean = idTrimmed.length > 0 && textTrimmed.length > 0 && !isIdConflict;

  const handleConfirm = useCallback((): void => {
    if (!canSave) return;
    onConfirm({ id: idTrimmed, text: textTrimmed });
    dialogRef.current?.close();
  }, [canSave, idTrimmed, textTrimmed, onConfirm]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  const handleIdChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    // Only allow safe ID characters (alphanumeric, hyphens, underscores).
    setId(e.target.value.replace(/[^a-zA-Z0-9\-_]/g, ""));
  }, []);

  return (
    <dialog ref={dialogRef} className="anchor-def-dialog" onClose={onCancel}>
      <div className="anchor-def-dialog-inner">
        <p className="anchor-def-dialog-title">
          {isEditing
            ? t("editor.anchor.editTitle", "Edit anchor")
            : t("editor.anchor.addTitle", "Add anchor")}
        </p>

        <div className="anchor-def-form">
          <label className="anchor-def-label">
            <span>{t("editor.anchor.id", "ID")}</span>
            <input
              className="anchor-def-input"
              type="text"
              value={id}
              placeholder="e.g. critical"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onChange={handleIdChange}
              onKeyDown={(e): void => { if (e.key === "Enter") handleConfirm(); }}
            />
            {isIdConflict && (
              <span className="anchor-def-conflict">
                {t("editor.anchor.idConflict", "This ID is already used")}
              </span>
            )}
          </label>

          <label className="anchor-def-label">
            <span>{t("editor.anchor.text", "Label")}</span>
            <input
              className="anchor-def-input"
              type="text"
              value={text}
              placeholder={t("editor.anchor.textPlaceholder", "Short description of this moment")}
              onChange={(e): void => { setText(e.target.value); }}
              onKeyDown={(e): void => { if (e.key === "Enter") handleConfirm(); }}
            />
          </label>
        </div>

        <div className="anchor-def-actions">
          <button type="button" className="anchor-def-btn-cancel" onClick={handleCancel}>
            {t("editor.anchor.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="anchor-def-btn-save"
            disabled={!canSave}
            onClick={handleConfirm}
          >
            {isEditing
              ? t("editor.anchor.save", "Save")
              : t("editor.anchor.place", "Place anchor")}
          </button>
        </div>

        {allAnchors.length > 0 && (
          <div className="anchor-def-existing">
            <p className="anchor-def-existing-title">
              {t("editor.anchor.existingAnchors", "Existing anchors in this game")}
            </p>
            <input
              className="anchor-def-search"
              type="search"
              placeholder={t("anchorPicker.search", "Search by label or ID…")}
              value={listQuery}
              onChange={(e): void => { setListQuery(e.target.value); }}
            />
            <AnchorList
              anchors={allAnchors}
              query={listQuery}
              selectedId={undefined}
              onSelect={(): void => undefined}
              t={t}
            />
          </div>
        )}
      </div>
    </dialog>
  );
};
