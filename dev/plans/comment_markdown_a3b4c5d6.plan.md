# Comment Markdown Rendering + Formatting Toolbar — Plan

**ID:** comment_markdown_a3b4c5d6
**Status:** Draft

---

## Goal

1. Render a subset of Markdown syntax inside PGN comment view mode —
   **bold**, **italic**, **underline**, **bullet lists**, and **numbered lists**.
2. Fix the existing Cmd+B/I/U keyboard shortcuts (currently no-ops because
   `execCommand` HTML is discarded by `innerText` on save) by switching to
   markdown-syntax wrapping.
3. Add a **comment formatting toolbar button** in the editor sidebar
   (after the Default Layout config button, in `editor.sidebar`) — a single
   button that opens an inline dropdown listing every supported format.

---

## Background and current state

| Concern | Status |
|---|---|
| `PgnEditorCommentBlock` keyboard shortcuts Cmd+B/I/U | Exist but **broken** — `execCommand("bold")` creates `<b>` HTML nodes; `handleInput` reads `innerText` which strips those nodes, so the formatting is never saved. |
| View-mode rendering | Only detects URLs (`splitCommentUrls`); no inline formatting. |
| Storage | Comments are plain text in PGN; no markdown library installed. |
| `TextEditorSidebar` | Has indent/default-layout buttons using `onMouseDown` prevent-default pattern to keep comment focus. |

---

## Design decisions

### Markdown syntax stored in PGN comment text

| Format | Syntax | Notes |
|---|---|---|
| Bold | `**text**` | Standard markdown |
| Italic | `*text*` | Standard markdown |
| Underline | `__text__` | Non-standard; `_` is rare in chess annotations |
| Bullet list item | `- text` at start of a `\n`-delimited line | |
| Numbered list item | `N. text` at start of a `\n`-delimited line | e.g. `1. `, `2. ` |

Syntax is stored verbatim in PGN comments as plain text — no HTML, fully
round-trippable.  Markdown is only parsed and rendered in **text/tree** mode
(view mode); plain mode continues to show raw comment text as-is.

### No external markdown library

The supported subset is small enough to implement with a hand-rolled inline
parser (~100 lines).  Adding a library (marked, micromark, etc.) would
over-provision the parse surface.

### Fixing keyboard shortcuts via markdown wrapping

Instead of `execCommand("bold")`, Cmd+B will:

1. Read the current `Selection` range inside the focused `contentEditable`.
2. Insert `**selectedText**` at the caret using `execCommand("insertText")`.
   - If the selection is empty: inserts `****` and moves the caret between the stars.
   - If there is a selection: replaces it with `**<selection>**`.
3. The `input` event fires → `handleInput` → `onEdit` → PGN is updated.

`execCommand("insertText")` is deprecated but is the only way to insert text
into a `contentEditable` while preserving the browser's undo stack.  This is
already used for `[[br]]` insertion in the existing code.

### Sidebar toolbar button

A single `Aa` button is added to `TextEditorSidebar` after the Default Layout
configure button (before the eval-pills separator).

- `onMouseDown` calls `e.preventDefault()` — keeps the focused comment active,
  identical to the existing indent-marker buttons.
- `onClick` toggles a dropdown panel.
- The dropdown lists: **Bold** (Cmd+B), **Italic** (Cmd+I), **Underline**
  (Cmd+U), **Bullet list**, **Numbered list**.
- Dropdown items also use `onMouseDown` prevent-default.
- Dropdown state (open/closed) is local `useState` in `TextEditorSidebar`.
- The button is enabled only in **text** and **tree** layout modes (lists are
  meaningless in plain mode and markers are shown literally there anyway).

### Applying formatting from the sidebar

When a dropdown item is clicked:

1. `onFormatComment(format)` fires (new prop on `TextEditorSidebar`).
2. `AppShell` passes `handleFormatComment` → calls
   `applyMarkdownWrap(format)` from the new
   `features/editor/components/comment_markdown_format.ts` utility.
3. `applyMarkdownWrap`:
   - Reads `document.activeElement` (still the comment because `onMouseDown`
     prevented blur).
   - Checks `element.dataset.kind === "comment"` and `element.isContentEditable`.
   - For bold/italic/underline: wraps the current selection (or inserts empty
     delimiters at caret) using `execCommand("insertText")`.
   - For bullet/numbered list: inserts `\n- ` or `\n1. ` at the caret via
     `execCommand("insertText")`.
4. The `input` event fires naturally → `handleInput` → `onEdit` → saved.

---

## File map

### New files

| File | Purpose |
|---|---|
| `frontend/src/features/editor/model/comment_markdown.ts` | Pure-logic inline markdown parser; no React, no DOM. Exports `parseCommentMarkdown(text)` returning `MarkdownNode[]`. |
| `frontend/src/features/editor/components/comment_markdown_format.ts` | DOM-touching utility: `applyMarkdownWrap(format)`. Uses Selection API + `execCommand("insertText")`. |

