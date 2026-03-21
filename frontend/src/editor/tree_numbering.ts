/**
 * Tree variation numbering strategies.
 *
 * A `VariationNumberingStrategy` maps a variation path to a human-readable label.
 * The path passed to the strategy is the numbering path — the structural `variationPath`
 * with the leading root segment `[0]` stripped.
 *
 * Examples using `alphaNumericPathStrategy`:
 *   [0]      → "A"    (first top-level RAV)
 *   [1]      → "B"    (second top-level RAV)
 *   [0, 0]   → "A.1"  (first sub-RAV of A)
 *   [0, 1]   → "A.2"  (second sub-RAV of A)
 *   [0, 0, 0]→ "A.1.1"
 *   [1, 0]   → "B.1"
 */

export type VariationNumberingStrategy = (path: readonly number[]) => string;

/**
 * Default numbering strategy.
 * - Depth-0 segment: uppercase letter (0 → A, 1 → B, …).
 * - Deeper segments: 1-based integer.
 * - Segments joined with ".".
 */
export const alphaNumericPathStrategy: VariationNumberingStrategy = (path: readonly number[]): string => {
  if (path.length === 0) return "";
  return path
    .map((index: number, depth: number): string =>
      depth === 0 ? String.fromCharCode(65 + index) : (index + 1).toString(),
    )
    .join(".");
};
