/**
 * TruncationMenu — context menu for truncation and variation management operations
 * on a PGN move node.
 *
 * Integration API:
 * - `<TruncationMenu moveId={...} san={...} isInVariation={...} onAction={...}
 *     onClose={...} anchorRect={...} t={...} />`
 *   Renders as a floating context menu positioned relative to `anchorRect`.
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onAction(action)` fires with a `TruncationAction` describing what was chosen.
 * - `onClose()` fires when the menu is dismissed without a choice.
 */

import {
  useEffect,
  useRef,
  useCallback,
  type ReactElement,
} from "react";

export type TruncationAction =
  | { type: "insert_comment_before"; moveId: string }
  | { type: "insert_comment_after"; moveId: string }
  | { type: "insert_qa"; moveId: string }
  | { type: "insert_todo"; moveId: string }
  | { type: "insert_link"; moveId: string }
  | { type: "delete_from_here"; moveId: string }
  | { type: "delete_before_here"; moveId: string }
  | { type: "delete_variation"; moveId: string }
  | { type: "delete_variations_after"; moveId: string }
  | { type: "promote_to_mainline"; moveId: string };

type TruncationMenuProps = {
  moveId: string;
  /** SAN of the move (shown in confirmation text). */
  san: string;
  /** True when the cursor is inside a variation (RAV), not the root line. */
  isInVariation: boolean;
  /** Bounding rect of the move token that was right-clicked. */
  anchorRect: DOMRect;
  t: (key: string, fallback?: string) => string;
  onAction: (action: TruncationAction) => void;
  onClose: () => void;
};

/**
 * Floating context menu with truncation and variation management actions.
 * Closes on outside click, Escape, or after a selection.
 */
export const TruncationMenu = ({
  moveId,
  san,
  isInVariation,
  anchorRect,
  t,
  onAction,
  onClose,
}: TruncationMenuProps): ReactElement => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Position below the anchor rect, constrained to viewport.
  const style = {
    position: "fixed" as const,
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    zIndex: 9999,
  };

  useEffect((): (() => void) => {
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("keydown", keyHandler, true);
    return (): void => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("keydown", keyHandler, true);
    };
  }, [onClose]);

  const pick = useCallback(
    (action: TruncationAction): void => {
      onAction(action);
      onClose();
    },
    [onAction, onClose],
  );

  return (
    <div ref={menuRef} className="truncation-menu" style={style} role="menu">
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onClick={(): void => { pick({ type: "insert_comment_before", moveId }); }}
      >
        {t("editor.insertBefore", "Insert comment before")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onClick={(): void => { pick({ type: "insert_comment_after", moveId }); }}
      >
        {t("editor.insertAfter", "Insert comment after")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onClick={(): void => { pick({ type: "insert_qa", moveId }); }}
      >
        {t("editor.insertQa", "Add Q/A annotation")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onClick={(): void => { pick({ type: "insert_todo", moveId }); }}
      >
        {t("editor.insertTodo", "Add TODO")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onClick={(): void => { pick({ type: "insert_link", moveId }); }}
      >
        {t("editor.insertGameLink", "Insert game link")}
      </button>
      <div className="truncation-menu-separator" />
      <button
        type="button"
        className="truncation-menu-item truncation-menu-item--danger"
        role="menuitem"
        onClick={(): void => {
          pick({ type: "delete_from_here", moveId });
        }}
      >
        {t("editor.trunc.deleteFrom", "Delete this move and all following")}
        {" "}
        <span className="truncation-menu-san">({san}…)</span>
      </button>

      <button
        type="button"
        className="truncation-menu-item truncation-menu-item--danger"
        role="menuitem"
        onClick={(): void => {
          pick({ type: "delete_before_here", moveId });
        }}
      >
        {t("editor.trunc.deleteBefore", "Delete all moves before this position")}
      </button>

      <div className="truncation-menu-separator" />

      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onClick={(): void => {
          pick({ type: "delete_variations_after", moveId });
        }}
      >
        {t("editor.trunc.deleteVarsAfter", "Delete all variations from here")}
      </button>

      {isInVariation && (
        <>
          <div className="truncation-menu-separator" />

          <button
            type="button"
            className="truncation-menu-item truncation-menu-item--danger"
            role="menuitem"
            onClick={(): void => {
              pick({ type: "delete_variation", moveId });
            }}
          >
            {t("editor.trunc.deleteVar", "Delete this variation")}
          </button>

          <button
            type="button"
            className="truncation-menu-item"
            role="menuitem"
            onClick={(): void => {
              pick({ type: "promote_to_mainline", moveId });
            }}
          >
            {t("editor.trunc.promote", "Promote variation to mainline")}
          </button>
        </>
      )}
    </div>
  );
};