### Modified files

| File | Change |
|---|---|
| `frontend/src/features/editor/components/PgnEditorCommentBlock.tsx` | View mode: replace `splitCommentUrls` with markdown render; edit mode: replace `execCommand("bold/italic/underline")` with `applyMarkdownWrap`. |
| `frontend/src/features/editor/components/TextEditorSidebar.tsx` | Add `commentFormatEnabled` prop, `onFormatComment` prop; add `Aa` button + inline dropdown after the Default Layout config button. |
| `frontend/src/app/shell/components/AppShell.tsx` | Pass `commentFormatEnabled` (true when `layoutMode !== "plain"`) and `handleFormatComment` to `TextEditorSidebar`. |
| `frontend/src/features/guide/model/guide_ids.ts` | Add `EDITOR_SIDEBAR_FORMAT_COMMENT: "editor.sidebar.format-comment"`. |
| `frontend/src/features/editor/styles.css` | Style `b`, `em`, `u`, `ul`, `ol`, `li` inside `.text-editor-comment-block`; style `.comment-format-dropdown`. |

---

## Phase breakdown

### Phase 1 — Pure-logic parser (`comment_markdown.ts`)

**`parseCommentMarkdown(text: string): MarkdownNode[]`**

The parser operates on the `token.text` value already delivered to
`CommentBlock` — which in text/tree mode has `[[br]]` converted to `\n` by
`buildRichCommentView`.

Processing steps:

1. **Line split**: split on `\n` to get logical lines.
2. **Line classification**: each line is one of `text`, `bullet`, `numbered`.
3. **List grouping**: consecutive `bullet` lines are grouped into a
   `bullet_list` node; consecutive `numbered` lines into `numbered_list`.
4. **Inline parse**: for each text/list-item span, run the inline parser:
   `**bold**` → `bold` node, `*italic*` → `italic` node,
   `__underline__` → `underline` node, plain text → `text` node.
5. **URL detection**: applied to `text` leaf nodes (reusing `splitCommentUrls`
   logic).

```
MarkdownNode =
  | { kind: "text";      text: string }
  | { kind: "url";       text: string; href: string }
  | { kind: "bold";      children: MarkdownNode[] }
  | { kind: "italic";    children: MarkdownNode[] }
  | { kind: "underline"; children: MarkdownNode[] }
  | { kind: "line_break" }
  | { kind: "bullet_list";   items: MarkdownNode[][] }
  | { kind: "numbered_list"; items: MarkdownNode[][] }
```

Nesting rule: bold/italic/underline can nest arbitrarily; lists contain inline
nodes only (no block nesting inside list items).

### Phase 2 — View-mode rendering in `PgnEditorCommentBlock`

Replace the current view-mode render:

```tsx
// Before
const segments = splitCommentUrls(token.text);
return <div ...>{segments.map(seg => seg.kind === "url" ? <a> : <span>)}</div>

// After
const nodes = token.plainLiteralComment
  ? splitCommentUrls(token.text)   // plain mode: keep existing simple render
  : parseCommentMarkdown(token.text);
return <div ...>{renderMarkdownNodes(nodes)}</div>
```

`renderMarkdownNodes` is a local recursive function inside the component file
(not exported — only used there).

### Phase 3 — Fix keyboard shortcuts in `PgnEditorCommentBlock`

Replace the three `execCommand` calls in `handleKeyDown`:

```ts
// Before
document.execCommand(command);  // "bold" | "italic" | "underline"

// After
applyMarkdownWrap(command as CommentFormat);
```

`CommentFormat = "bold" | "italic" | "underline" | "bullet_list" | "numbered_list"`

`applyMarkdownWrap` is imported from `comment_markdown_format.ts`.

### Phase 4 — `comment_markdown_format.ts` (DOM utility)

```ts
export type CommentFormat = "bold" | "italic" | "underline" | "bullet_list" | "numbered_list";

export const applyMarkdownWrap = (format: CommentFormat): void => {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return;
  if (!el.isContentEditable || el.dataset["kind"] !== "comment") return;
  // ... selection API + execCommand("insertText", ...)
};
```

Delimiter map:

| Format | Open | Close | Insert-at-caret (empty selection) |
|---|---|---|---|
| bold | `**` | `**` | `****` → caret between |
| italic | `*` | `*` | `**` → caret between |
| underline | `__` | `__` | `____` → caret between |
| bullet_list | `\n- ` | — | inserts marker at caret |
| numbered_list | `\n1. ` | — | inserts marker at caret |

For the wrapping case with a selection: the selected text is read via
`sel.toString()`, the range is deleted, and `**<text>**` is inserted.

