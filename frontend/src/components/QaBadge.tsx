/**
 * QaBadge — inline Q/A annotation badge and popover for text/tree editor modes.
 *
 * Integration API:
 * - `<QaBadge annotations={...} onEdit={...} />` — renders a `?` pill that
 *   opens a progressive-reveal read popover on click.
 * - `<QaInsertDialog moveId={...} onSave={...} onClose={...} />` — small dialog
 *   for inserting a new Q/A annotation after a specific move.
 *
 * Configuration API:
 * - No global configuration; all state is local to the component instances.
 *
 * Communication API:
 * - `onEdit()` callback opens an external edit flow (passed from parent).
 * - `onSave(annotation)` callback in `QaInsertDialog` provides the new annotation.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { QaAnnotation } from "../resources_viewer/qa_parser";

// ── QaBadge (read popover, UV9 + UV11) ───────────────────────────────────────

type QaBadgeProps = {
  /** All Q/A annotations present in the associated comment. */
  annotations: QaAnnotation[];
  /** Called when the user wants to edit an existing annotation. */
  onEdit?: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders a `?` pill badge (or `?N` for N > 1 annotations) next to a move.
 * Clicking opens an inline popover with progressive reveal: question → hint → answer.
 * Multiple annotations are navigable with prev/next arrows.
 */
export const QaBadge = ({ annotations, onEdit, t }: QaBadgeProps): ReactElement | null => {
  const [open, setOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [hintVisible, setHintVisible] = useState<boolean>(false);
  const [answerVisible, setAnswerVisible] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  if (annotations.length === 0) return null;

  const count = annotations.length;
  const current: QaAnnotation = annotations[Math.min(page, count - 1)];

  const handleOpen = useCallback((): void => {
    setOpen((prev) => !prev);
    setPage(0);
    setHintVisible(false);
    setAnswerVisible(false);
  }, []);

  const handleClose = useCallback((): void => {
    setOpen(false);
    setHintVisible(false);
    setAnswerVisible(false);
  }, []);

  const handlePrev = useCallback((): void => {
    setPage((p) => Math.max(0, p - 1));
    setHintVisible(false);
    setAnswerVisible(false);
  }, []);

  const handleNext = useCallback((): void => {
    setPage((p) => Math.min(count - 1, p + 1));
    setHintVisible(false);
    setAnswerVisible(false);
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
    <span className="qa-badge-wrap" ref={popoverRef}>
      <button
        type="button"
        className="qa-badge"
        aria-label={t("editor.qa.badge", "Q/A annotation")}
        onClick={handleOpen}
        onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>): void => {
          if (e.key === "Escape") handleClose();
        }}
      >
        {count > 1 ? `?${count}` : "?"}
      </button>

      {open && (
        <div className="qa-popover" role="dialog" aria-modal="false">
          {count > 1 && (
            <div className="qa-popover-nav">
              <button
                type="button"
                className="qa-popover-nav-btn"
                disabled={page === 0}
                onClick={handlePrev}
                aria-label={t("editor.qa.prev", "Previous")}
              >‹</button>
              <span className="qa-popover-nav-count">{page + 1} / {count}</span>
              <button
                type="button"
                className="qa-popover-nav-btn"
                disabled={page === count - 1}
                onClick={handleNext}
                aria-label={t("editor.qa.next", "Next")}
              >›</button>
            </div>
          )}

          <p className="qa-popover-question">{current.question}</p>

          {current.hint && !hintVisible && (
            <button
              type="button"
              className="qa-popover-reveal-btn"
              onClick={(): void => { setHintVisible(true); }}
            >
              {t("editor.qa.showHint", "Show hint")}
            </button>
          )}
          {current.hint && hintVisible && (
            <p className="qa-popover-hint">{current.hint}</p>
          )}

          {!answerVisible && (
            <button
              type="button"
              className="qa-popover-reveal-btn qa-popover-reveal-btn--answer"
              onClick={(): void => { setAnswerVisible(true); }}
            >
              {t("editor.qa.showAnswer", "Show answer")}
            </button>
          )}
          {answerVisible && (
            <p className="qa-popover-answer">{current.answer}</p>
          )}

          <div className="qa-popover-footer">
            {onEdit && (
              <button
                type="button"
                className="qa-popover-edit-btn"
                onClick={(): void => { onEdit(page); handleClose(); }}
              >
                {t("editor.qa.edit", "Edit")}
              </button>
            )}
            <button
              type="button"
              className="qa-popover-close-btn"
              onClick={handleClose}
            >
              {t("editor.qa.close", "Close")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

// ── QaInsertDialog (insert popover, UV10) ─────────────────────────────────────

type QaInsertDialogProps = {
  /** ID of the move after which the Q/A is being inserted. */
  moveId: string;
  /** Initial values when editing an existing annotation. */
  initial?: QaAnnotation;
  t: (key: string, fallback?: string) => string;
  onSave: (moveId: string, annotation: QaAnnotation) => void;
  onClose: () => void;
};

/**
 * Small popover dialog for inserting or editing a Q/A annotation.
 * Opened via right-click "Add Q/A here…" or Ctrl+Shift+Q shortcut.
 */
export const QaInsertDialog = ({
  moveId,
  initial,
  t,
  onSave,
  onClose,
}: QaInsertDialogProps): ReactElement => {
  const [question, setQuestion] = useState<string>(initial?.question ?? "");
  const [answer, setAnswer] = useState<string>(initial?.answer ?? "");
  const [hint, setHint] = useState<string>(initial?.hint ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleSave = useCallback((): void => {
    if (!question.trim() || !answer.trim()) return;
    onSave(moveId, { question: question.trim(), answer: answer.trim(), hint: hint.trim() });
    dialogRef.current?.close();
    onClose();
  }, [moveId, question, answer, hint, onSave, onClose]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="qa-insert-dialog"
      onClose={onClose}
    >
      <div className="qa-insert-form">
        <p className="qa-insert-title">
          {initial ? t("editor.qa.editTitle", "Edit Q/A") : t("editor.qa.insertTitle", "Add Q/A")}
        </p>

        <label className="qa-insert-label">
          <span>{t("editor.qa.question", "Question:")}</span>
          <textarea
            className="qa-insert-textarea"
            rows={3}
            value={question}
            placeholder={t("editor.qa.questionPlaceholder", "What is the best move here?")}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(e) => { setQuestion(e.target.value); }}
          />
        </label>

        <label className="qa-insert-label">
          <span>{t("editor.qa.answer", "Answer:")}</span>
          <textarea
            className="qa-insert-textarea"
            rows={3}
            value={answer}
            placeholder={t("editor.qa.answerPlaceholder", "The strongest continuation is...")}
            onChange={(e) => { setAnswer(e.target.value); }}
          />
        </label>

        <label className="qa-insert-label">
          <span>{t("editor.qa.hint", "Hint (optional):")}</span>
          <textarea
            className="qa-insert-textarea qa-insert-textarea--hint"
            rows={2}
            value={hint}
            placeholder={t("editor.qa.hintPlaceholder", "Look for a fork...")}
            onChange={(e) => { setHint(e.target.value); }}
          />
        </label>

        <div className="qa-insert-actions">
          <button type="button" className="qa-insert-btn-cancel" onClick={handleCancel}>
            {t("editor.qa.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="qa-insert-btn-save"
            disabled={!question.trim() || !answer.trim()}
            onClick={handleSave}
          >
            {t("editor.qa.save", "Save")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
