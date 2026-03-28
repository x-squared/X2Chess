/**
 * board — public API for board navigation, decoration, and gesture modules.
 *
 * Integration API:
 * - `createBoardCapabilities(state)` — navigation helpers over shared board state.
 * - Board shape types and helpers: `BoardKey`, `isBoardKey`, `ShapeColor`,
 *   `BoardShape`, `SquareHighlight`, `BoardArrow`, `ShapePresets`, `DEFAULT_PRESETS`.
 * - Shape parsing / serialization: `parseShapes`, `serializeShapes`,
 *   `stripShapeAnnotations`.
 * - Gesture and hover listeners: `attachDrawableGestures`, `attachHoverListener`.
 * - Move hint computation: `MoveHint`, `computeMoveHints`.
 *
 * Configuration API:
 * - `createBoardCapabilities(state)` expects `{ currentPly, moves }`.
 *
 * Communication API:
 * - All exports are pure functions or factory functions; the only side effects
 *   are the DOM listeners created by `attachDrawableGestures` /
 *   `attachHoverListener` (cleaned up via the returned disposers).
 */

// ── Navigation capabilities ───────────────────────────────────────────────────
type BoardState = {
  currentPly: number;
  moves: string[];
};

type BoardCapabilities = {
  getCurrentPly: () => number;
  getMoveCount: () => number;
};

export const createBoardCapabilities = (state: BoardState): BoardCapabilities => ({
  getCurrentPly: (): number => state.currentPly,
  getMoveCount: (): number => state.moves.length,
});

// ── Shared types ──────────────────────────────────────────────────────────────
export type {
  BoardFile,
  BoardRank,
  BoardKey,
  ShapeColor,
  SquareHighlight,
  BoardArrow,
  BoardShape,
  ShapePresets,
} from "./board_shapes";
export { isBoardKey, DEFAULT_PRESETS } from "./board_shapes";

// ── Shape parsing and serialization ──────────────────────────────────────────
export { parseShapes } from "./shape_parser";
export { serializeShapes, stripShapeAnnotations } from "./shape_serializer";

// ── Gesture and hover listeners ───────────────────────────────────────────────
export type { DrawableGestureOptions } from "./drawable_gestures";
export { attachDrawableGestures } from "./drawable_gestures";
export type { HoverListenerOptions } from "./hover_listener";
export { attachHoverListener } from "./hover_listener";

// ── Move hints ────────────────────────────────────────────────────────────────
export type { MoveHint } from "./move_hints";
export { computeMoveHints } from "./move_hints";
