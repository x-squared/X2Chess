/**
 * anchor_parser — pure-logic helpers for `[%anchor ...]` and `[%anchorref ...]`
 * PGN command annotations.
 *
 * Integration API:
 * - Exports: `parseAnchorAnnotations`, `hasAnchorAnnotations`, `stripAnchorAnnotations`,
 *   `formatAnchorAnnotation`, `replaceAnchorAnnotation`, `appendAnchorAnnotation`.
 * - Exports: `parseAnchorRefAnnotations`, `hasAnchorRefAnnotations`, `stripAnchorRefAnnotations`,
 *   `formatAnchorRefAnnotation`, `replaceAnchorRefAnnotation`, `appendAnchorRefAnnotation`.
 *
 * Configuration API:
 * - Anchor definition format: `[%anchor id="..." text="..."]`
 *   Both fields are required and double-quoted; `\"` escapes a literal quote.
 * - Anchor reference format: `[%anchorref id="..."]`
 *   The `id` field is required and double-quoted.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnchorAnnotation = {
  /** Short identifier, unique within the game. */
  id: string;
  /** Human-readable label displayed in lists and hover tooltips. */
  text: string;
};

export type AnchorRefAnnotation = {
  /** ID of the referenced anchor within the same game. */
  id: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract a named string attribute from a raw `[%anchor ...]` or
 * `[%anchorref ...]` attribute string.
 * Handles backslash-escaped quotes inside values.
 */
const parseAttr = (raw: string, name: string): string => {
  const re: RegExp = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`, "i");
  const m: RegExpExecArray | null = re.exec(raw);
  if (!m) return "";
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
};

const ANCHOR_RE: RegExp = /\[%anchor\s+([^\]]*)\]/gi;
const ANCHORREF_RE: RegExp = /\[%anchorref\s+([^\]]*)\]/gi;

// ── Anchor definition exports ─────────────────────────────────────────────────

/**
 * Parse all `[%anchor ...]` annotations out of a PGN comment string.
 * Returns an empty array if none are present.
 *
 * @param commentText - Raw PGN comment string.
 * @returns Array of parsed `AnchorAnnotation` objects.
 */
export const parseAnchorAnnotations = (commentText: string): AnchorAnnotation[] => {
  const results: AnchorAnnotation[] = [];
  const re: RegExp = new RegExp(ANCHOR_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentText)) !== null) {
    results.push({
      id: parseAttr(m[1], "id"),
      text: parseAttr(m[1], "text"),
    });
  }
  return results;
};

/**
 * Return `true` if the comment string contains at least one `[%anchor ...]` command.
 *
 * @param commentText - Raw PGN comment string to test.
 */
export const hasAnchorAnnotations = (commentText: string): boolean =>
  /\[%anchor\s/i.test(commentText);

/**
 * Remove all `[%anchor ...]` annotations from a PGN comment string.
 * Used to get the displayable text portion without annotation markup.
 *
 * @param commentText - Raw PGN comment string.
 * @returns Comment text with all `[%anchor ...]` tags removed and trimmed.
 */
export const stripAnchorAnnotations = (commentText: string): string =>
  commentText.replace(/\[%anchor\s[^\]]*\]/gi, "").trim();

/**
 * Build a `[%anchor ...]` PGN command string from the given annotation.
 *
 * @param anchor - The annotation to serialise.
 * @returns A well-formed `[%anchor ...]` string.
 */
export const formatAnchorAnnotation = (anchor: AnchorAnnotation): string => {
  const escape = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[%anchor id="${escape(anchor.id)}" text="${escape(anchor.text)}"]`;
};

/**
 * Replace the anchor annotation at `index` in `rawText` with `annotation`.
 * Pass `null` as `annotation` to delete it.
 *
 * @param rawText - The full raw comment string.
 * @param index - Zero-based index of the `[%anchor ...]` tag to replace.
 * @param annotation - Replacement annotation, or `null` to delete.
 * @returns Updated raw comment string with excess whitespace normalised.
 */
export const replaceAnchorAnnotation = (
  rawText: string,
  index: number,
  annotation: AnchorAnnotation | null,
): string => {
  let i: number = 0;
  return rawText
    .replace(/\[%anchor\s[^\]]*\]/gi, (match: string): string => {
      const result: string =
        i === index ? (annotation ? formatAnchorAnnotation(annotation) : "") : match;
      i += 1;
      return result;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
};

/**
 * Append a new anchor annotation to the end of `rawText`.
 *
 * @param rawText - The current raw comment string.
 * @param annotation - The new annotation to append.
 * @returns Updated raw comment string with the annotation appended.
 */
export const appendAnchorAnnotation = (rawText: string, annotation: AnchorAnnotation): string => {
  const base: string = rawText.trim();
  return base
    ? `${base} ${formatAnchorAnnotation(annotation)}`
    : formatAnchorAnnotation(annotation);
};

// ── Anchor reference exports ──────────────────────────────────────────────────

/**
 * Parse all `[%anchorref ...]` annotations out of a PGN comment string.
 * Returns an empty array if none are present.
 *
 * @param commentText - Raw PGN comment string.
 * @returns Array of parsed `AnchorRefAnnotation` objects.
 */
export const parseAnchorRefAnnotations = (commentText: string): AnchorRefAnnotation[] => {
  const results: AnchorRefAnnotation[] = [];
  const re: RegExp = new RegExp(ANCHORREF_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentText)) !== null) {
    results.push({
      id: parseAttr(m[1], "id"),
    });
  }
  return results;
};

