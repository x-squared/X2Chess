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
 * - `onEditStart?: (commentId) => void` — called once at the start of each editing session.
 *
 * Communication API:
 * - Outbound: `onEdit`, `onFocusHandled`, `onEditStart`.
 * - No inbound context reads; purely prop-driven.
 */

import { useState, useRef, useEffect } from "react";
import type { ReactElement, ReactNode, FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react";
import { splitCommentUrls } from "../model/comment_url_utils";
import type { CommentSegment } from "../model/comment_url_utils";
import { parseCommentMarkdown } from "../model/comment_markdown";
import type { MarkdownBlock, MarkdownInlineNode } from "../model/comment_markdown";
import { applyMarkdownWrap } from "./comment_markdown_format";
import type { CommentFormat } from "./comment_markdown_format";
import { openExternalUrl } from "../../../resources/open_url";
import type { CommentToken } from "../model/text_editor_plan";

/** Meta/Ctrl shortcut letter → CommentFormat for comment formatting. */
export const FORMAT_KEYS: Readonly<Record<string, CommentFormat>> = {
  b: "bold",
  i: "italic",
  u: "underline",
} as const;

// ── Markdown rendering helpers ────────────────────────────────────────────────

/**
 * Render a single `MarkdownInlineNode` as a React node.
 * URL detection is applied to `text` leaf nodes via `splitCommentUrls`.
 *
 * @param node Inline node to render.
 * @param key React key string.
 * @returns A React node for the inline content.
 */
const renderInlineNode = (node: MarkdownInlineNode, key: string): ReactNode => {
  switch (node.kind) {
    case "text": {
      const segments: CommentSegment[] = splitCommentUrls(node.text);
      // Fast path: no URLs detected
      if (segments.length === 1 && segments[0].kind === "text") return node.text;
      return (
        <span key={key}>
          {segments.map((seg: CommentSegment, i: number): ReactNode =>
            seg.kind === "url" ? (
              <a
                key={i}
                href={seg.href}
                className="comment-url-link"
                onClick={(e: MouseEvent<HTMLAnchorElement>): void => {
                  e.preventDefault();
                  e.stopPropagation();
                  openExternalUrl(seg.href);
                }}
              >
                {seg.text}
              </a>
            ) : (
              seg.text
            )
          )}
        </span>
      );
    }
    case "bold":
      return (
        <b key={key}>
          {node.children.map((child: MarkdownInlineNode, i: number): ReactNode =>
            renderInlineNode(child, `${key}_${i}`)
          )}
        </b>
      );
    case "italic":
      return (
        <em key={key}>
          {node.children.map((child: MarkdownInlineNode, i: number): ReactNode =>
            renderInlineNode(child, `${key}_${i}`)
          )}
        </em>
      );
    case "underline":
      return (
        <u key={key}>
          {node.children.map((child: MarkdownInlineNode, i: number): ReactNode =>
            renderInlineNode(child, `${key}_${i}`)
          )}
        </u>
      );
  }
};

/**
 * Render a `MarkdownBlock[]` tree into React nodes for view mode.
 *
 * @param blocks Parsed block array from `parseCommentMarkdown`.
 * @returns Array of React nodes ready for insertion into the comment div.
 */
const renderMarkdownBlocks = (blocks: MarkdownBlock[]): ReactNode[] =>
  blocks.map((block: MarkdownBlock, blockIdx: number): ReactNode => {
    switch (block.kind) {
      case "inline":
        return (
          <span key={`md_inline_${blockIdx}`}>
            {block.nodes.map((n: MarkdownInlineNode, i: number): ReactNode =>
              renderInlineNode(n, `${blockIdx}_${i}`)
            )}
          </span>
        );
      case "bullet_list":
        return (
          <ul key={`md_ul_${blockIdx}`}>
            {block.items.map((item: MarkdownInlineNode[], itemIdx: number): ReactNode => (
              <li key={itemIdx}>
                {item.map((n: MarkdownInlineNode, i: number): ReactNode =>
                  renderInlineNode(n, `${blockIdx}_${itemIdx}_${i}`)
                )}
              </li>
            ))}
          </ul>
        );
      case "numbered_list":
        return (
          <ol key={`md_ol_${blockIdx}`}>
            {block.items.map((item: MarkdownInlineNode[], itemIdx: number): ReactNode => (
              <li key={itemIdx}>
                {item.map((n: MarkdownInlineNode, i: number): ReactNode =>
                  renderInlineNode(n, `${blockIdx}_${itemIdx}_${i}`)
                )}
              </li>
            ))}
          </ol>
        );
    }
  });

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
  /**
   * Called once at the start of each editing session (before the first keystroke
   * is applied). Used to capture a pre-edit undo snapshot.
   */
  onEditStart?: (commentId: string) => void;
};

