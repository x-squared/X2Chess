/**
 * drawable_gestures — attaches right-click gesture listeners to the board
 * element to let the user draw and erase square highlights and arrows.
 *
 * Gesture model:
 * - Right-click a square           → toggle primary-colour highlight
 * - Shift + right-click a square   → toggle secondary-colour highlight
 * - Right-click drag to another sq → toggle primary-colour arrow
 * - Shift + right-click drag       → toggle secondary-colour arrow
 * - Right-click empty board area   → clear all shapes for the current ply
 * Click vs drag is distinguished by a 4-pixel movement threshold.
 *
 * Integration API:
 * - Call `attachDrawableGestures(opts, getCurrentShapes)` once after the
 *   board element is created. Store and call the returned disposer when the
 *   board is destroyed.
 *
 * Configuration API:
 * - `DrawableGestureOptions.boardEl`     — the `.board` container element.
 * - `DrawableGestureOptions.presets`     — primary / secondary color mapping.
 * - `DrawableGestureOptions.onChange`    — called with the updated full shape
 *   list after each gesture completes.
 *
 * Communication API:
 * - Fires `onChange(shapes)` on every completed gesture; caller owns state.
 * - No React imports; no Tauri imports. Accepts and manipulates DOM elements
 *   passed in as parameters only.
 */

import type { BoardKey, BoardShape, ShapeColor, ShapePresets } from "./board_shapes";
import { isBoardKey } from "./board_shapes";

/** Minimum pixel movement to treat a right-click-hold as a drag. */
const DRAG_THRESHOLD_PX: number = 4;

export type DrawableGestureOptions = {
  /** The `.board` wrapper element that contains the Chessground `cg-board`. */
  boardEl: HTMLElement;
  /** Primary / secondary colour presets. */
  presets: ShapePresets;
  /**
   * Called after every completed gesture with the new full shape list.
   * The array is a new reference on every call.
   *
   * @param shapes - Updated board decoration array.
   */
  onChange: (shapes: BoardShape[]) => void;
};

/**
 * Walk up from `target` through its DOM ancestors (stopping at a `cg-board`)
 * to find the first element that carries a Chessground `cgKey` property.
 * Returns the key string, or `null` if none is found.
 *
 * @param target - The event's initial target element.
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
 * Return whether two shapes are identical (same kind, squares, and colour).
 * Used to detect toggle (add if absent, remove if present).
 *
 * @param a - First shape.
 * @param b - Second shape to compare against.
 */
const shapesEqual = (a: BoardShape, b: BoardShape): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === "highlight" && b.kind === "highlight") {
    return a.square === b.square && a.color === b.color;
  }
  if (a.kind === "arrow" && b.kind === "arrow") {
    return a.from === b.from && a.to === b.to && a.color === b.color;
  }
  return false;
};

/**
 * Toggle `shape` in `current`: remove it if an identical shape already exists,
 * otherwise append it. Returns a new array.
 *
 * @param current - Existing shape array.
 * @param shape   - Shape to toggle.
 */
const toggleShape = (current: BoardShape[], shape: BoardShape): BoardShape[] => {
  const idx: number = current.findIndex((s: BoardShape): boolean => shapesEqual(s, shape));
  if (idx !== -1) {
    return [...current.slice(0, idx), ...current.slice(idx + 1)];
  }
  return [...current, shape];
};

/**
 * Attach right-click gesture listeners to `boardEl`.
 * Returns a disposer function; call it to remove all listeners (e.g. on
 * component unmount).
 *
 * @param opts             - Configuration (boardEl, presets, onChange).
 * @param getCurrentShapes - Getter that returns the current shape array; called
 *                           at gesture-end time so the handler always sees the
 *                           latest state even if React hasn't re-rendered yet.
 */
export const attachDrawableGestures = (
  opts: DrawableGestureOptions,
  getCurrentShapes: () => BoardShape[],
): (() => void) => {
  const { boardEl, presets, onChange } = opts;

  let dragStartKey: BoardKey | null = null;
  let dragStartX: number = 0;
  let dragStartY: number = 0;
  let dragIsShift: boolean = false;
  let isDragging: boolean = false;

  const onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  const onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 2) return;
    const raw: string | null = getCgKey(e.target);
    if (!raw || !isBoardKey(raw)) {
      // Right-click on empty board area — clear all shapes.
      onChange([]);
      return;
    }
    dragStartKey = raw;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragIsShift = e.shiftKey;
    isDragging = false;
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (dragStartKey === null) return;
    const dx: number = e.clientX - dragStartX;
    const dy: number = e.clientY - dragStartY;
    if (!isDragging && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD_PX) {
      isDragging = true;
    }
  };

  const onMouseUp = (e: MouseEvent): void => {
    if (e.button !== 2 || dragStartKey === null) return;

    const color: ShapeColor = dragIsShift ? presets.secondary : presets.primary;

    if (!isDragging) {
      // Plain right-click → toggle highlight on startKey.
      const shape: BoardShape = { kind: "highlight", square: dragStartKey, color };
      onChange(toggleShape(getCurrentShapes(), shape));
    } else {
      // Drag → toggle arrow from startKey to the square under the cursor.
      const endRaw: string | null = getCgKey(e.target);
      if (endRaw && isBoardKey(endRaw) && endRaw !== dragStartKey) {
        const shape: BoardShape = { kind: "arrow", from: dragStartKey, to: endRaw, color };
        onChange(toggleShape(getCurrentShapes(), shape));
      }
    }

    dragStartKey = null;
    isDragging = false;
  };

  boardEl.addEventListener("contextmenu", onContextMenu);
  boardEl.addEventListener("mousedown", onMouseDown);
  boardEl.addEventListener("mousemove", onMouseMove);
  boardEl.addEventListener("mouseup", onMouseUp);

  return (): void => {
    boardEl.removeEventListener("contextmenu", onContextMenu);
    boardEl.removeEventListener("mousedown", onMouseDown);
    boardEl.removeEventListener("mousemove", onMouseMove);
    boardEl.removeEventListener("mouseup", onMouseUp);
  };
};
