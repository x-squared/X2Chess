/**
 * TodoBadge — inline TODO annotation badge and popover for text/tree editor modes.
 *
 * Integration API:
 * - `<TodoBadge annotations={...} onEdit={...} onDelete={...} t={...} />` — renders a
 *   "T" pill that opens a popover with the TODO text on click.
 * - `<TodoInsertDialog moveId={...} onSave={...} onClose={...} t={...} />` — single-field
 *   dialog for inserting or editing a TODO annotation.
 * - `<TodoPanel items={...} onEdit={...} onDelete={...} t={...} />` — aggregated TODO
 *   list panel shown below the editor.
 *
 * Configuration API:
 * - No global configuration; all state is local to the component instances.
 *
 * Communication API:
 * - `onEdit(index)` / `onDelete(index)` callbacks passed from parent.
 * - `onSave(moveId, annotation)` callback in `TodoInsertDialog` provides the new annotation.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { TodoAnnotation } from "../resources_viewer/todo_parser";

// ── TodoBadge ──────────────────────────────────────────────────────────────────

type TodoBadgeProps = {
  /** All TODO annotations present in the associated comment. */
  annotations: TodoAnnotation[];
  /** Called when the user wants to edit an existing annotation. */
  onEdit?: (index: number) => void;
  /** Called when the user wants to delete an existing annotation. */
  onDelete?: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders a "T" pill badge (or "TN" for N > 1 annotations) next to a move.
 * Clicking opens an inline popover showing the TODO text.
 * Multiple annotations are navigable with prev/next arrows.
 */
