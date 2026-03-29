/**
 * eval_parser — pure-logic helpers for `[%eval ...]` PGN command annotations.
 *
 * Integration API:
 * - Exports: `parseEvalAnnotations`, `hasEvalAnnotations`, `stripEvalAnnotations`,
 *   `formatEvalAnnotation`, `replaceEvalAnnotation`, `formatEvalDisplay`.
 *
 * Configuration API:
 * - Format: `[%eval N.NN]` — centipawn score as a decimal, e.g. `[%eval 0.17]`,
 *   `[%eval -1.23]`.
 * - Format: `[%eval #N]` — forced mate, e.g. `[%eval #5]` (side to move mates
 *   in 5), `[%eval #-3]` (side to move is mated in 3).
 * - The value field is unquoted, unlike string-attribute annotations.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvalAnnotation = {
  /**
   * Raw value string exactly as it appeared in the PGN comment, e.g. `"0.17"`,
   * `"-1.23"`, `"#5"`, `"#-3"`.
   */
  value: string;
};

// ── Internal ──────────────────────────────────────────────────────────────────

const EVAL_RE: RegExp = /\[%eval\s+([^\]]+)\]/gi;

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Parse all `[%eval ...]` annotations out of a PGN comment string.
 * Returns an empty array when none are present.
 *
 * @param commentText - Raw PGN comment string.
 * @returns Array of parsed `EvalAnnotation` objects in order of occurrence.
 */
export const parseEvalAnnotations = (commentText: string): EvalAnnotation[] => {
  const results: EvalAnnotation[] = [];
  const re: RegExp = new RegExp(EVAL_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentText)) !== null) {
    results.push({ value: m[1].trim() });
  }
  return results;
};

/**
 * Return `true` if the comment string contains at least one `[%eval ...]` command.
 *
 * @param commentText - Raw PGN comment string.
 */
export const hasEvalAnnotations = (commentText: string): boolean =>
  /\[%eval\s/i.test(commentText);

/**
 * Remove all `[%eval ...]` annotations from a PGN comment string.
 * Used to obtain the displayable text portion without annotation markup.
 *
 * @param commentText - Raw PGN comment string.
 * @returns The comment with all eval annotations stripped and whitespace trimmed.
 */
export const stripEvalAnnotations = (commentText: string): string =>
  commentText.replace(/\[%eval\s+[^\]]+\]/gi, "").trim();

/**
 * Build a `[%eval ...]` PGN command string from the given annotation.
 *
 * @param annotation - The annotation whose `value` to format.
 * @returns A string of the form `[%eval <value>]`.
 */
export const formatEvalAnnotation = (annotation: EvalAnnotation): string =>
  `[%eval ${annotation.value}]`;

/**
 * Replace the eval annotation at `index` in `rawText` with `annotation`.
 * Pass `null` as `annotation` to delete that entry.
 * Collapses any resulting double spaces and trims.
 *
 * @param rawText    - Original raw PGN comment string.
 * @param index      - Zero-based index of the annotation to replace.
 * @param annotation - Replacement value, or `null` to delete.
 * @returns Updated raw comment string.
 */
export const replaceEvalAnnotation = (
  rawText: string,
  index: number,
  annotation: EvalAnnotation | null,
): string => {
  let i: number = 0;
  return rawText
    .replace(/\[%eval\s+[^\]]+\]/gi, (match: string): string => {
      const result: string =
        i === index
          ? annotation ? formatEvalAnnotation(annotation) : ""
          : match;
      i++;
      return result;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
};

/**
 * Format an eval value string for human-readable display.
 *
 * - Centipawn scores: `"0.17"` → `"+0.17"`, `"-1.23"` → `"-1.23"`, `"0.00"` → `"0.00"`.
 * - Mate scores: `"#5"` → `"#5"`, `"#-3"` → `"#-3"` (returned as-is).
 * - Unrecognised strings: returned unchanged.
 *
 * @param value - The raw value string from `EvalAnnotation.value`.
 * @returns Formatted display string.
 */
export const formatEvalDisplay = (value: string): string => {
  if (value.startsWith("#")) return value;
  const n: number = parseFloat(value);
  if (isNaN(n)) return value;
  if (n > 0) return `+${n.toFixed(2)}`;
  return n.toFixed(2);
};
