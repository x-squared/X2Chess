/**
 * shape_parser — parses PGN `[%csl ...]` and `[%cal ...]` comment annotations
 * into typed `BoardShape` values.
 *
 * Integration API:
 * - Call `parseShapes(commentRaw)` with the raw text of a PGN comment node.
 *   Returns a flat array of `BoardShape` values ready for rendering.
 *
 * Configuration API:
 * - No configuration; behaviour is determined entirely by the input string.
 *
 * Communication API:
 * - Pure function; no side effects, no imports from React or DOM.
 */

import { isBoardKey } from "./board_shapes";
import type { BoardShape, ShapeColor } from "./board_shapes";

/**
 * Maps the single-character PGN color prefix to our `ShapeColor` domain type.
 * Standard: R=red, Y=yellow, G=green, B=blue.
 */
const COLOR_PREFIX: Readonly<Record<string, ShapeColor>> = {
  R: "red",
  Y: "yellow",
  G: "green",
  B: "blue",
};

/**
 * Parse one `[%csl <tokens>]` block from a PGN comment string.
 * Each token is `<ColorPrefix><square>`, e.g. `Ge4`, `Ra1`.
 * Malformed or unrecognised tokens are silently dropped.
 *
 * @param block - The raw token list string (everything inside `[%csl ...]`).
 * @returns Array of `SquareHighlight` shapes.
 */
const parseCslBlock = (block: string): BoardShape[] => {
  const shapes: BoardShape[] = [];
  const tokens: string[] = block.split(",").map((t: string): string => t.trim());
  for (const token of tokens) {
    if (token.length < 3) continue;
    const prefix: string = token[0];
    const square: string = token.slice(1, 3);
    const color: ShapeColor | undefined = COLOR_PREFIX[prefix];
    if (!color || !isBoardKey(square)) continue;
    shapes.push({ kind: "highlight", square, color });
  }
  return shapes;
};

/**
 * Parse one `[%cal <tokens>]` block from a PGN comment string.
 * Each token is `<ColorPrefix><from><to>`, e.g. `Ge2e4`, `Rd1h5`.
 * Malformed or unrecognised tokens are silently dropped.
 *
 * @param block - The raw token list string (everything inside `[%cal ...]`).
 * @returns Array of `BoardArrow` shapes.
 */
const parseCalBlock = (block: string): BoardShape[] => {
  const shapes: BoardShape[] = [];
  const tokens: string[] = block.split(",").map((t: string): string => t.trim());
  for (const token of tokens) {
    if (token.length < 5) continue;
    const prefix: string = token[0];
    const from: string = token.slice(1, 3);
    const to: string = token.slice(3, 5);
    const color: ShapeColor | undefined = COLOR_PREFIX[prefix];
    if (!color || !isBoardKey(from) || !isBoardKey(to)) continue;
    if (from === to) continue; // zero-length arrows are not meaningful
    shapes.push({ kind: "arrow", from, to, color });
  }
  return shapes;
};

/**
 * Parse all `[%csl ...]` and `[%cal ...]` annotations in a PGN comment string.
 * Multiple blocks of each type are supported within a single comment.
 * Malformed tokens are silently dropped; an empty or annotation-free comment
 * returns `[]`.
 *
 * @param comment - Raw PGN comment string (without the surrounding `{ }`).
 * @returns Flat array of all `BoardShape` values found in the comment.
 */
export const parseShapes = (comment: string): BoardShape[] => {
  const shapes: BoardShape[] = [];
  const cslRe: RegExp = /\[%csl\s+([^\]]+)\]/gi;
  const calRe: RegExp = /\[%cal\s+([^\]]+)\]/gi;

  let m: RegExpExecArray | null = cslRe.exec(comment);
  while (m) {
    shapes.push(...parseCslBlock(m[1]));
    m = cslRe.exec(comment);
  }

  m = calRe.exec(comment);
  while (m) {
    shapes.push(...parseCalBlock(m[1]));
    m = calRe.exec(comment);
  }

  return shapes;
};