/**
 * Renders a single PGN comment with a view/edit split.
 *
 * **View mode** (default): renders comment text through the inline Markdown
 * parser (`parseCommentMarkdown`), producing bold, italic, underline, bullet
 * lists, and numbered lists as semantic HTML.  Detected URLs become clickable
 * `<a>` elements.  Clicking anywhere on the div activates edit mode.
 * Plain-mode comments bypass the Markdown renderer and use the simple
 * URL-only pipeline.
 *
 * **Edit mode**: a `contentEditable` div showing plain text with visible
 * Markdown syntax.  `innerText` is set on entry and whenever `token.text`
 * changes from an external source.  User keystrokes are NOT overwritten —
 * a ref flag (`isUserEditPending`) suppresses the reactive update for the
 * one render cycle immediately following an `onInput` event.  Blur returns
 * the block to view mode.
 *
 * Cmd/Ctrl+B/I/U call `applyMarkdownWrap` to insert `**`, `*`, or `__`
 * syntax at the caret/selection, which fires the `input` event and saves
 * through the normal `onEdit → saveCommentText` path.
 * In plain/tree mode (`plainLiteralComment=true`), Enter inserts `[[br]]`
 * rather than a raw newline.
 */
export const CommentBlock = ({ token, isFocused, onEdit, onEditStart, onFocusHandled }: CommentBlockProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  // Newly-inserted comments start in edit mode immediately.
  const [isEditMode, setIsEditMode] = useState<boolean>(isFocused);
  // True for exactly one render cycle after the user makes an edit, so we
  // skip the reactive innerText update and avoid clobbering the user's caret.
  const isUserEditPending = useRef<boolean>(false);
  // Fires onEditStart once per editing session (reset each time edit mode is entered).
  const isFirstEditOfSession = useRef<boolean>(true);

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
    isFirstEditOfSession.current = true;
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
    if (isFirstEditOfSession.current) {
      isFirstEditOfSession.current = false;
      onEditStart?.(token.commentId);
    }
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
    const format: CommentFormat | undefined = FORMAT_KEYS[e.key.toLowerCase()];
    if (!format) return;
    e.preventDefault();
    // Insert Markdown syntax at the caret/selection so the wrapping is saved
    // through the normal innerText → onEdit → saveCommentText path.
    applyMarkdownWrap(format);
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
        onBlur={(): void => { setIsEditMode(false); isFirstEditOfSession.current = true; }}
      />
    );
  }

  // ── View mode: Markdown-rendered (text/tree) or URL-only (plain) ─────────
  const viewContent: ReactNode[] = token.plainLiteralComment
    ? splitCommentUrls(token.text).map((seg: CommentSegment, i: number): ReactNode =>
        seg.kind === "url" ? (
          <a
            key={seg.href + i}
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
      )
    : renderMarkdownBlocks(parseCommentMarkdown(token.text));

  return (
    <div
      key={`comment_view_${token.commentId}`}
      className={className}
      data-kind="comment"
      data-comment-id={token.commentId}
      data-variation-depth={String(token.variationDepth)}
      data-focus-first-comment-at-start={token.focusFirstCommentAtStart ? "true" : undefined}
      onClick={(): void => { isFirstEditOfSession.current = true; setIsEditMode(true); }}
    >
      {viewContent}
    </div>
  );
};
