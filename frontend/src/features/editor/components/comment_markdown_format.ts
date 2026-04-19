/**
 * comment_markdown_format — DOM utility for applying Markdown formatting in a
 * focused `contentEditable` comment block.
 *
 * This module is intentionally kept separate from the pure-logic
 * `comment_markdown.ts` parser because it touches the DOM (`Selection`,
 * `document.execCommand`).  It must only be called from React component event
 * handlers after confirming that the active element is a comment block.
 *
 * Integration API:
 * - `applyMarkdownWrap(format)` — wraps the current selection (or inserts empty
 *   delimiters at the caret) with the Markdown syntax for `format`, inside the
 *   currently focused comment `contentEditable`.  Fires the `input` event
 *   automatically via `execCommand("insertText")` so changes flow through the
 *   normal `onEdit → saveCommentText` path.
 *
 * Configuration API:
 * - `CommentFormat` — the supported format names.
 *
 * Communication API:
 * - Side effects: modifies the DOM of the focused `contentEditable` element
 *   and fires a synthetic `input` event via `execCommand`.
 * - No React context or service reads.
 */

// ── Public types ──────────────────────────────────────────────────────────────

/** All comment formatting actions supported by the toolbar and keyboard shortcuts. */
export type CommentFormat = "bold" | "italic" | "underline" | "bullet_list" | "numbered_list";

// ── Internal delimiter map ────────────────────────────────────────────────────

type DelimiterPair = { open: string; close: string };

const INLINE_DELIMITERS: Readonly<Record<string, DelimiterPair>> = {
  bold: { open: "**", close: "**" },
  italic: { open: "*", close: "*" },
  underline: { open: "__", close: "__" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Insert `text` at the current caret position in a `contentEditable` element
 * using `execCommand("insertText")`, which preserves the browser undo stack.
 *
 * @param text Text to insert at the current selection.
 */
const insertAtCaret = (text: string): void => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  document.execCommand("insertText", false, text);
};

/**
 * Move the caret backwards by `count` characters using the Selection API.
 * Used to position the caret between freshly-inserted empty delimiters.
 *
 * @param count Number of characters to step backwards.
 */
const moveCaretBack = (count: number): void => {
  const sel: Selection | null = window.getSelection();
  if (!sel) return;
  for (let i: number = 0; i < count; i += 1) {
    sel.modify("move", "backward", "character");
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply a Markdown format to the currently focused comment `contentEditable`.
 *
 * For inline formats (bold, italic, underline):
 * - If text is selected: wraps the selection with the delimiter pair.
 * - If nothing is selected: inserts empty delimiters and positions the caret
 *   between them so the user can type the formatted content immediately.
 *
 * For block-level formats (bullet_list, numbered_list):
 * - Inserts the list prefix (`\n- ` or `\n1. `) at the current caret position.
 *
 * No-op when the active element is not a focused comment `contentEditable`.
 *
 * @param format The formatting action to apply.
 */
export const applyMarkdownWrap = (format: CommentFormat): void => {
  const el: Element | null = document.activeElement;
  if (!(el instanceof HTMLElement)) return;
  if (!el.isContentEditable) return;
  if (el.dataset["kind"] !== "comment") return;

  // ── List insertion ─────────────────────────────────────────────────────────
  if (format === "bullet_list") {
    insertAtCaret("\n- ");
    return;
  }
  if (format === "numbered_list") {
    insertAtCaret("\n1. ");
    return;
  }

  // ── Inline wrap ────────────────────────────────────────────────────────────
  const delimiters: DelimiterPair | undefined = INLINE_DELIMITERS[format];
  if (!delimiters) return;

  const sel: Selection | null = window.getSelection();
  if (!sel) return;

  const selectedText: string = sel.toString();

  if (selectedText.length > 0) {
    // Wrap the selected text with delimiters.
    // `insertText` replaces the current selection with the wrapped version.
    insertAtCaret(`${delimiters.open}${selectedText}${delimiters.close}`);
  } else {
    // No selection: insert both delimiters, then step the caret between them.
    insertAtCaret(`${delimiters.open}${delimiters.close}`);
    moveCaretBack(delimiters.close.length);
  }
};
