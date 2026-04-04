import { useRef, useEffect } from "react";
import type { RefObject } from "react";

/**
 * Wires up the board/editor column resize handle.
 *
 * Dragging the handle updates `--board-column-width` on `document.documentElement`.
 *
 * @returns `boardEditorBoxRef` and `boardResizeHandleRef` to attach to the corresponding DOM elements.
 */
export const useBoardColumnResize = (): {
  boardEditorBoxRef: RefObject<HTMLDivElement | null>;
  boardResizeHandleRef: RefObject<HTMLDivElement | null>;
} => {
  const boardEditorBoxRef = useRef<HTMLDivElement>(null);
  const boardResizeHandleRef = useRef<HTMLDivElement>(null);
  const intendedBoardWidthRef = useRef<number>(520);

  useEffect((): (() => void) => {
    const handleEl = boardResizeHandleRef.current;
    const boxEl = boardEditorBoxRef.current;
    if (!handleEl || !boxEl) return (): void => {};

    const clamp = (px: number): number => Math.max(260, Math.min(680, Math.round(px)));
    const setWidth = (px: number): void => {
      const clamped = clamp(px);
      document.documentElement.style.setProperty("--board-column-width", `${clamped}px`);
      intendedBoardWidthRef.current = clamped;
    };

    let dragState: { leftPx: number; handleHalfPx: number } | null = null;

    const onMove = (e: PointerEvent): void => {
      if (!dragState) return;
      setWidth(e.clientX - dragState.leftPx - dragState.handleHalfPx);
    };
    const onUp = (): void => { dragState = null; };

    const onDown = (e: PointerEvent): void => {
      const boxRect = boxEl.getBoundingClientRect();
      const hRect = handleEl.getBoundingClientRect();
      dragState = {
        leftPx: boxRect.left,
        handleHalfPx: Math.max(2, Math.round(hRect.width / 2)),
      };
      handleEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    handleEl.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return (): void => {
      handleEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return { boardEditorBoxRef, boardResizeHandleRef };
};
