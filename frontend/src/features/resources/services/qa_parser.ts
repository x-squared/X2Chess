/**
 * qa_parser — pure-logic helpers for `[%qa ...]` PGN command annotations.
 *
 * Integration API:
 * - Exports: `parseQaAnnotations`, `hasQaAnnotations`, `stripQaAnnotations`.
 *
 * Configuration API:
 * - Format: `[%qa question="..." answer="..." hint="..."]`
 *   All fields are double-quoted; `\"` escapes a literal quote inside a field.
 *   Only `question` and `answer` are required; `hint` is optional.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type QaAnnotation = {
  question: string;
  answer: string;
  hint: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract a named string attribute from a raw `[%qa ...]` attribute string.
 * Handles backslash-escaped quotes inside values.
 */
const parseAttr = (raw: string, name: string): string => {
  const re = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`, "i");
  const m = re.exec(raw);
  if (!m) return "";
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
};

const QA_RE = /\[%qa\s+([^\]]*)\]/gi;

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Parse all `[%qa ...]` annotations out of a PGN comment string.
 * Returns an empty array if none are present.
 */
export const parseQaAnnotations = (commentText: string): QaAnnotation[] => {
  const results: QaAnnotation[] = [];
  const re = new RegExp(QA_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentText)) !== null) {
    results.push({
      question: parseAttr(m[1], "question"),
      answer: parseAttr(m[1], "answer"),
      hint: parseAttr(m[1], "hint"),
    });
  }
  return results;
};

/**
 * Return `true` if the comment string contains at least one `[%qa ...]` command.
 */
export const hasQaAnnotations = (commentText: string): boolean =>
  /\[%qa\s/i.test(commentText);

/**
 * Remove all `[%qa ...]` annotations from a PGN comment string.
 * Used to get the displayable text portion without annotation markup.
 */
export const stripQaAnnotations = (commentText: string): string =>
  commentText.replace(/\[%qa\s[^\]]*\]/gi, "").trim();

/**
 * Build a `[%qa ...]` PGN command string from the given annotation fields.
 */
export const formatQaAnnotation = (qa: QaAnnotation): string => {
  const escape = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const parts = [`question="${escape(qa.question)}"`, `answer="${escape(qa.answer)}"`];
  if (qa.hint) parts.push(`hint="${escape(qa.hint)}"`);
  return `[%qa ${parts.join(" ")}]`;
};

/**
 * Replace the Q/A annotation at `index` in `rawText` with `annotation`.
 * Pass `null` as `annotation` to delete it.
 */
export const replaceQaAnnotation = (
  rawText: string,
  index: number,
  annotation: QaAnnotation | null,
): string => {
  let i = 0;
  return rawText.replace(/\[%qa\s[^\]]*\]/gi, (match: string): string => {
    const result =
      i === index
        ? (annotation ? formatQaAnnotation(annotation) : "")
        : match;
    i++;
    return result;
  }).replace(/\s{2,}/g, " ").trim();
};

/**
 * Append a new Q/A annotation to the end of `rawText`.
 */
export const appendQaAnnotation = (rawText: string, annotation: QaAnnotation): string => {
  const base = rawText.trim();
  return base ? `${base} ${formatQaAnnotation(annotation)}` : formatQaAnnotation(annotation);
};
