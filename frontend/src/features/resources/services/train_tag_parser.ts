/**
 * train_tag_parser — pure-logic helpers for `[%train ...]` PGN command annotations.
 *
 * Integration API:
 * - Exports: `parseTrainTag`, `hasTrainAnnotation`, `stripTrainAnnotation`,
 *            `formatTrainTag`, `replaceTrainTag`, `appendTrainTag`.
 *
 * Configuration API:
 * - Format: `[%train accept="e2e4,d2d4" reject="f2f3" hint="Control the center"]`
 *   All field values are double-quoted; `\"` escapes a literal quote inside a value.
 *   All three fields are optional; the tag itself may be bare `[%train]`.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type TrainTag = {
  /** UCI moves accepted as fully correct (in addition to the mainline move). */
  accept: string[];
  /** UCI moves that trigger a trap warning rather than a generic rejection. */
  reject: string[];
  /** Text shown when the user requests a hint. */
  hint?: string;
};

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Extract a named string attribute from a raw `[%train ...]` attribute string.
 * Handles backslash-escaped quotes inside values.
 */
const parseAttr = (raw: string, name: string): string => {
  const re = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`, "i");
  const m = re.exec(raw);
  if (!m) return "";
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
};

const splitUcis = (raw: string): string[] =>
  raw ? raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0) : [];

const TRAIN_RE = /\[%train\b([^\]]*)\]/i;

// ── Exports ────────────────────────────────────────────────────────────────────

/**
 * Extract the `[%train]` tag from a PGN comment string.
 * Returns `null` if no tag is present. Only the first tag is read.
 */
export const parseTrainTag = (commentText: string): TrainTag | null => {
  const m = TRAIN_RE.exec(commentText);
  if (!m) return null;
  const body = m[1] ?? "";
  return {
    accept: splitUcis(parseAttr(body, "accept")),
    reject: splitUcis(parseAttr(body, "reject")),
    hint: parseAttr(body, "hint") || undefined,
  };
};

/**
 * Return `true` if the comment string contains a `[%train]` tag.
 */
export const hasTrainAnnotation = (commentText: string): boolean =>
  /\[%train\b/i.test(commentText);

/**
 * Remove the `[%train ...]` tag from a PGN comment string.
 * Used to get the displayable text without annotation markup.
 */
export const stripTrainAnnotation = (commentText: string): string =>
  commentText.replace(/\[%train\b[^\]]*\]/gi, "").trim();

/**
 * Build a `[%train ...]` PGN command string from the given tag fields.
 */
export const formatTrainTag = (tag: TrainTag): string => {
  const escape = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const parts: string[] = [];
  if (tag.accept.length > 0) parts.push(`accept="${escape(tag.accept.join(","))}"`);
  if (tag.reject.length > 0) parts.push(`reject="${escape(tag.reject.join(","))}"`);
  if (tag.hint) parts.push(`hint="${escape(tag.hint)}"`);
  return parts.length > 0 ? `[%train ${parts.join(" ")}]` : "[%train]";
};

/**
 * Replace the `[%train]` tag in `rawText` with `tag`.
 * Pass `null` as `tag` to delete it.
 */
export const replaceTrainTag = (
  rawText: string,
  tag: TrainTag | null,
): string =>
  rawText
    .replace(/\[%train\b[^\]]*\]/gi, tag ? formatTrainTag(tag) : "")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Append a `[%train]` tag to the end of `rawText`.
 * If a tag already exists it is replaced.
 */
export const appendTrainTag = (rawText: string, tag: TrainTag): string => {
  if (hasTrainAnnotation(rawText)) return replaceTrainTag(rawText, tag);
  const base = rawText.trim();
  return base ? `${base} ${formatTrainTag(tag)}` : formatTrainTag(tag);
};
