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
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
  type ReactElement,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { NagRow } from "./NagPicker";
import { UI_IDS } from "../../../core/model/ui_ids";
import { NAG_MOVE_QUALITY, NAG_EVALUATION, NAG_POSITIONAL } from "../../../../../parts/pgnparser/src/nag_defs";

export type TruncationAction =
  | { type: "insert_comment_before"; moveId: string }
  | { type: "insert_comment_after"; moveId: string }
  | { type: "insert_null_move_after"; moveId: string }
  | { type: "insert_qa"; moveId: string }
  | { type: "insert_train"; moveId: string }
  | { type: "insert_todo"; moveId: string }
  | { type: "insert_link"; moveId: string }
  | { type: "insert_anchor"; moveId: string; san: string }
  | { type: "toggle_nag"; moveId: string; nag: string }
  | { type: "delete_from_here"; moveId: string }
  | { type: "delete_null_move"; moveId: string }
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
  /** NAG codes currently on this move, for rendering active state. */
  currentNags: readonly string[];
  /** Side to move, for resolving color-specific NAGs. */
  moveSide: "white" | "black";
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
  currentNags,
  moveSide,
  t,
  onAction,
  onClose,
}: TruncationMenuProps): ReactElement => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    zIndex: 9999,
    visibility: "hidden",
  });

  // After the menu renders, measure its width and clamp so it stays on-screen.
  useLayoutEffect((): void => {
    const el = menuRef.current;
    if (!el) return;
    const menuWidth = el.offsetWidth;
    const left = Math.min(anchorRect.left, window.innerWidth - menuWidth - 8);
    setStyle({
      position: "fixed",
      top: anchorRect.bottom + 4,
      left: Math.max(8, left),
      zIndex: 9999,
    });
  }, [anchorRect]);

  useEffect((): (() => void) => {
    const handler = (e: MouseEvent): void => {
      const menuEl: HTMLDivElement | null = menuRef.current;
      if (!menuEl) return;
      const path: EventTarget[] = typeof e.composedPath === "function" ? e.composedPath() : [];
      const clickedInside: boolean = path.includes(menuEl)
        || (e.target instanceof Node && menuEl.contains(e.target));
      if (!clickedInside) {
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

  const handleNagToggle = useCallback(
    (nag: string): void => { onAction({ type: "toggle_nag", moveId, nag }); },
    [onAction, moveId],
  );

  const handlePickMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, action: TruncationAction): void => {
      e.preventDefault();
      e.stopPropagation();
      pick(action);
    },
    [pick],
  );

  return (
    <div
      ref={menuRef}
      className="truncation-menu"
      style={style}
      role="menu"
      data-ui-id={UI_IDS.TRUNCATION_MENU}
    >
      {/* ── NAG annotation ─── */}
      <div className="truncation-menu-nag-section">
        <span className="truncation-menu-nag-label">
          {t("editor.nag.moveSymbol", "Move")}
        </span>
        <NagRow defs={NAG_MOVE_QUALITY} currentNags={currentNags} moveSide={moveSide} onToggle={handleNagToggle} />
        <span className="truncation-menu-nag-label">
          {t("editor.nag.evaluation", "Eval")}
        </span>
        <NagRow defs={NAG_EVALUATION} currentNags={currentNags} moveSide={moveSide} onToggle={handleNagToggle} />
        <span className="truncation-menu-nag-label">
          {t("editor.nag.position", "Position")}
        </span>
        <NagRow defs={NAG_POSITIONAL} currentNags={currentNags} moveSide={moveSide} onToggle={handleNagToggle} />
      </div>
      <div className="truncation-menu-separator" />
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_comment_before", moveId }); }}
      >
        {t("editor.insertBefore", "Insert comment before")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_comment_after", moveId }); }}
      >
        {t("editor.insertAfter", "Insert comment after")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_null_move_after", moveId }); }}
      >
        {t("editor.insertNullMoveAfter", "Insert null move after")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_qa", moveId }); }}
      >
        {t("editor.insertQa", "Add Q/A annotation")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_train", moveId }); }}
      >
        {t("editor.insertTrain", "Add training tag")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_todo", moveId }); }}
      >
        {t("editor.insertTodo", "Add TODO")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_link", moveId }); }}
      >
        {t("editor.insertGameLink", "Insert game link")}
      </button>
      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "insert_anchor", moveId, san }); }}
      >
        {t("editor.insertAnchor", "Add anchor")}
      </button>
      <div className="truncation-menu-separator" />
      <button
        type="button"
        className="truncation-menu-item truncation-menu-item--danger"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "delete_from_here", moveId }); }}
      >
        {t("editor.trunc.deleteFrom", "Delete this move and all following")}
        {" "}
        <span className="truncation-menu-san">({san}…)</span>
      </button>

      {san === "--" && (
        <button
          type="button"
          className="truncation-menu-item truncation-menu-item--danger"
          role="menuitem"
          onMouseDown={(e): void => { handlePickMouseDown(e, { type: "delete_null_move", moveId }); }}
        >
          {t("editor.trunc.deleteNullMove", "Delete this null move")}
        </button>
      )}

      <button
        type="button"
        className="truncation-menu-item truncation-menu-item--danger"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "delete_before_here", moveId }); }}
      >
        {t("editor.trunc.deleteBefore", "Delete all moves before this position")}
      </button>

      <div className="truncation-menu-separator" />

      <button
        type="button"
        className="truncation-menu-item"
        role="menuitem"
        onMouseDown={(e): void => { handlePickMouseDown(e, { type: "delete_variations_after", moveId }); }}
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
            onMouseDown={(e): void => { handlePickMouseDown(e, { type: "delete_variation", moveId }); }}
          >
            {t("editor.trunc.deleteVar", "Delete this variation")}
          </button>

          <button
            type="button"
            className="truncation-menu-item"
            role="menuitem"
            onMouseDown={(e): void => { handlePickMouseDown(e, { type: "promote_to_mainline", moveId }); }}
          >
            {t("editor.trunc.promote", "Promote variation to mainline")}
          </button>
        </>
      )}
    </div>
  );
};
