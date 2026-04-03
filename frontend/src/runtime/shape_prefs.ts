/**
 * Shape and board decoration preferences — persisted to localStorage.
 *
 * Integration API:
 * - `readShapePrefs()` — call once on startup to obtain initial preferences.
 * - `writeShapePrefs(prefs)` — persist updated preferences; call from the
 *   `setShapePrefs` service callback.
 * - `shapePrefsStore` — underlying versioned store (injectable backend for tests).
 *
 * Configuration API:
 * - `DEFAULT_SHAPE_PREFS` — shipped defaults applied when no stored value exists.
 */

import type { ShapeColor } from "../board/board_shapes";
import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";

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

/**
 * Validate and coerce a parsed unknown value into a `ShapePrefs`.
 * Used as the v0→v1 migration step to handle raw legacy payloads.
 */
const coerceShapePrefs = (raw: unknown): ShapePrefs => {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SHAPE_PREFS };
  const p = raw as Record<string, unknown>;
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
};

/**
 * Versioned localStorage store for board shape preferences.
 *
 * The key already carried an ad-hoc `.v1` suffix, so stored data is already
 * in the versioned form — no migration steps are required.
 */
export const shapePrefsStore: VersionedStore<ShapePrefs> = createVersionedStore<ShapePrefs>({
  key: SHAPE_PREFS_STORAGE_KEY,
  version: 1,
  defaultValue: DEFAULT_SHAPE_PREFS,
  // v0 (raw legacy payload) → v1: coerce field by field.
  migrations: [coerceShapePrefs],
});

/** Read persisted preferences, falling back to defaults for any missing or invalid field. */
export const readShapePrefs = (): ShapePrefs => shapePrefsStore.read();

/** Write preferences to localStorage. */
export const writeShapePrefs = (prefs: ShapePrefs): void => shapePrefsStore.write(prefs);
