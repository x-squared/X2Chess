/**
 * board_shapes — shared types for board decoration: square highlights and
 * directional arrows.
 *
 * Integration API:
 * - Import types and helpers from this module wherever board decoration data
 *   needs to be created, consumed, or validated.
 * - `BoardKey`, `isBoardKey` replace the locally-declared copies that previously
 *   existed in `ChessBoard.tsx` and `board/runtime.ts`.
 *
 * Configuration API:
 * - `DEFAULT_PRESETS` provides the out-of-the-box primary/secondary colors.
 *
 * Communication API:
 * - Pure types and constants; no side effects.
 */

export type BoardFile = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type BoardRank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

/** Algebraic square identifier, e.g. `"e4"`, `"a1"`, `"h8"`. */
export type BoardKey = `${BoardFile}${BoardRank}`;

/** Return true when `v` is a valid board key. */
export const isBoardKey = (v: string): v is BoardKey => /^[a-h][1-8]$/.test(v);

/** The four named shape colours that map to PGN `[%csl]`/`[%cal]` prefixes. */
export type ShapeColor = "green" | "red" | "yellow" | "blue";

/**
 * A coloured highlight on a single square.
 * Rendered as a semi-transparent fill or border depending on the active style
 * mode (`shapes-fill` / `shapes-frame` class on `.board`).
 *
 * @param kind    - Discriminator; always `"highlight"`.
 * @param square  - The square to highlight, e.g. `"e4"`.
 * @param color   - The highlight color.
 */
export type SquareHighlight = {
  kind: "highlight";
  square: BoardKey;
  color: ShapeColor;
};

/**
 * A coloured directional arrow between two squares.
 * Rendered as an SVG arrow via Chessground's auto-shape layer.
 *
 * @param kind  - Discriminator; always `"arrow"`.
 * @param from  - Arrow origin square.
 * @param to    - Arrow destination square.
 * @param color - Arrow color.
 */
export type BoardArrow = {
  kind: "arrow";
  from: BoardKey;
  to: BoardKey;
  color: ShapeColor;
};

/** Union of all board decoration types. */
export type BoardShape = SquareHighlight | BoardArrow;

/**
 * User-configurable two-slot colour presets.
 * `primary` is triggered by plain right-click; `secondary` by Shift+right-click.
 *
 * @param primary   - Color for plain right-click gestures. Default `"green"`.
 * @param secondary - Color for Shift+right-click gestures. Default `"red"`.
 */
export type ShapePresets = {
  primary: ShapeColor;
  secondary: ShapeColor;
};

/** Default preset mapping used when no user preference is stored. */
export const DEFAULT_PRESETS: ShapePresets = {
  primary: "green",
  secondary: "red",
};