/**
 * Return `true` if the comment string contains at least one `[%anchorref ...]` command.
 *
 * @param commentText - Raw PGN comment string to test.
 */
export const hasAnchorRefAnnotations = (commentText: string): boolean =>
  /\[%anchorref\s/i.test(commentText);

/**
 * Remove all `[%anchorref ...]` annotations from a PGN comment string.
 *
 * @param commentText - Raw PGN comment string.
 * @returns Comment text with all `[%anchorref ...]` tags removed and trimmed.
 */
export const stripAnchorRefAnnotations = (commentText: string): string =>
  commentText.replace(/\[%anchorref\s[^\]]*\]/gi, "").trim();

/**
 * Build a `[%anchorref ...]` PGN command string from the given annotation.
 *
 * @param ref - The annotation to serialise.
 * @returns A well-formed `[%anchorref ...]` string.
 */
export const formatAnchorRefAnnotation = (ref: AnchorRefAnnotation): string => {
  const escape = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[%anchorref id="${escape(ref.id)}"]`;
};

/**
 * Replace the anchor reference at `index` in `rawText` with `ref`.
 * Pass `null` as `ref` to delete it.
 *
 * @param rawText - The full raw comment string.
 * @param index - Zero-based index of the `[%anchorref ...]` tag to replace.
 * @param ref - Replacement reference, or `null` to delete.
 * @returns Updated raw comment string with excess whitespace normalised.
 */
export const replaceAnchorRefAnnotation = (
  rawText: string,
  index: number,
  ref: AnchorRefAnnotation | null,
): string => {
  let i: number = 0;
  return rawText
    .replace(/\[%anchorref\s[^\]]*\]/gi, (match: string): string => {
      const result: string =
        i === index ? (ref ? formatAnchorRefAnnotation(ref) : "") : match;
      i += 1;
      return result;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
};

/**
 * Append a new anchor reference annotation to the end of `rawText`.
 *
 * @param rawText - The current raw comment string.
 * @param ref - The new reference to append.
 * @returns Updated raw comment string with the reference appended.
 */
export const appendAnchorRefAnnotation = (rawText: string, ref: AnchorRefAnnotation): string => {
  const base: string = rawText.trim();
  return base
    ? `${base} ${formatAnchorRefAnnotation(ref)}`
    : formatAnchorRefAnnotation(ref);
};
