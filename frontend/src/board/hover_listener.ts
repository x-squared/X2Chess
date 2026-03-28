/**
 * hover_listener — attaches mouseover/mouseleave listeners to the board element
 * to detect when the cursor enters or leaves a square occupied by a piece.
 *
 * Integration API:
 * - Call `attachHoverListener(opts)` once after the board element is mounted.
 *   Store and invoke the returned disposer on unmount.
 *
 * Configuration API:
 * - `HoverListenerOptions.boardEl`     — the `.board` wrapper element.
 * - `HoverListenerOptions.onPieceEnter` — fired with the square key whenever
 *   the cursor moves over a square that contains a piece.
 * - `HoverListenerOptions.onPieceLeave` — fired when the cursor leaves all
 *   piece squares (either to an empty square or off the board entirely).
 *
 * Communication API:
 * - Fires `onPieceEnter` / `onPieceLeave` as the cursor moves; caller owns
 *   state and rendering.
 * - No React imports; no Tauri imports.
 */

import type { BoardKey } from "./board_shapes";
import { isBoardKey } from "./board_shapes";

export type HoverListenerOptions = {
  /** The `.board` wrapper element that contains the Chessground `cg-board`. */
  boardEl: HTMLElement;
  /**
   * Called when the cursor enters a square that has a piece element.
   *
   * @param square - The board key of the hovered square, e.g. `"e4"`.
   */
  onPieceEnter: (square: BoardKey) => void;
  /**
   * Called when the cursor leaves a piece square (either moves to an empty
   * square or exits the board entirely).
   */
  onPieceLeave: () => void;
};

/**
 * Walk up from `target` to find the nearest element with a `cgKey` property.
 * Returns `null` if no keyed ancestor is found before `cg-board`.
 *
 * @param target - Event target to start from.
 */
const getCgKey = (target: EventTarget | null): string | null => {
  let el: Element | null = target instanceof Element ? target : null;
  while (el) {
    const key: unknown = (el as unknown as Record<string, unknown>)["cgKey"];
    if (typeof key === "string") return key;
    if (el.tagName.toLowerCase() === "cg-board") break;
    el = el.parentElement;
  }
  return null;
};

/**
 * Return true when `el` is a Chessground piece element (tag name `"PIECE"`).
 * Piece elements have a `.cgKey` that matches their parent square.
 *
 * @param el - Element to test.
 */
const isPieceElement = (el: Element): boolean => el.tagName.toUpperCase() === "PIECE";

/**
 * Attach hover detection listeners to `boardEl`.
 * Returns a disposer; call it to clean up (e.g. in a React `useEffect` return).
 *
 * @param opts - Listener configuration (boardEl, onPieceEnter, onPieceLeave).
 */
export const attachHoverListener = (opts: HoverListenerOptions): (() => void) => {
  const { boardEl, onPieceEnter, onPieceLeave } = opts;

  const onMouseOver = (e: MouseEvent): void => {
    const target: EventTarget | null = e.target;
    if (!(target instanceof Element)) return;

    // Fire onPieceEnter only when the immediate target is a piece element.
    if (isPieceElement(target)) {
      const key: string | null = getCgKey(target);
      if (key && isBoardKey(key)) {
        onPieceEnter(key);
        return;
      }
    }

    // Moved to a square without a piece (or somewhere else) → clear hints.
    onPieceLeave();
  };

  const onMouseLeave = (): void => {
    onPieceLeave();
  };

  boardEl.addEventListener("mouseover", onMouseOver);
  boardEl.addEventListener("mouseleave", onMouseLeave);

  return (): void => {
    boardEl.removeEventListener("mouseover", onMouseOver);
    boardEl.removeEventListener("mouseleave", onMouseLeave);
  };
};
