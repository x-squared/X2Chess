/**
 * AnchorBadge — inline anchor badge components for text/tree editor modes.
 *
 * Exports two components:
 * - `AnchorBadge` — renders a `⚓` badge next to a move that carries an anchor
 *   definition (`[%anchor ...]`). Clicking opens the anchor edit dialog.
 * - `AnchorRefChip` — renders an inline chip for each `[%anchorref ...]` in a
 *   comment. Hovering shows the referenced position via `HoverPreviewContext`
 *   and displays the anchor label as a tooltip. Provides edit (✎) and delete (×)
 *   controls.
 *
 * Integration API:
 * - `<AnchorBadge annotations={...} onEdit={...} onDelete={...} t={...} />`
 * - `<AnchorRefChip refAnnotation={...} resolved={...} index={...}
 *     onEdit={...} onDelete={...} t={...} />`
 *
 * Communication API:
 * - All interaction is handled via callback props; no context reads except
 *   `useHoverPreview()` for the position popup.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { AnchorAnnotation, AnchorRefAnnotation } from "../../resources_viewer/anchor_parser";
import type { ResolvedAnchor } from "../../editor/resolveAnchors";
import { useHoverPreview } from "../board/HoverPreviewContext";

// ── AnchorBadge ───────────────────────────────────────────────────────────────

type AnchorBadgeProps = {
  /** All anchor annotations in this comment. */
  annotations: AnchorAnnotation[];
  /** Called to open the edit dialog for an existing anchor. */
  onEdit?: (index: number) => void;
  /** Called to delete an anchor annotation. */
  onDelete?: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders a `⚓` badge (or `⚓N` for multiple) next to a move that carries
 * anchor definitions. Clicking opens a small popover with edit/delete actions.
 */
export const AnchorBadge = ({
  annotations,
  onEdit,
  onDelete,
  t,
}: AnchorBadgeProps): ReactElement | null => {
  const [open, setOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const popoverRef = useRef<HTMLSpanElement>(null);

  if (annotations.length === 0) return null;

  const count: number = annotations.length;
  const current: AnchorAnnotation = annotations[Math.min(page, count - 1)];

  const handleOpen = useCallback((): void => {
    setOpen((prev) => !prev);
    setPage(0);
  }, []);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

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
    <span className="anchor-badge-wrap" ref={popoverRef}>
      <button
        type="button"
        className="anchor-badge"
        aria-label={t("editor.anchor.badge", "Anchor")}
        onClick={handleOpen}
        onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>): void => {
          if (e.key === "Escape") handleClose();
        }}
      >
        {count > 1 ? `⚓${count}` : "⚓"}
      </button>

      {open && (
        <div className="anchor-badge-popover" role="dialog" aria-modal="false">
          {count > 1 && (
            <div className="anchor-badge-popover-nav">
              <button
                type="button"
                className="anchor-badge-nav-btn"
                disabled={page === 0}
                onClick={(): void => { setPage((p) => Math.max(0, p - 1)); }}
                aria-label={t("editor.anchor.prev", "Previous")}
              >‹</button>
              <span className="anchor-badge-nav-count">{page + 1} / {count}</span>
              <button
                type="button"
                className="anchor-badge-nav-btn"
                disabled={page === count - 1}
                onClick={(): void => { setPage((p) => Math.min(count - 1, p + 1)); }}
                aria-label={t("editor.anchor.next", "Next")}
              >›</button>
            </div>
          )}

          <div className="anchor-badge-popover-id">
            <span className="anchor-badge-popover-id-label">
              {t("editor.anchor.id", "ID")}:
            </span>
            {" "}
            <code>{current.id}</code>
          </div>
          <p className="anchor-badge-popover-text">{current.text}</p>

          <div className="anchor-badge-popover-footer">
            {onEdit && (
              <button
                type="button"
                className="anchor-badge-edit-btn"
                onClick={(): void => { onEdit(page); handleClose(); }}
              >
                {t("editor.anchor.edit", "Edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="anchor-badge-delete-btn"
                onClick={(): void => { onDelete(page); handleClose(); }}
              >
                {t("editor.anchor.delete", "Delete")}
              </button>
            )}
            <button
              type="button"
              className="anchor-badge-close-btn"
              onClick={handleClose}
            >
              {t("editor.anchor.close", "Close")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

// ── AnchorRefChip ─────────────────────────────────────────────────────────────

type AnchorRefChipProps = {
  /** The parsed reference annotation. */
  refAnnotation: AnchorRefAnnotation;
  /** Resolved anchor data (null when the referenced ID is not found in the game). */
  resolved: ResolvedAnchor | null;
  /** Zero-based index of this reference among all refs in the comment (for edit/delete). */
  index: number;
  /** Called to open the picker in edit mode. */
  onEdit?: (index: number) => void;
  /** Called to delete this reference. */
  onDelete?: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders an inline chip for a `[%anchorref ...]` annotation.
 * Hovering shows a mini-board position preview and the anchor label as a tooltip.
 * When the referenced anchor ID is not found, the chip renders in a broken/warning state.
 */
export const AnchorRefChip = ({
  refAnnotation,
  resolved,
  index,
  onEdit,
  onDelete,
  t,
}: AnchorRefChipProps): ReactElement => {
  const { showPreview, hidePreview } = useHoverPreview();

  const handleMouseEnter = useCallback(
    (e: ReactMouseEvent<HTMLSpanElement>): void => {
      if (!resolved) return;
      const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
      showPreview(resolved.fen, resolved.lastMove, rect);
    },
    [resolved, showPreview],
  );

  const handleMouseLeave = useCallback((): void => {
    hidePreview();
  }, [hidePreview]);

  const isBroken: boolean = resolved === null;
  const label: string = resolved
    ? resolved.text
    : `?${refAnnotation.id}`;
  const titleText: string = resolved
    ? `${resolved.text} (${resolved.moveSan})`
    : t("editor.anchor.notFound", "Anchor not found");

  return (
    <span
      className={["anchor-ref-chip", isBroken ? "anchor-ref-chip--broken" : ""].filter(Boolean).join(" ")}
      title={titleText}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="anchor-ref-chip-icon" aria-hidden="true">⚓</span>
      <span className="anchor-ref-chip-label">{label}</span>
      {onEdit && (
        <button
          type="button"
          className="anchor-ref-chip-edit"
          aria-label={t("editor.anchor.editRef", "Edit anchor reference")}
          onClick={(): void => { onEdit(index); }}
        >
          ✎
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          className="anchor-ref-chip-delete"
          aria-label={t("editor.anchor.deleteRef", "Remove anchor reference")}
          onClick={(): void => { onDelete(index); }}
        >
          ×
        </button>
      )}
    </span>
  );
};
