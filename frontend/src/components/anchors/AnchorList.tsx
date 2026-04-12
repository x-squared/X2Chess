/**
 * AnchorList — shared list component that renders all anchors in a game.
 *
 * Used inside `AnchorDefDialog` (to show existing anchors when placing a new one)
 * and `AnchorPickerDialog` (to pick an anchor when inserting a reference).
 *
 * Integration API:
 * - `<AnchorList anchors={...} query={...} onSelect={...} t={...} />`
 *
 * Communication API:
 * - `onSelect(anchor)` — called when the user clicks an anchor row.
 * - Uses `useHoverPreview()` context for the position-preview board icon.
 */

import { useState, useCallback, type ReactElement } from "react";
import type { ResolvedAnchor } from "../../features/editor/model/resolveAnchors";
import { useHoverPreview } from "../board/HoverPreviewContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnchorListProps = {
  /** All resolved anchors to display. */
  anchors: ResolvedAnchor[];
  /** Substring filter applied to text, id, and movePath. */
  query: string;
  /** If set, this anchor ID row is highlighted as selected. */
  selectedId?: string;
  /** Called when the user clicks an anchor row (except board icon). */
  onSelect: (anchor: ResolvedAnchor) => void;
  t: (key: string, fallback?: string) => string;
};

// ── AnchorRow ─────────────────────────────────────────────────────────────────

type AnchorRowProps = {
  anchor: ResolvedAnchor;
  isSelected: boolean;
  onSelect: (anchor: ResolvedAnchor) => void;
  t: (key: string, fallback?: string) => string;
};

const truncate = (text: string, maxLen: number = 90): string =>
  text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;

const AnchorRow = ({ anchor, isSelected, onSelect, t }: AnchorRowProps): ReactElement => {
  const { showPreview, hidePreview } = useHoverPreview();
  const [movesExpanded, setMovesExpanded] = useState<boolean>(false);

  const handleRowClick = useCallback((): void => {
    onSelect(anchor);
  }, [anchor, onSelect]);

  const handleBoardIconMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
      showPreview(anchor.fen, anchor.lastMove, rect);
    },
    [anchor.fen, anchor.lastMove, showPreview],
  );

  const handleBoardIconMouseLeave = useCallback((): void => {
    hidePreview();
  }, [hidePreview]);

  const handleToggleMoves = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      setMovesExpanded((v) => !v);
    },
    [],
  );

  return (
    <div
      className={["anchor-list-row", isSelected ? "anchor-list-row--selected" : ""].filter(Boolean).join(" ")}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e): void => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(anchor); }
      }}
    >
      <div className="anchor-list-row-header">
        <span className="anchor-list-anchor-icon" aria-hidden="true">⚓</span>
        <span className="anchor-list-id-badge">{anchor.id}</span>
        <span className="anchor-list-text">{anchor.text}</span>
        <button
          type="button"
          className="anchor-list-board-icon"
          aria-label={t("anchorList.boardPreview", "Preview position")}
          title={t("anchorList.boardPreview", "Preview position")}
          onMouseEnter={handleBoardIconMouseEnter}
          onMouseLeave={handleBoardIconMouseLeave}
          onClick={(e): void => { e.stopPropagation(); }}
        >
          ♔
        </button>
      </div>

      {(anchor.precedingCommentText || anchor.followingCommentText) && (
        <div className="anchor-list-context">
          {anchor.precedingCommentText && (
            <span className="anchor-list-context-text anchor-list-context-preceding">
              {truncate(anchor.precedingCommentText)}
            </span>
          )}
          {anchor.followingCommentText && (
            <span className="anchor-list-context-text anchor-list-context-following">
              {truncate(anchor.followingCommentText)}
            </span>
          )}
        </div>
      )}

      <div className="anchor-list-row-footer">
        <button
          type="button"
          className="anchor-list-toggle-moves"
          aria-label={movesExpanded ? t("anchorList.hideMoves", "Hide moves") : t("anchorList.showMoves", "Show moves")}
          onClick={handleToggleMoves}
        >
          {movesExpanded
            ? t("anchorList.hideMoves", "Hide moves")
            : t("anchorList.showMoves", "Show moves")}
        </button>
      </div>

      {movesExpanded && anchor.movePath && (
        <div className="anchor-list-move-path">
          {anchor.movePath}
        </div>
      )}
    </div>
  );
};

// ── AnchorList ────────────────────────────────────────────────────────────────

/**
 * Filterable list of anchors. Each row shows the anchor text, ID, context
 * comments, an optional moves-to-anchor expander, and a board-icon hover preview.
 */
export const AnchorList = ({
  anchors,
  query,
  selectedId,
  onSelect,
  t,
}: AnchorListProps): ReactElement => {
  const lowerQuery: string = query.toLowerCase();
  const filtered: ResolvedAnchor[] = query.trim()
    ? anchors.filter(
        (a) =>
          a.text.toLowerCase().includes(lowerQuery) ||
          a.id.toLowerCase().includes(lowerQuery) ||
          a.movePath.toLowerCase().includes(lowerQuery),
      )
    : anchors;

  if (filtered.length === 0) {
    return (
      <div className="anchor-list-empty">
        {query.trim()
          ? t("anchorList.noResults", "No anchors match your search")
          : t("anchorList.noAnchors", "No anchors defined in this game")}
      </div>
    );
  }

  return (
    <div className="anchor-list" role="listbox">
      {filtered.map((anchor) => (
        <AnchorRow
          key={anchor.id}
          anchor={anchor}
          isSelected={anchor.id === selectedId}
          onSelect={onSelect}
          t={t}
        />
      ))}
    </div>
  );
};
