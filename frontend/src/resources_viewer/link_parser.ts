/**
 * link_parser — pure-logic helpers for `[%link ...]` PGN command annotations.
 *
 * Integration API:
 * - Exports: `parseLinkAnnotations`, `hasLinkAnnotations`, `stripLinkAnnotations`,
 *   `formatLinkAnnotation`, `replaceLinkAnnotation`, `appendLinkAnnotation`.
 *
 * Configuration API:
 * - Format: `[%link recordId="..." label="..."]`
 *   Both fields are double-quoted; `\"` escapes a literal quote inside a field.
 *   `recordId` is required. `label` is optional; omit it or leave it empty to
 *   show a generic link chip with the game title on hover.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LinkAnnotation = {
  /** Record ID of the linked game within the same resource. */
  recordId: string;
  /** Optional display label for the chip. Empty string when omitted. */
  label: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract a named string attribute from a raw `[%link ...]` attribute string.
 * Handles backslash-escaped quotes inside values.
 */
const parseAttr = (raw: string, name: string): string => {
  const re: RegExp = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`, "i");
  const m: RegExpExecArray | null = re.exec(raw);
  if (!m) return "";
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
};

const LINK_RE: RegExp = /\[%link\s+([^\]]*)\]/gi;

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Parse all `[%link ...]` annotations out of a PGN comment string.
 * Returns an empty array if none are present.
 *
 * @param commentText - Raw PGN comment string, possibly containing multiple annotations.
 * @returns Array of parsed `LinkAnnotation` objects, one per `[%link ...]` tag.
 */
export const parseLinkAnnotations = (commentText: string): LinkAnnotation[] => {
  const results: LinkAnnotation[] = [];
  const re: RegExp = new RegExp(LINK_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentText)) !== null) {
    results.push({
      recordId: parseAttr(m[1], "recordId"),
      label: parseAttr(m[1], "label"),
    });
  }
  return results;
};

/**
 * Return `true` if the comment string contains at least one `[%link ...]` command.
 *
 * @param commentText - Raw PGN comment string to test.
 */
export const hasLinkAnnotations = (commentText: string): boolean =>
  /\[%link\s/i.test(commentText);

/**
 * Remove all `[%link ...]` annotations from a PGN comment string.
 * Used to get the displayable text portion without annotation markup.
 *
 * @param commentText - Raw PGN comment string.
 * @returns Comment text with all `[%link ...]` tags removed and trimmed.
 */
export const stripLinkAnnotations = (commentText: string): string =>
  commentText.replace(/\[%link\s[^\]]*\]/gi, "").trim();

/**
 * Build a `[%link ...]` PGN command string from the given annotation fields.
 *
 * @param link - The annotation to serialise.
 * @returns A well-formed `[%link ...]` string.
 */
export const formatLinkAnnotation = (link: LinkAnnotation): string => {
  const escape = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const parts: string[] = [`recordId="${escape(link.recordId)}"`];
  if (link.label) parts.push(`label="${escape(link.label)}"`);
  return `[%link ${parts.join(" ")}]`;
};

/**
 * Replace the link annotation at `index` in `rawText` with `annotation`.
 * Pass `null` as `annotation` to delete it.
 *
 * @param rawText - The full raw comment string.
 * @param index - Zero-based index of the `[%link ...]` tag to replace.
 * @param annotation - Replacement annotation, or `null` to delete.
 * @returns Updated raw comment string with excess whitespace normalised.
 */
export const replaceLinkAnnotation = (
  rawText: string,
  index: number,
  annotation: LinkAnnotation | null,
): string => {
  let i: number = 0;
  return rawText
    .replace(/\[%link\s[^\]]*\]/gi, (match: string): string => {
      const result: string =
        i === index
          ? (annotation ? formatLinkAnnotation(annotation) : "")
          : match;
      i += 1;
      return result;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
};

/**
 * Append a new link annotation to the end of `rawText`.
 *
 * @param rawText - The current raw comment string.
 * @param annotation - The new annotation to append.
 * @returns Updated raw comment string with the annotation appended.
 */
export const appendLinkAnnotation = (rawText: string, annotation: LinkAnnotation): string => {
  const base: string = rawText.trim();
  return base ? `${base} ${formatLinkAnnotation(annotation)}` : formatLinkAnnotation(annotation);
};