export const TodoBadge = ({ annotations, onEdit, onDelete, t }: TodoBadgeProps): ReactElement | null => {
  const [open, setOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  if (annotations.length === 0) return null;

  const count = annotations.length;
  const current: TodoAnnotation = annotations[Math.min(page, count - 1)];

  const handleOpen = useCallback((): void => {
    setOpen((prev) => !prev);
    setPage(0);
  }, []);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

  const handlePrev = useCallback((): void => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const handleNext = useCallback((): void => {
    setPage((p) => Math.min(count - 1, p + 1));
  }, [count]);

  // Close on outside click.
  useEffect((): (() => void) => {
    if (!open) return (): void => undefined;
    const handler = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return (): void => { document.removeEventListener("mousedown", handler, true); };
  }, [open, handleClose]);

  return (
    <span className="todo-badge-wrap" ref={popoverRef}>
      <button
        type="button"
        className="todo-badge"
        aria-label={t("editor.todo.badge", "TODO annotation")}
        onClick={handleOpen}
        onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>): void => {
          if (e.key === "Escape") handleClose();
        }}
      >
        {count > 1 ? `T${count}` : "T"}
      </button>

      {open && (
        <div className="todo-popover" role="dialog" aria-modal="false">
          {count > 1 && (
            <div className="todo-popover-nav">
              <button
                type="button"
                className="todo-popover-nav-btn"
                disabled={page === 0}
                onClick={handlePrev}
                aria-label={t("editor.todo.prev", "Previous")}
              >‹</button>
              <span className="todo-popover-nav-count">{page + 1} / {count}</span>
              <button
                type="button"
                className="todo-popover-nav-btn"
                disabled={page === count - 1}
                onClick={handleNext}
                aria-label={t("editor.todo.next", "Next")}
              >›</button>
            </div>
          )}

          <p className="todo-popover-text">{current.text}</p>

          <div className="todo-popover-footer">
            {onEdit && (
              <button
                type="button"
                className="todo-popover-edit-btn"
                onClick={(): void => { onEdit(page); handleClose(); }}
              >
                {t("editor.todo.edit", "Edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="todo-popover-delete-btn"
                onClick={(): void => { onDelete(page); handleClose(); }}
              >
                {t("editor.todo.delete", "Delete")}
              </button>
            )}
            <button
              type="button"
              className="todo-popover-close-btn"
              onClick={handleClose}
            >
              {t("editor.todo.close", "Close")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

// ── TodoInsertDialog ───────────────────────────────────────────────────────────

type TodoInsertDialogProps = {
  /** ID of the move after which the TODO is being inserted. */
  moveId: string;
  /** Initial value when editing an existing annotation. */
  initial?: TodoAnnotation;
  t: (key: string, fallback?: string) => string;
  onSave: (moveId: string, annotation: TodoAnnotation) => void;
  onClose: () => void;
};

/**
 * Single-field dialog for inserting or editing a TODO annotation.
 */
export const TodoInsertDialog = ({
  moveId,
  initial,
  t,
  onSave,
  onClose,
}: TodoInsertDialogProps): ReactElement => {
  const [text, setText] = useState<string>(initial?.text ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleSave = useCallback((): void => {
    if (!text.trim()) return;
    onSave(moveId, { text: text.trim() });
    dialogRef.current?.close();
    onClose();
  }, [moveId, text, onSave, onClose]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="todo-insert-dialog"
      onClose={onClose}
    >
      <div className="todo-insert-form">
        <p className="todo-insert-title">
          {initial ? t("editor.todo.editTitle", "Edit TODO") : t("editor.todo.insertTitle", "Add TODO")}
        </p>

        <label className="todo-insert-label">
          <span>{t("editor.todo.text", "Note:")}</span>
          <textarea
            className="todo-insert-textarea"
            rows={3}
            value={text}
            placeholder={t("editor.todo.textPlaceholder", "Analyse this position more carefully")}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(e) => { setText(e.target.value); }}
          />
        </label>

        <div className="todo-insert-actions">
          <button type="button" className="todo-insert-btn-cancel" onClick={handleCancel}>
            {t("editor.todo.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="todo-insert-btn-save"
            disabled={!text.trim()}
            onClick={handleSave}
          >
            {t("editor.todo.save", "Save")}
          </button>
        </div>
      </div>
    </dialog>
  );
};

// ── TodoPanel ──────────────────────────────────────────────────────────────────

export type TodoPanelItem = {
  commentId: string;
  index: number;
  rawText: string;
  text: string;
  moveLabel: string;
};

type TodoPanelProps = {
  items: TodoPanelItem[];
  t: (key: string, fallback?: string) => string;
  onEdit: (commentId: string, index: number, rawText: string) => void;
  onDelete: (commentId: string, index: number, rawText: string) => void;
};

/**
 * Collapsible panel listing all TODO annotations across the current game.
 * Shown below the editor when at least one TODO exists.
 */
export const TodoPanel = ({ items, t, onEdit, onDelete }: TodoPanelProps): ReactElement | null => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  if (items.length === 0) return null;

  return (
    <div className="todo-panel">
      <div className="todo-panel-header">
        <button
          type="button"
          className="todo-panel-toggle"
          onClick={(): void => { setCollapsed((c) => !c); }}
          aria-expanded={!collapsed}
        >
          {collapsed ? "▶" : "▼"}
          {" "}
          {t("editor.todo.panelTitle", "TODO")} ({items.length})
        </button>
      </div>
      {!collapsed && (
        <ul className="todo-panel-list">
          {items.map((item, i): ReactElement => (
            <li key={`${item.commentId}_${item.index}_${i}`} className="todo-panel-item">
              <span className="todo-panel-item-label">{item.moveLabel}</span>
              <span className="todo-panel-item-text">{item.text}</span>
              <span className="todo-panel-item-actions">
                <button
                  type="button"
                  className="todo-panel-item-btn"
                  onClick={(): void => { onEdit(item.commentId, item.index, item.rawText); }}
                >
                  {t("editor.todo.edit", "Edit")}
                </button>
                <button
                  type="button"
                  className="todo-panel-item-btn todo-panel-item-btn--delete"
                  onClick={(): void => { onDelete(item.commentId, item.index, item.rawText); }}
                >
                  {t("editor.todo.delete", "Delete")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