Caret repositioning after empty-selection delimiter insert is done with
`Selection.modify("move", "backward", "character")` × delimiter-length.

### Phase 5 — Sidebar toolbar button and dropdown

`TextEditorSidebar` receives two new props:

```ts
commentFormatEnabled: boolean;
onFormatComment: (format: CommentFormat) => void;
```

A local `useState<boolean>(false)` tracks dropdown open state.

Button placement: after `btn-default-layout-config`, before the
`text-editor-sidebar-sep` that precedes the eval-pills button.

```tsx
<button
  id="btn-comment-format"
  className={`icon-button${isDropdownOpen ? " active" : ""}`}
  type="button"
  title={t("toolbar.commentFormat", "Comment formatting")}
  disabled={!commentFormatEnabled}
  data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR_FORMAT_COMMENT}
  onMouseDown={(e): void => { e.preventDefault(); }}
  onClick={(): void => { setDropdownOpen(v => !v); }}
>
  <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Aa</span>
</button>
{isDropdownOpen && (
  <CommentFormatDropdown
    t={t}
    onSelect={(fmt): void => {
      onFormatComment(fmt);
      setDropdownOpen(false);
    }}
  />
)}
```

`CommentFormatDropdown` is a small inline component (can live in the same file
or as a local component in `CommentFormatDropdown.tsx`).  Each item uses
`onMouseDown` prevent-default.  The dropdown is positioned absolutely relative
to the sidebar via CSS.

Dropdown items:

| Label | Format | Shortcut hint |
|---|---|---|
| Bold | `bold` | Cmd+B |
| Italic | `italic` | Cmd+I |
| Underline | `underline` | Cmd+U |
| Bullet list | `bullet_list` | — |
| Numbered list | `numbered_list` | — |

### Phase 6 — CSS

Inside `.text-editor-comment-block` (view mode only; edit mode uses browser
defaults for `contentEditable`):

```css
.text-editor-comment-block b  { font-weight: 600; }
.text-editor-comment-block em { font-style: italic; }
.text-editor-comment-block u  { text-decoration: underline; }

.text-editor-comment-block ul,
.text-editor-comment-block ol {
  margin: 0.2em 0 0.2em 1.4em;
  padding: 0;
}
.text-editor-comment-block li { margin: 0.1em 0; }
```

Dropdown panel:

```css
.comment-format-dropdown {
  position: absolute;
  right: calc(100% + 0.3rem);   /* opens to the left of the sidebar */
  top: 0;
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  min-width: 150px;
  z-index: 100;
  padding: 0.25rem 0;
}
.comment-format-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
  cursor: pointer;
  gap: 1rem;
}
.comment-format-dropdown-item:hover {
  background: var(--accent-soft);
}
.comment-format-dropdown-shortcut {
  font-size: 0.75rem;
  color: var(--text-muted);
}
```

The `.text-editor-sidebar` already has `position: relative` implied by its
flex layout; add `position: relative` explicitly if needed for the dropdown
anchor.

### Phase 7 — i18n keys

| Key | Default (English) |
|---|---|
| `toolbar.commentFormat` | `"Comment formatting"` |
| `toolbar.commentFormat.bold` | `"Bold"` |
| `toolbar.commentFormat.italic` | `"Italic"` |
| `toolbar.commentFormat.underline` | `"Underline"` |
| `toolbar.commentFormat.bulletList` | `"Bullet list"` |
| `toolbar.commentFormat.numberedList` | `"Numbered list"` |

### Phase 8 — Tests

Unit tests in `frontend/test/editor/comment_markdown.test.ts`:

- Plain text passes through unchanged.
- `**foo**` → bold node containing text "foo".
- `*foo*` → italic node.
- `__foo__` → underline node.
- Nested: `**a *b* c**` → bold [ text "a ", italic [ text "b" ], text " c" ].
- List: lines starting with `- ` grouped into `bullet_list`.
- Mixed block: paragraph + list + paragraph.
- URLs inside bold/italic are detected as URL nodes.
- Unclosed delimiter (`**foo`) → passed as literal text.
- Empty delimiter (`****`) → no crash; rendered as literal.

---

## Constraints and non-goals

- **No nested lists** — only flat `<ul>/<ol>` inside a comment.  Nesting
  indentation is handled by `[[indent]]` markers, not list nesting.
- **No headings or code spans** — not needed for chess annotations.
- **Plain mode unaffected** — no markdown parse/render in plain mode;
  raw comment text shown as-is (existing behaviour).
- **Edit mode not re-styled** — the `contentEditable` div shows plain text
  with visible markdown syntax while editing.  WYSIWYG editing is out of scope.
- **No migration of existing comments** — existing comment text is unchanged;
  markdown syntax is opt-in.
