/**
 * CommentBlock — renders a single PGN comment with view/edit modes.
 *
 * Integration API:
 * - `<CommentBlock token={...} isFocused={...} onFocusHandled={...} onEdit={...} />`
 * - Used inside `TokenView`; no context required.
 *
 * Configuration API:
 * - `token: CommentToken` — comment metadata and display text.
 * - `isFocused: boolean` — whether this comment should receive focus on mount.
 * - `onFocusHandled: (commentId) => void` — called after one-time autofocus.
 * - `onEdit: (commentId, newText) => void` — called on every user keystroke.
 *
 * Communication API:
 * - Outbound: `onEdit`, `onFocusHandled`.
 * - No inbound context reads; purely prop-driven.
 */

import { useState, useRef, useEffect } from "react";
import type { ReactElement, FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react";
import { splitCommentUrls } from "../model/comment_url_utils";
import type { CommentSegment } from "../model/comment_url_utils";
import { openExternalUrl } from "../../../resources/open_url";
import type { CommentToken } from "../model/text_editor_plan";

/** Meta/Ctrl shortcut letter → execCommand style name for comment formatting. */
export const FORMAT_KEYS: Readonly<Record<string, string>> = {
  b: "bold",
  i: "italic",
  u: "underline",
} as const;

// ── CommentBlock ──────────────────────────────────────────────────────────────

export type CommentBlockProps = {
  /** Token carrying comment metadata and display text. */
  token: CommentToken;
  /**
   * Whether this comment should receive focus immediately after mount.
   * Set when the comment was just inserted by the user.
   */
  isFocused: boolean;
  /** Called after one-time autofocus was consumed for this comment. */
  onFocusHandled: (commentId: string) => void;
  /**
   * Called on every user keystroke inside the contentEditable element.
   * @param commentId - The PGN comment node ID.
   * @param newText - Current `innerText` of the div after the edit.
   */
  onEdit: (commentId: string, newText: string) => void;
};

/**
 * Renders a single PGN comment with a view/edit split.
 *
 * **View mode** (default): a static div whose text is split into literal and
 * URL segments.  Detected URLs render as `<a>` elements that open in the
 * system browser on click.  Clicking anywhere else on the div activates edit
 * mode.
 *
 * **Edit mode**: a `contentEditable` div.  The element is semi-uncontrolled:
 * `innerText` is set on entry and whenever `token.text` changes from an
 * external source (e.g. QA dialog save, layout-mode switch).  User keystrokes
 * are NOT overwritten — a ref flag (`isUserEditPending`) suppresses the
 * reactive update for the one render cycle immediately following an `onInput`
 * event.  Blur returns the block to view mode.
 *
 * Cmd/Ctrl+B/I/U apply bold, italic, and underline formatting via `execCommand`.
 * In plain/tree mode (`plainLiteralComment=true`), Enter inserts `[[br]]`
 * rather than a raw newline.
 */
export const CommentBlock = ({ token, isFocused, onEdit, onFocusHandled }: CommentBlockProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  // Newly-inserted comments start in edit mode immediately.
  const [isEditMode, setIsEditMode] = useState<boolean>(isFocused);
  // True for exactly one render cycle after the user makes an edit, so we
  // skip the reactive innerText update and avoid clobbering the user's caret.
  const isUserEditPending = useRef<boolean>(false);

  // Sync innerText into the contentEditable whenever we enter edit mode or
  // the model provides a new display value.
  useEffect((): void => {
    if (!isEditMode) return;
    if (isUserEditPending.current) {
      isUserEditPending.current = false;
      return;
    }
    if (ref.current) ref.current.innerText = token.text;
  }, [isEditMode, token.text]);

  /** Move caret to end when this comment should receive focus (new insert). */
  useEffect((): void => {
    if (!isFocused || !ref.current) return;
    setIsEditMode(true);
    ref.current.focus();
    const sel: Selection | null = window.getSelection();
    if (!sel) return;
    const range: Range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    onFocusHandled(token.commentId);
  }, [isFocused, onFocusHandled, token.commentId]);

  const handleInput = (e: FormEvent<HTMLDivElement>): void => {
    isUserEditPending.current = true;
    onEdit(token.commentId, (e.currentTarget as HTMLDivElement).innerText);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    // In plain/tree mode, Enter inserts the canonical [[br]] marker rather than
    // a raw newline, keeping line-break markup visible and editable.
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && token.plainLiteralComment) {
      e.preventDefault();
      // execCommand is deprecated but remains the only reliable way to insert
      // text at the caret position inside a contentEditable element.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertText", false, "[[br]]");
      return;
    }
    const withMeta: boolean = e.metaKey || e.ctrlKey;
    if (!withMeta) return;
    const command: string | undefined = FORMAT_KEYS[e.key.toLowerCase()];
    if (!command) return;
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command);
  };

  const className: string = [
    "text-editor-comment",
    "text-editor-comment-block",
    token.introStyling ? "text-editor-comment-intro" : "",
    token.plainLiteralComment ? "plain" : "",
    isFocused ? "text-editor-comment-new" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ── Edit mode: contentEditable ─────────────────────────────────────────────
  if (isEditMode) {
    return (
      <div
        key={`comment_edit_${token.commentId}`}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={className}
        data-kind="comment"
        data-comment-id={token.commentId}
        data-variation-depth={String(token.variationDepth)}
        data-focus-first-comment-at-start={token.focusFirstCommentAtStart ? "true" : undefined}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={(): void => { setIsEditMode(false); }}
      />
    );
  }

  // ── View mode: static render with clickable URLs ───────────────────────────
  const segments: CommentSegment[] = splitCommentUrls(token.text);
  return (
    <div
      key={`comment_view_${token.commentId}`}
      className={className}
      data-kind="comment"
      data-comment-id={token.commentId}
      data-variation-depth={String(token.variationDepth)}
      data-focus-first-comment-at-start={token.focusFirstCommentAtStart ? "true" : undefined}
      onClick={(): void => { setIsEditMode(true); }}
    >
      {segments.map((seg: CommentSegment, i: number): ReactElement =>
        seg.kind === "url" ? (
          <a
            key={i}
            href={seg.href}
            className="comment-url-link"
            onClick={(e: MouseEvent<HTMLAnchorElement>): void => {
              e.preventDefault();
              e.stopPropagation(); // don't activate edit mode
              openExternalUrl(seg.href);
            }}
          >
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  );
};
