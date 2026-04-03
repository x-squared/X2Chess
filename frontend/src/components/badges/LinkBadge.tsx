/**
 * LinkBadge — inline game-link annotation badge for text/tree editor modes.
 *
 * Renders one chip per `[%link ...]` annotation attached to a move comment.
 * Each chip:
 * - Displays the annotation label (or a generic "→" glyph when no label is set).
 * - On click, calls `onOpen(recordId)` to open the linked game in a new tab.
 * - On hover, lazily fetches game metadata via `onFetchMetadata(recordId)` and
 *   displays a tooltip with the game title and result.
 * - If the fetch returns `null` the chip is rendered as a broken link.
 * - Provides edit (✎) and delete (×) controls for each chip.
 *
 * Integration API:
 * - `<LinkBadge annotations={...} onOpen={...} onFetchMetadata={...}
 *     onEdit={...} onDelete={...} t={...} />`
 *   — rendered inside `TokenView` for comment tokens in text/tree mode.
 *
 * Configuration API:
 * - `annotations: LinkAnnotation[]` — parsed link annotations for the comment.
 * - `onOpen: (recordId: string) => void` — called when a chip is clicked.
 * - `onFetchMetadata: (recordId: string) => Promise<Record<string, string> | null>`
 *   — called on hover; result cached per recordId for the component lifetime.
 * - `onEdit: (index: number) => void` — called when edit button is clicked.
 * - `onDelete: (index: number) => void` — called when delete button is clicked.
 * - `t` — translator function.
 *
 * Communication API:
 * - Outbound: `onOpen`, `onEdit`, `onDelete` callbacks.
 * - Inbound: `annotations` array; re-renders when it changes.
 * - Side effects: async metadata fetch on first hover per chip (idempotent).
 */

import {
  useState,
  useCallback,
  useRef,
  type ReactElement,
} from "react";
import type { LinkAnnotation } from "../resources_viewer/link_parser";

// ── Types ─────────────────────────────────────────────────────────────────────

type MetadataCache = Record<string, Record<string, string> | null>;

type LinkBadgeProps = {
  /** All link annotations present in the associated comment. */
  annotations: LinkAnnotation[];
  /**
   * Called when the user clicks a chip to navigate to the linked game.
   * @param recordId - Record ID of the linked game.
   */
  onOpen: (recordId: string) => void;
  /**
   * Called on first hover to resolve the linked game's display metadata.
   * Returns `null` when the game cannot be found (broken link).
   * @param recordId - Record ID to look up.
   */
  onFetchMetadata: (recordId: string) => Promise<Record<string, string> | null>;
  /**
   * Called when the user clicks the edit button on a chip.
   * @param index - Zero-based index of the annotation to edit.
   */
  onEdit?: (index: number) => void;
  /**
   * Called when the user clicks the delete button on a chip.
   * @param index - Zero-based index of the annotation to delete.
   */
  onDelete?: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};

// ── LinkChip ──────────────────────────────────────────────────────────────────

type LinkChipProps = {
  annotation: LinkAnnotation;
  index: number;
  onOpen: (recordId: string) => void;
  onFetchMetadata: (recordId: string) => Promise<Record<string, string> | null>;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Single game-link chip with hover tooltip and edit/delete controls.
 */
const LinkChip = ({
  annotation,
  index,
  onOpen,
  onFetchMetadata,
  onEdit,
  onDelete,
  t,
}: LinkChipProps): ReactElement => {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [broken, setBroken] = useState<boolean>(false);
  // Cache fetch result so repeated mouse-enter events don't re-fetch.
  const fetchedRef = useRef<boolean>(false);
  const metaCacheRef = useRef<MetadataCache>({});

  const handleMouseEnter = useCallback((): void => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void (async (): Promise<void> => {
      const cached: Record<string, string> | null | undefined =
        metaCacheRef.current[annotation.recordId];
      const meta: Record<string, string> | null =
        cached !== undefined ? cached : await onFetchMetadata(annotation.recordId);
      metaCacheRef.current[annotation.recordId] = meta;
      if (!meta) {
        setBroken(true);
        setTooltip(t("editor.linkChipBroken", "(broken link)"));
        return;
      }
      const white: string = String(meta.White ?? "").trim();
      const black: string = String(meta.Black ?? "").trim();
      const result: string = String(meta.Result ?? "").trim();
      const date: string = String(meta.Date ?? "").trim();
      const parts: string[] = [];
      if (white || black) parts.push(`${white || "?"} vs ${black || "?"}`);
      if (result) parts.push(result);
      if (date) parts.push(date);
      setTooltip(parts.join(" — ") || annotation.recordId);
    })();
  }, [annotation.recordId, onFetchMetadata, t]);

  const handleClick = useCallback((): void => {
    if (!broken) onOpen(annotation.recordId);
  }, [annotation.recordId, broken, onOpen]);

  const handleEdit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      onEdit?.(index);
    },
    [index, onEdit],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      onDelete?.(index);
    },
    [index, onDelete],
  );

  const chipLabel: string = annotation.label
    || t("editor.linkChipGeneric", "(link)");

  const chipClass: string = [
    "link-badge-chip",
    broken ? "link-badge-chip-broken" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className="link-badge-wrap"
      onMouseEnter={handleMouseEnter}
      title={tooltip ?? undefined}
    >
      {/* Chip — clickable to navigate */}
      <button
        type="button"
        className={chipClass}
        onClick={handleClick}
        aria-label={
          broken
            ? t("editor.linkChipBroken", "(broken link)")
            : t("editor.linkChipOpenAriaLabel", "Open linked game: {label}").replace(
                "{label}",
                chipLabel,
              )
        }
        disabled={broken}
      >
        <span className="link-badge-glyph" aria-hidden="true">⇢</span>
        {" "}
        {chipLabel}
      </button>

      {/* Edit button */}
      {onEdit && (
        <button
          type="button"
          className="link-badge-action"
          onClick={handleEdit}
          aria-label={t("editor.linkChipEdit", "Edit link")}
          title={t("editor.linkChipEdit", "Edit link")}
        >
          ✎
        </button>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          className="link-badge-action link-badge-action-delete"
          onClick={handleDelete}
          aria-label={t("editor.linkChipDelete", "Remove link")}
          title={t("editor.linkChipDelete", "Remove link")}
        >
          ×
        </button>
      )}
    </span>
  );
};

// ── LinkBadge ─────────────────────────────────────────────────────────────────

/**
 * Renders all `[%link ...]` chips for a single PGN comment.
 * Returns `null` when the annotation list is empty.
 */
export const LinkBadge = ({
  annotations,
  onOpen,
  onFetchMetadata,
  onEdit,
  onDelete,
  t,
}: LinkBadgeProps): ReactElement | null => {
  if (annotations.length === 0) return null;

  return (
    <span className="link-badge">
      {annotations.map((ann: LinkAnnotation, index: number): ReactElement => (
        <LinkChip
          key={`${ann.recordId}-${index}`}
          annotation={ann}
          index={index}
          onOpen={onOpen}
          onFetchMetadata={onFetchMetadata}
          onEdit={onEdit}
          onDelete={onDelete}
          t={t}
        />
      ))}
    </span>
  );
};
