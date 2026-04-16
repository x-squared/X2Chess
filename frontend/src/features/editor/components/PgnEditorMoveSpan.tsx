/**
 * MoveSpan — renders a clickable SAN move token in the PGN text editor.
 *
 * Integration API:
 * - `<MoveSpan token={...} isSelected={...} onMoveClick={...} ... />`
 * - Used inside `TokenView`; no context required.
 *
 * Configuration API:
 * - `token: InlineToken` — the inline move token from the plan.
 * - `isSelected: boolean` — highlights the token as the active game position.
 * - `onMoveClick: (moveId) => void` — navigate to move on click/Enter.
 * - `onContextMenu: (moveId, san, isInVariation, rect) => void` — open context menu on right-click.
 * - `onMoveHover?: (moveId, rect) => void` — position preview on pointer enter.
 * - `onMoveHoverEnd?: () => void` — dismiss position preview on pointer leave.
 *
 * Communication API:
 * - Outbound: `onMoveClick`, `onContextMenu`, `onMoveHover`, `onMoveHoverEnd`.
 */

import { useCallback } from "react";
import type { ReactElement, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react";
import type { InlineToken } from "../model/text_editor_plan";
import { log } from "../../../logger";

// ── MoveSpan ──────────────────────────────────────────────────────────────────

export type MoveSpanProps = {
  /** The inline move token from the plan. */
  token: InlineToken;
  /** Whether this move is the currently selected move in the game. */
  isSelected: boolean;
  /**
   * Called when the user activates this move token.
   * @param moveId - PGN move node ID.
   */
  onMoveClick: (moveId: string) => void;
  /** Called when the user right-clicks a move to open the context menu. */
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
  /** Called when the pointer enters a move span (for position preview). */
  onMoveHover?: (moveId: string, rect: DOMRect) => void;
  /** Called when the pointer leaves a move span. */
  onMoveHoverEnd?: () => void;
};

/** Renders a clickable SAN move token. Right-click opens the context menu. */
export const MoveSpan = ({
  token,
  isSelected,
  onMoveClick,
  onContextMenu,
  onMoveHover,
  onMoveHoverEnd,
}: MoveSpanProps): ReactElement => {
  const moveId: string = String(token.dataset.nodeId ?? "");

  const handleClick = useCallback((): void => {
    try {
      onMoveClick(moveId);
    } catch (err: unknown) {
      const message: string = err instanceof Error ? err.message : String(err);
      log.error("PgnTextEditor", `MoveSpan.handleClick failed: moveId=${moveId} err="${message}"`);
    }
  }, [moveId, onMoveClick]);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      // Prevent browser text-selection on right-click (mousedown fires before contextmenu).
      if (e.button === 2) e.preventDefault();
    },
    [],
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
      const isInVariation = (token.dataset.variationDepth as number ?? 0) > 0;
      onContextMenu(moveId, token.text, isInVariation, rect);
    },
    [moveId, token.text, token.dataset.variationDepth, onContextMenu],
  );

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      onMoveHover?.(moveId, (e.currentTarget as HTMLSpanElement).getBoundingClientRect());
    },
    [moveId, onMoveHover],
  );

  const handleMouseLeave = useCallback((): void => {
    onMoveHoverEnd?.();
  }, [onMoveHoverEnd]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onMoveClick(moveId);
      return;
    }
    // Prevent browser text-selection (Shift+Arrow) and scroll (Arrow) defaults
    // while a move span has focus. Navigation is handled at window level.
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
    }
  };

  const className: string = [token.className, isSelected ? "text-editor-move-selected" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={className}
      data-kind="move"
      data-token-type="move"
      data-node-id={moveId}
      data-variation-depth={String(token.dataset.variationDepth ?? 0)}
      data-move-side={String(token.dataset.moveSide ?? "")}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {token.text}
    </span>
  );
};
