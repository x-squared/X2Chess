/**
 * HoverPositionPopup — floating mini-board portal for position-on-hover.
 *
 * Intent:
 * - Render a small chess board near the hovered move token, outside the
 *   normal DOM flow, so it is never clipped by overflow:hidden parents.
 *
 * Integration API:
 * - Place once inside `HoverPreviewProvider` (typically in AppShell):
 *   `<HoverPositionPopup />`
 * - No props — reads state from `HoverPreviewContext`.
 *
 * Configuration API:
 * - Board size is fixed at 200 × 200 px.
 *
 * Communication API:
 * - None. Purely reactive to `HoverPreviewContext`.
 */

import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import { useAppContext } from "../../app/providers/AppStateProvider";
import { selectBoardFlipped } from "../../core/state/selectors";
import { useHoverPreview } from "./HoverPreviewContext";
import { MiniBoard } from "./MiniBoard";

const BOARD_SIZE = 200;

/** Portal-mounted position preview popup. Reads from `HoverPreviewContext`. */
export const HoverPositionPopup = (): ReactElement | null => {
  const { previewState } = useHoverPreview();
  const { state } = useAppContext();
  const boardFlipped = selectBoardFlipped(state);

  if (!previewState) return null;

  return createPortal(
    <div
      className="hover-position-popup"
      style={{ left: previewState.x, top: previewState.y }}
      aria-hidden="true"
    >
      <MiniBoard
        fen={previewState.fen}
        lastMove={previewState.lastMove}
        size={BOARD_SIZE}
        orientation={boardFlipped ? "black" : "white"}
      />
    </div>,
    document.body,
  );
};
