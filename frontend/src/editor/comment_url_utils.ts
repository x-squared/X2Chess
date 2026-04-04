/**
 * comment_url_utils — URL detection and segmentation for comment text.
 *
 * Splits a raw comment string into literal-text and URL segments so that the
 * rendering layer can make detected URLs clickable without modifying the
 * underlying PGN data.
 *
 * Integration API:
 * - `splitCommentUrls(text)` — split text into segments for display.
 * - `CommentSegment` — the discriminated-union segment type.
 *
 * Pure-logic: no React, no DOM, no Tauri imports.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommentSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; href: string };

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * Matches http(s):// URLs and bare www. URLs.
 * Stops at whitespace; also stops before common trailing punctuation
 * (period/comma/parenthesis) that is unlikely to be part of the URL.
 */
const URL_PATTERN: RegExp = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)']|www\.[^\s<>"]+[^\s<>".,;:!?)']/g;

const normalizeHref = (raw: string): string =>
  raw.startsWith("http") ? raw : `https://${raw}`;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Split `text` into alternating literal-text and URL segments.
 *
 * Consecutive text segments are never emitted; an empty literal before the
 * first URL (or between adjacent URLs) is omitted.  The returned array is
 * always non-empty when `text` is non-empty.
 *
 * @param text - Raw display text of a PGN comment.
 * @returns Ordered array of segments suitable for inline rendering.
 */
export const splitCommentUrls = (text: string): CommentSegment[] => {
  const segments: CommentSegment[] = [];
  URL_PATTERN.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null = URL_PATTERN.exec(text);
  while (match) {
    if (match.index > last) {
      segments.push({ kind: "text", text: text.slice(last, match.index) });
    }
    segments.push({ kind: "url", text: match[0], href: normalizeHref(match[0]) });
    last = match.index + match[0].length;
    match = URL_PATTERN.exec(text);
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last) });
  }
  return segments;
};

/**
 * Returns true if `text` contains at least one detectable URL.
 * Cheaper than `splitCommentUrls` when you only need a presence check.
 */
export const hasUrls = (text: string): boolean => {
  URL_PATTERN.lastIndex = 0;
  return URL_PATTERN.test(text);
};
