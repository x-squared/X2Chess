/**
 * Shape and board decoration preferences — persisted to localStorage.
 *
 * Integration API:
 * - `readShapePrefs()` — call once on startup to obtain initial preferences.
 * - `writeShapePrefs(prefs)` — persist updated preferences; call from the
 *   `setShapePrefs` service callback.
 *
 * Configuration API:
 * - `DEFAULT_SHAPE_PREFS` — shipped defaults applied when no stored value exists.
 */

import type { ShapeColor } from "../board/board_shapes";

export const SHAPE_PREFS_STORAGE_KEY = "x2chess.shapePrefs.v1";

/** How square highlights are rendered: filled overlay or inset border. */
export type SquareStyleMode = "fill" | "frame";

/** User-configurable board decoration preferences. */
export type ShapePrefs = {
  /** Color used for plain right-click gestures. */
  primaryColor: ShapeColor;
  /** Color used for Shift + right-click gestures. */
  secondaryColor: ShapeColor;
  /** Rendering style for square highlights. */
  squareStyle: SquareStyleMode;
  /** Whether to show legal-destination dots when hovering a piece. */
  showMoveHints: boolean;
};

export const DEFAULT_SHAPE_PREFS: ShapePrefs = {
  primaryColor: "green",
  secondaryColor: "red",
  squareStyle: "fill",
  showMoveHints: true,
};

const VALID_COLORS: ReadonlySet<string> = new Set(["green", "red", "yellow", "blue"]);
const VALID_STYLES: ReadonlySet<string> = new Set(["fill", "frame"]);

/** Read persisted preferences, falling back to defaults for any missing or invalid field. */
export const readShapePrefs = (): ShapePrefs => {
  try {
    const raw = window.localStorage?.getItem(SHAPE_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHAPE_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_SHAPE_PREFS };
    const p = parsed as Record<string, unknown>;
    return {
      primaryColor: VALID_COLORS.has(String(p["primaryColor"]))
        ? (p["primaryColor"] as ShapeColor)
        : DEFAULT_SHAPE_PREFS.primaryColor,
      secondaryColor: VALID_COLORS.has(String(p["secondaryColor"]))
        ? (p["secondaryColor"] as ShapeColor)
        : DEFAULT_SHAPE_PREFS.secondaryColor,
      squareStyle: VALID_STYLES.has(String(p["squareStyle"]))
        ? (p["squareStyle"] as SquareStyleMode)
        : DEFAULT_SHAPE_PREFS.squareStyle,
      showMoveHints:
        typeof p["showMoveHints"] === "boolean"
          ? p["showMoveHints"]
          : DEFAULT_SHAPE_PREFS.showMoveHints,
    };
  } catch {
    return { ...DEFAULT_SHAPE_PREFS };
  }
};

/** Write preferences to localStorage. */
export const writeShapePrefs = (prefs: ShapePrefs): void => {
  try {
    window.localStorage?.setItem(SHAPE_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Silently ignore storage errors (private browsing, quota exceeded).
  }
};
