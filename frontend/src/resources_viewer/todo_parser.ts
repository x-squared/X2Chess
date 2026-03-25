/**
 * todo_parser — pure-logic helpers for `[%todo ...]` PGN command annotations.
 *
 * Integration API:
 * - Exports: `parseTodoAnnotations`, `hasTodoAnnotations`, `stripTodoAnnotations`.
 *
 * Configuration API:
 * - Format: `[%todo text="..."]`
 *   The `text` field is double-quoted; `\"` escapes a literal quote inside a field.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TodoAnnotation = {
  text: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract a named string attribute from a raw `[%todo ...]` attribute string.
 * Handles backslash-escaped quotes inside values.
 */
const parseAttr = (raw: string, name: string): string => {
  const re = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`, "i");
  const m = re.exec(raw);
  if (!m) return "";
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
};

const TODO_RE = /\[%todo\s+([^\]]*)\]/gi;

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Parse all `[%todo ...]` annotations out of a PGN comment string.
 * Returns an empty array if none are present.
 */
export const parseTodoAnnotations = (commentText: string): TodoAnnotation[] => {
  const results: TodoAnnotation[] = [];
  const re = new RegExp(TODO_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(commentText)) !== null) {
    results.push({ text: parseAttr(m[1], "text") });
  }
  return results;
};

/**
 * Return `true` if the comment string contains at least one `[%todo ...]` command.
 */
export const hasTodoAnnotations = (commentText: string): boolean =>
  /\[%todo\s/i.test(commentText);

/**
 * Remove all `[%todo ...]` annotations from a PGN comment string.
 * Used to get the displayable text portion without annotation markup.
 */
export const stripTodoAnnotations = (commentText: string): string =>
  commentText.replace(/\[%todo\s[^\]]*\]/gi, "").trim();

/**
 * Build a `[%todo ...]` PGN command string from the given annotation fields.
 */
export const formatTodoAnnotation = (todo: TodoAnnotation): string => {
  const escape = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[%todo text="${escape(todo.text)}"]`;
};

/**
 * Replace the TODO annotation at `index` in `rawText` with `annotation`.
 * Pass `null` as `annotation` to delete it.
 */
export const replaceTodoAnnotation = (
  rawText: string,
  index: number,
  annotation: TodoAnnotation | null,
): string => {
  let i = 0;
  return rawText.replace(/\[%todo\s[^\]]*\]/gi, (match: string): string => {
    const result =
      i === index
        ? (annotation ? formatTodoAnnotation(annotation) : "")
        : match;
    i++;
    return result;
  }).replace(/\s{2,}/g, " ").trim();
};

/**
 * Append a new TODO annotation to the end of `rawText`.
 */
export const appendTodoAnnotation = (rawText: string, annotation: TodoAnnotation): string => {
  const base = rawText.trim();
  return base ? `${base} ${formatTodoAnnotation(annotation)}` : formatTodoAnnotation(annotation);
};
