/**
 * EvalBadge — inline engine-evaluation annotation badge for text/tree editor modes.
 *
 * Renders each `[%eval ...]` annotation as a visually distinct pill next to its
 * move.  Clicking the pill opens a small popover that shows the evaluation and
 * offers per-annotation deletion and a "Delete all" bulk-delete action.
 *
 * Integration API:
 * - `<EvalBadge annotations={...} onDelete={...} onDeleteAll={...} t={...} />`
 *   — renders one pill per annotation; for a single annotation the label is the
 *     formatted score; for multiple annotations the label shows the count.
 *
 * Configuration API:
 * - No global configuration; all state is local.
 *
 * Communication API:
 * - `onDelete(index)` — called when the user deletes the annotation at `index`.
 * - `onDeleteAll()` — called when the user chooses to delete every eval annotation
 *   across the whole game.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { formatEvalDisplay } from "../../features/resources/services/eval_parser";
import type { EvalAnnotation } from "../../features/resources/services/eval_parser";

// ── EvalBadge ─────────────────────────────────────────────────────────────────

type EvalBadgeProps = {
  /** All eval annotations present in the associated comment. */
  annotations: EvalAnnotation[];
  /** Called when the user deletes the annotation at `index`. */
  onDelete?: (index: number) => void;
  /** Called when the user requests deletion of all eval annotations in the game. */
  onDeleteAll?: () => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders a score pill for each engine-evaluation annotation.
 * For a single annotation the pill label is the formatted score (e.g. `+0.17`).
 * For multiple annotations it shows `eval N`.
 * Clicking the pill opens a popover with navigation, per-annotation delete,
 * and a "Delete all" button that removes all eval annotations from the game.
 */
export const EvalBadge = ({
  annotations,
  onDelete,
  onDeleteAll,
  t,
}: EvalBadgeProps): ReactElement | null => {
  const [open, setOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const popoverRef = useRef<HTMLSpanElement>(null);

  if (annotations.length === 0) return null;

  const count: number = annotations.length;
  const safePage: number = Math.min(page, count - 1);
  const current: EvalAnnotation = annotations[safePage];
  const displayLabel: string =
    count === 1
      ? formatEvalDisplay(current.value)
      : `eval ${count}`;

  const handleOpen = useCallback((): void => {
    setOpen((prev: boolean) => !prev);
    setPage(0);
  }, []);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

  const handlePrev = useCallback((): void => {
    setPage((p: number) => Math.max(0, p - 1));
  }, []);

  const handleNext = useCallback((): void => {
    setPage((p: number) => Math.min(count - 1, p + 1));
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

  /** CSS modifier class based on whether the eval is positive, negative, or a mate score. */
  const pillModifier = ((): string => {
    const v: string = current.value;
    if (v.startsWith("#")) return v.startsWith("#-") ? "eval-badge--mate-neg" : "eval-badge--mate-pos";
    const n: number = parseFloat(v);
    if (!isNaN(n) && n > 0) return "eval-badge--pos";
    if (!isNaN(n) && n < 0) return "eval-badge--neg";
    return "";
  })();

  return (
    <span className="eval-badge-wrap" ref={popoverRef}>
      <button
        type="button"
        className={`eval-badge ${pillModifier}`.trim()}
        aria-label={t("editor.eval.badge", "Engine evaluation")}
        onClick={handleOpen}
        onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>): void => {
          if (e.key === "Escape") handleClose();
        }}
      >
        {displayLabel}
      </button>

      {open && (
        <div className="eval-popover" role="dialog" aria-modal="false">
          {count > 1 && (
            <div className="eval-popover-nav">
              <button
                type="button"
                className="eval-popover-nav-btn"
                disabled={safePage === 0}
                onClick={handlePrev}
                aria-label={t("editor.eval.prev", "Previous")}
              >‹</button>
              <span className="eval-popover-nav-count">{safePage + 1} / {count}</span>
              <button
                type="button"
                className="eval-popover-nav-btn"
                disabled={safePage === count - 1}
                onClick={handleNext}
                aria-label={t("editor.eval.next", "Next")}
              >›</button>
            </div>
          )}

          <p className="eval-popover-value">
            {formatEvalDisplay(current.value)}
          </p>

          <div className="eval-popover-footer">
            {onDelete && (
              <button
                type="button"
                className="eval-popover-delete-btn"
                onClick={(): void => { onDelete(safePage); handleClose(); }}
              >
                {t("editor.eval.delete", "Delete")}
              </button>
            )}
            {onDeleteAll && (
              <button
                type="button"
                className="eval-popover-delete-all-btn"
                onClick={(): void => { onDeleteAll(); handleClose(); }}
              >
                {t("editor.eval.deleteAll", "Delete all")}
              </button>
            )}
            <button
              type="button"
              className="eval-popover-close-btn"
              onClick={handleClose}
            >
              {t("editor.eval.close", "Close")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};
