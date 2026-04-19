/**
 * comment_markdown — Inline Markdown parser for PGN comment text.
 *
 * Converts the plain-text content of a PGN comment into a `MarkdownBlock[]`
 * tree suitable for React rendering.  The supported markup is a minimal subset
 * sufficient for chess annotation use-cases:
 *
 *   Inline:   `**bold**`  `*italic*`  `__underline__`
 *   Block:    `- item` / `* item`  (bullet list),  `1. item` (numbered list)
 *
 * URL detection is intentionally left to the rendering layer so it can be
 * applied to text leaf nodes without coupling the parser to the URL regex.
 *
 * Integration API:
 * - `parseCommentMarkdown(text)` — parse display text from a `CommentToken`.
 *   Call only in text/tree mode; plain mode should bypass this parser and use
 *   the existing `splitCommentUrls` pipeline.
 *
 * Configuration API:
 * - No configuration.  Unclosed delimiters are treated as literal text.
 *   Empty-body delimiters (`****`) are also passed through as literal text.
 *
 * Communication API:
 * - Pure function.  No side effects.
 */

// ── Public types ──────────────────────────────────────────────────────────────

/** An inline-level node produced by the inline parser. */
export type MarkdownInlineNode =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: MarkdownInlineNode[] }
  | { kind: "italic"; children: MarkdownInlineNode[] }
  | { kind: "underline"; children: MarkdownInlineNode[] };

/**
 * A block-level node produced by the block parser.
 *
 * - `inline` — a run of inline nodes (may contain embedded `\n` chars which
 *   render as line-breaks in `pre-wrap` context).
 * - `bullet_list` — an unordered list; each item is an `MarkdownInlineNode[]`.
 * - `numbered_list` — an ordered list; each item is an `MarkdownInlineNode[]`.
 */
export type MarkdownBlock =
  | { kind: "inline"; nodes: MarkdownInlineNode[] }
  | { kind: "bullet_list"; items: MarkdownInlineNode[][] }
  | { kind: "numbered_list"; items: MarkdownInlineNode[][] };

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find the index of the next closing single-star `*` that is not part of a
 * `**` pair.  Double-star pairs encountered during the scan are jumped over.
 *
 * @param text Source string.
 * @param from Index to start searching from.
 * @returns Index of the closing `*`, or -1 if not found.
 */
const findSingleStarClose = (text: string, from: number): number => {
  let i: number = from;
  while (i < text.length) {
    if (text[i] === "*") {
      if (text[i + 1] === "*") {
        i += 2; // jump over ** pair
        continue;
      }
      return i;
    }
    i += 1;
  }
  return -1;
};

/**
 * Parse a flat string into an array of inline nodes.
 *
 * Scans left-to-right for the highest-priority delimiter first (`**` before
 * `*`, `__` before `_`).  Unclosed or empty-body delimiters fall through as
 * literal text.
 *
 * @param text Raw text segment (may contain `\n` chars for pre-wrap rendering).
 * @returns Flat array of `MarkdownInlineNode` values.
 */
