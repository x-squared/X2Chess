/**
 * shape_serializer — serializes `BoardShape[]` back to PGN `[%csl]`/`[%cal]`
 * annotation strings, and strips existing shape annotations from raw comment text.
 *
 * Integration API:
 * - `serializeShapes(shapes)` — convert a shape list to annotation string(s)
 *   suitable for embedding in a PGN comment.
 * - `stripShapeAnnotations(raw)` — remove any `[%csl ...]` and `[%cal ...]`
 *   blocks from a raw comment string, leaving the rest intact.
 * - To update a move's shape annotations: strip the old ones, append the new
 *   serialized string, then save via `setCommentTextById`.
 *
 * Configuration API:
 * - No configuration.
 *
 * Communication API:
 * - Pure functions; no side effects.
 */

import type { BoardArrow, BoardShape, ShapeColor, SquareHighlight } from "./board_shapes";

/** Maps `ShapeColor` back to the single-character PGN prefix. */
const COLOR_TO_PREFIX: Readonly<Record<ShapeColor, string>> = {
  green: "G",
  red: "R",
  yellow: "Y",
  blue: "B",
};

/**
 * Serialize a `BoardShape[]` into a `[%csl ...]` / `[%cal ...]` annotation
 * string.  Returns an empty string when `shapes` is empty.
 * Highlights and arrows are emitted in separate blocks.
 * Tokens within each block are sorted deterministically (color then square)
 * so PGN diffs remain stable.
 *
 * @param shapes - Array of board decorations to encode.
 * @returns Annotation string, e.g. `"[%csl Ge4,Ra1] [%cal Ge2e4]"`, or `""`.
 */
export const serializeShapes = (shapes: BoardShape[]): string => {
  const highlights: SquareHighlight[] = shapes.filter(
    (s: BoardShape): s is SquareHighlight => s.kind === "highlight",
  );
  const arrows: BoardArrow[] = shapes.filter(
    (s: BoardShape): s is BoardArrow => s.kind === "arrow",
  );

  const parts: string[] = [];

  if (highlights.length > 0) {
    const tokens: string[] = highlights
      .map((h: SquareHighlight): string => `${COLOR_TO_PREFIX[h.color]}${h.square}`)
      .sort();
    parts.push(`[%csl ${tokens.join(",")}]`);
  }

  if (arrows.length > 0) {
    const tokens: string[] = arrows
      .map((a: BoardArrow): string => `${COLOR_TO_PREFIX[a.color]}${a.from}${a.to}`)
      .sort();
    parts.push(`[%cal ${tokens.join(",")}]`);
  }

  return parts.join(" ");
};

/**
 * Remove all `[%csl ...]` and `[%cal ...]` blocks from a raw PGN comment
 * string, collapsing any resulting extra whitespace.  The remainder of the
 * comment (plain text, other annotations) is preserved unchanged.
 *
 * @param raw - Raw PGN comment text (without surrounding `{ }`).
 * @returns The comment with all shape annotation blocks removed.
 */
export const stripShapeAnnotations = (raw: string): string =>
  raw.replace(/\[%c(?:sl|al)\s+[^\]]*\]/gi, "").replace(/\s{2,}/g, " ").trim();
