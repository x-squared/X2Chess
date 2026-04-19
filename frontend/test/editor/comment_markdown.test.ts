import test from "node:test";
import assert from "node:assert/strict";
import { parseCommentMarkdown } from "../../src/features/editor/model/comment_markdown.js";
import type { MarkdownBlock, MarkdownInlineNode } from "../../src/features/editor/model/comment_markdown.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const textNode = (t: string): MarkdownInlineNode => ({ kind: "text", text: t });
const boldNode = (children: MarkdownInlineNode[]): MarkdownInlineNode => ({ kind: "bold", children });
const italicNode = (children: MarkdownInlineNode[]): MarkdownInlineNode => ({ kind: "italic", children });
const underlineNode = (children: MarkdownInlineNode[]): MarkdownInlineNode => ({ kind: "underline", children });

const inlineBlock = (nodes: MarkdownInlineNode[]): MarkdownBlock => ({ kind: "inline", nodes });
const bulletBlock = (items: MarkdownInlineNode[][]): MarkdownBlock => ({ kind: "bullet_list", items });
const numberedBlock = (items: MarkdownInlineNode[][]): MarkdownBlock => ({ kind: "numbered_list", items });

// ── Plain text ────────────────────────────────────────────────────────────────

test("plain text returns single inline block", () => {
  const result = parseCommentMarkdown("Hello world");
  assert.deepEqual(result, [inlineBlock([textNode("Hello world")])]);
});

test("empty string returns single inline block with empty text node", () => {
  const result = parseCommentMarkdown("");
  assert.deepEqual(result, [inlineBlock([])]);
});

// ── Bold ──────────────────────────────────────────────────────────────────────

test("**bold** wraps in bold node", () => {
  const result = parseCommentMarkdown("**bold**");
  assert.deepEqual(result, [inlineBlock([boldNode([textNode("bold")])])]);
});

test("text before and after bold preserved", () => {
  const result = parseCommentMarkdown("a **b** c");
  assert.deepEqual(result, [inlineBlock([
    textNode("a "),
    boldNode([textNode("b")]),
    textNode(" c"),
  ])]);
});

test("unclosed ** is literal text", () => {
  const result = parseCommentMarkdown("**unclosed");
  assert.deepEqual(result, [inlineBlock([textNode("**unclosed")])]);
});

test("empty ** produces empty bold node", () => {
  const result = parseCommentMarkdown("****");
  assert.deepEqual(result, [inlineBlock([boldNode([])])]);
});

// ── Italic ────────────────────────────────────────────────────────────────────

test("*italic* wraps in italic node", () => {
  const result = parseCommentMarkdown("*italic*");
  assert.deepEqual(result, [inlineBlock([italicNode([textNode("italic")])])]);
});

test("unclosed * is literal text", () => {
  const result = parseCommentMarkdown("*unclosed");
  assert.deepEqual(result, [inlineBlock([textNode("*unclosed")])]);
});

test("** does not trigger italic parser", () => {
  // The ** pair should be processed as bold, not leaving stray * for italic
  const result = parseCommentMarkdown("**x**");
  assert.deepEqual(result, [inlineBlock([boldNode([textNode("x")])])]);
});

// ── Underline ─────────────────────────────────────────────────────────────────

test("__underline__ wraps in underline node", () => {
  const result = parseCommentMarkdown("__underline__");
  assert.deepEqual(result, [inlineBlock([underlineNode([textNode("underline")])])]);
});

test("unclosed __ is literal text", () => {
  const result = parseCommentMarkdown("__unclosed");
  assert.deepEqual(result, [inlineBlock([textNode("__unclosed")])]);
});

test("empty __ produces empty underline node", () => {
  const result = parseCommentMarkdown("____");
  assert.deepEqual(result, [inlineBlock([underlineNode([])])]);
});

// ── Nesting ───────────────────────────────────────────────────────────────────

test("bold containing italic: **outer *inner* end**", () => {
  const result = parseCommentMarkdown("**outer *inner* end**");
  assert.deepEqual(result, [inlineBlock([
    boldNode([
      textNode("outer "),
      italicNode([textNode("inner")]),
      textNode(" end"),
    ]),
  ])]);
});

test("bold containing underline: **__underlined__ word**", () => {
  const result = parseCommentMarkdown("**__underlined__ word**");
  assert.deepEqual(result, [inlineBlock([
    boldNode([
      underlineNode([textNode("underlined")]),
      textNode(" word"),
    ]),
  ])]);
});

// ── Bullet list ───────────────────────────────────────────────────────────────

test("- item produces bullet list", () => {
  const result = parseCommentMarkdown("- apple");
  assert.deepEqual(result, [bulletBlock([[textNode("apple")]])]);
});

test("* item produces bullet list", () => {
  const result = parseCommentMarkdown("* banana");
  assert.deepEqual(result, [bulletBlock([[textNode("banana")]])]);
});

test("multiple bullet items in one list", () => {
  const result = parseCommentMarkdown("- a\n- b\n- c");
  assert.deepEqual(result, [bulletBlock([
    [textNode("a")],
    [textNode("b")],
    [textNode("c")],
  ])]);
});

test("bullet item may contain inline formatting", () => {
  const result = parseCommentMarkdown("- **bold item**");
  assert.deepEqual(result, [bulletBlock([[boldNode([textNode("bold item")])]])]);
});

// ── Numbered list ─────────────────────────────────────────────────────────────

test("1. item produces numbered list", () => {
  const result = parseCommentMarkdown("1. first");
  assert.deepEqual(result, [numberedBlock([[textNode("first")]])]);
});

test("multiple numbered items in one list", () => {
  const result = parseCommentMarkdown("1. one\n2. two\n3. three");
  assert.deepEqual(result, [numberedBlock([
    [textNode("one")],
    [textNode("two")],
    [textNode("three")],
  ])]);
});

// ── Mixed blocks ──────────────────────────────────────────────────────────────

test("text then bullet list produces two blocks", () => {
  const result = parseCommentMarkdown("Intro\n- item");
  assert.deepEqual(result, [
    inlineBlock([textNode("Intro")]),
    bulletBlock([[textNode("item")]]),
  ]);
});

test("bullet list then text produces two blocks", () => {
  const result = parseCommentMarkdown("- item\nOutro");
  assert.deepEqual(result, [
    bulletBlock([[textNode("item")]]),
    inlineBlock([textNode("Outro")]),
  ]);
});

test("text, bullet, numbered, text produces four blocks", () => {
  const result = parseCommentMarkdown("Intro\n- bullet\n1. numbered\nOutro");
  assert.deepEqual(result, [
    inlineBlock([textNode("Intro")]),
    bulletBlock([[textNode("bullet")]]),
    numberedBlock([[textNode("numbered")]]),
    inlineBlock([textNode("Outro")]),
  ]);
});

// ── Multi-line inline text ────────────────────────────────────────────────────

test("consecutive non-list lines join into one inline block with newline", () => {
  const result = parseCommentMarkdown("line one\nline two");
  assert.deepEqual(result, [inlineBlock([textNode("line one\nline two")])]);
});

test("bold spans within multi-line inline block", () => {
  const result = parseCommentMarkdown("before **bold** after\nnext line");
  assert.deepEqual(result, [inlineBlock([
    textNode("before "),
    boldNode([textNode("bold")]),
    textNode(" after\nnext line"),
  ])]);
});