const parseInlineMarkdown = (text: string): MarkdownInlineNode[] => {
  const nodes: MarkdownInlineNode[] = [];
  let pos: number = 0;
  let literalStart: number = 0;

  const flushLiteral = (end: number): void => {
    if (end > literalStart) {
      nodes.push({ kind: "text", text: text.slice(literalStart, end) });
    }
  };

  while (pos < text.length) {
    const ch: string = text[pos];

    // **bold** — must be tested before single * to avoid mismatching the first char
    if (ch === "*" && text[pos + 1] === "*") {
      const closeAt: number = text.indexOf("**", pos + 2);
      if (closeAt > pos + 1) { // non-empty body
        flushLiteral(pos);
        nodes.push({
          kind: "bold",
          children: parseInlineMarkdown(text.slice(pos + 2, closeAt)),
        });
        pos = closeAt + 2;
        literalStart = pos;
        continue;
      }
    }

    // __underline__
    if (ch === "_" && text[pos + 1] === "_") {
      const closeAt: number = text.indexOf("__", pos + 2);
      if (closeAt > pos + 1) { // non-empty body
        flushLiteral(pos);
        nodes.push({
          kind: "underline",
          children: parseInlineMarkdown(text.slice(pos + 2, closeAt)),
        });
        pos = closeAt + 2;
        literalStart = pos;
        continue;
      }
    }

    // *italic* — single star (not part of **)
    if (ch === "*" && text[pos + 1] !== "*") {
      const closeAt: number = findSingleStarClose(text, pos + 1);
      if (closeAt !== -1 && closeAt > pos) { // non-empty body
        flushLiteral(pos);
        nodes.push({
          kind: "italic",
          children: parseInlineMarkdown(text.slice(pos + 1, closeAt)),
        });
        pos = closeAt + 1;
        literalStart = pos;
        continue;
      }
    }

    pos += 1;
  }

  flushLiteral(text.length);
  return nodes;
};

/**
 * Extract the content of a bullet-list line.
 *
 * @param line A single `\n`-delimited line from the comment text.
 * @returns The item body text, or `null` if the line is not a bullet item.
 */
const parseBulletLineContent = (line: string): string | null => {
  if (line.startsWith("- ")) return line.slice(2);
  if (line.startsWith("* ")) return line.slice(2);
  return null;
};

/**
 * Extract the content of a numbered-list line.
 *
 * @param line A single `\n`-delimited line from the comment text.
 * @returns The item body text, or `null` if the line is not a numbered item.
 */
const parseNumberedLineContent = (line: string): string | null => {
  const match: RegExpMatchArray | null = line.match(/^\d+\. (.*)/);
  return match ? match[1] : null;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a PGN comment display string into a `MarkdownBlock[]` tree.
 *
 * Expected input: `token.text` as delivered to `CommentBlock` in text/tree
 * mode, i.e. `[[br]]` markers already converted to `\n` by
 * `buildRichCommentView`.  Do not call on plain-mode comments (where
 * `[[br]]` remains literal).
 *
 * The returned blocks should be rendered in order:
 * - `inline` blocks → inline spans (preserve embedded `\n` via `pre-wrap`).
 * - `bullet_list` / `numbered_list` blocks → `<ul>` / `<ol>` elements.
 *
 * @param text Comment display text (with `\n` as line separators).
 * @returns Ordered array of `MarkdownBlock` values.
 */
export const parseCommentMarkdown = (text: string): MarkdownBlock[] => {
  const lines: string[] = text.split("\n");
  const blocks: MarkdownBlock[] = [];

  let textLines: string[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];

  const flushText = (): void => {
    if (textLines.length === 0) return;
    const joined: string = textLines.join("\n");
    blocks.push({ kind: "inline", nodes: parseInlineMarkdown(joined) });
    textLines = [];
  };

  const flushBullet = (): void => {
    if (bulletItems.length === 0) return;
    blocks.push({
      kind: "bullet_list",
      items: bulletItems.map(parseInlineMarkdown),
    });
    bulletItems = [];
  };

  const flushNumbered = (): void => {
    if (numberedItems.length === 0) return;
    blocks.push({
      kind: "numbered_list",
      items: numberedItems.map(parseInlineMarkdown),
    });
    numberedItems = [];
  };

  for (const line of lines) {
    const bulletContent: string | null = parseBulletLineContent(line);
    if (bulletContent !== null) {
      flushText();
      flushNumbered();
      bulletItems.push(bulletContent);
      continue;
    }

    const numberedContent: string | null = parseNumberedLineContent(line);
    if (numberedContent !== null) {
      flushText();
      flushBullet();
      numberedItems.push(numberedContent);
      continue;
    }

    // Regular text line
    flushBullet();
    flushNumbered();
    textLines.push(line);
  }

  flushText();
  flushBullet();
  flushNumbered();

  return blocks;
};
