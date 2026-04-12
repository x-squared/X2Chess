/**
 * TrainBadge — inline `[%train]` annotation badge and edit dialog for the PGN editor.
 *
 * Integration API:
 * - `<TrainBadge tag={...} onEdit={...} onDelete={...} t={...} />` — renders a
 *   "T" pill that opens a read/action popover on click.
 * - `<TrainInsertDialog initial={...} onSave={...} onClose={...} t={...} />` —
 *   modal dialog for inserting or editing a `[%train]` tag.
 *
 * Configuration API:
 * - No global configuration; all state is local to component instances.
 *
 * Communication API:
 * - `onEdit()` / `onDelete()` callbacks bubble up to the parent editor.
 * - `onSave(tag)` in `TrainInsertDialog` provides the updated tag.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { TrainTag } from "../../features/resources/services/train_tag_parser";

// ── TrainBadge ─────────────────────────────────────────────────────────────────

type TrainBadgeProps = {
  tag: TrainTag;
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders a "T" pill badge next to a move that has a `[%train]` annotation.
 * Clicking opens an inline popover summarising the accept/reject/hint fields.
 */
export const TrainBadge = ({ tag, onEdit, onDelete, t }: TrainBadgeProps): ReactElement => {
  const [open, setOpen] = useState<boolean>(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const handleToggle = useCallback((): void => { setOpen((v) => !v); }, []);
  const handleClose = useCallback((): void => { setOpen(false); }, []);

  useEffect((): (() => void) => {
    if (!open) return (): void => undefined;
    const handler = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return (): void => { document.removeEventListener("mousedown", handler, true); };
  }, [open, handleClose]);

  return (
    <span className="train-badge-wrap" ref={wrapRef}>
      <button
        type="button"
        className="train-badge"
        aria-label={t("editor.train.badge", "Training annotation")}
        onClick={handleToggle}
        onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>): void => {
          if (e.key === "Escape") handleClose();
        }}
      >
        T
      </button>

      {open && (
        <div className="train-popover" role="dialog" aria-modal="false">
          {tag.accept.length > 0 && (
            <div className="train-popover-row">
              <span className="train-popover-label">{t("editor.train.accept", "Accept:")}</span>
              <span className="train-popover-value">{tag.accept.join(", ")}</span>
            </div>
          )}
          {tag.reject.length > 0 && (
            <div className="train-popover-row">
              <span className="train-popover-label">{t("editor.train.reject", "Reject:")}</span>
              <span className="train-popover-value train-popover-value--reject">{tag.reject.join(", ")}</span>
            </div>
          )}
          {tag.hint && (
            <div className="train-popover-row">
              <span className="train-popover-label">{t("editor.train.hint", "Hint:")}</span>
              <span className="train-popover-value train-popover-value--hint">{tag.hint}</span>
            </div>
          )}
          {tag.accept.length === 0 && tag.reject.length === 0 && !tag.hint && (
            <p className="train-popover-empty">{t("editor.train.empty", "No overrides set.")}</p>
          )}
          <div className="train-popover-footer">
            {onEdit && (
              <button
                type="button"
                className="train-popover-edit-btn"
                onClick={(): void => { onEdit(); handleClose(); }}
              >
                {t("editor.train.edit", "Edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="train-popover-delete-btn"
                onClick={(): void => { onDelete(); handleClose(); }}
              >
                {t("editor.train.delete", "Delete")}
              </button>
            )}
            <button
              type="button"
              className="train-popover-close-btn"
              onClick={handleClose}
            >
              {t("editor.train.close", "Close")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

// ── TrainInsertDialog ──────────────────────────────────────────────────────────

type TrainInsertDialogProps = {
  initial?: TrainTag;
  t: (key: string, fallback?: string) => string;
  onSave: (tag: TrainTag) => void;
  onClose: () => void;
};

/**
 * Modal dialog for inserting or editing a `[%train]` annotation.
 * Accept and reject are comma-separated UCI move lists; hint is free text.
 */
export const TrainInsertDialog = ({
  initial,
  t,
  onSave,
  onClose,
}: TrainInsertDialogProps): ReactElement => {
  const [accept, setAccept] = useState<string>(initial?.accept.join(", ") ?? "");
  const [reject, setReject] = useState<string>(initial?.reject.join(", ") ?? "");
  const [hint, setHint] = useState<string>(initial?.hint ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect((): void => { dialogRef.current?.showModal(); }, []);

  const parseUciList = (raw: string): string[] =>
    raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const handleSave = useCallback((): void => {
    onSave({
      accept: parseUciList(accept),
      reject: parseUciList(reject),
      hint: hint.trim() || undefined,
    });
    dialogRef.current?.close();
    onClose();
  }, [accept, reject, hint, onSave, onClose]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="train-insert-dialog" onClose={onClose}>
      <div className="train-insert-form">
        <p className="train-insert-title">
          {initial
            ? t("editor.train.editTitle", "Edit training tag")
            : t("editor.train.insertTitle", "Add training tag")}
        </p>

        <label className="train-insert-label">
          <span>{t("editor.train.acceptLabel", "Accept (comma-separated UCI moves):")}</span>
          <input
            type="text"
            className="train-insert-input"
            value={accept}
            placeholder="e2e4, d2d4"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(e) => { setAccept(e.target.value); }}
          />
          <span className="train-insert-hint-text">
            {t("editor.train.acceptHint", "Moves accepted as fully correct. The game move is always accepted unless listed under Reject.")}
          </span>
        </label>

        <label className="train-insert-label">
          <span>{t("editor.train.rejectLabel", "Reject (comma-separated UCI moves):")}</span>
          <input
            type="text"
            className="train-insert-input"
            value={reject}
            placeholder="g1h3"
            onChange={(e) => { setReject(e.target.value); }}
          />
          <span className="train-insert-hint-text">
            {t("editor.train.rejectHint", "Moves that are explicitly wrong — the variation's comment explains why.")}
          </span>
        </label>

        <label className="train-insert-label">
          <span>{t("editor.train.hintLabel", "Hint (optional, shown on hint request):")}</span>
          <textarea
            className="train-insert-textarea"
            rows={2}
            value={hint}
            placeholder={t("editor.train.hintPlaceholder", "Activate the knight")}
            onChange={(e) => { setHint(e.target.value); }}
          />
        </label>

        <div className="train-insert-actions">
          <button type="button" className="train-insert-btn-cancel" onClick={handleCancel}>
            {t("editor.train.cancel", "Cancel")}
          </button>
          <button type="button" className="train-insert-btn-save" onClick={handleSave}>
            {t("editor.train.save", "Save")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
