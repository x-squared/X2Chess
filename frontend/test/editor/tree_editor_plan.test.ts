/**
 * Tests for the tree mode strategy in buildTextEditorPlan.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildTextEditorPlan } from "../../src/features/editor/model/text_editor_plan.js";
import type { PlanBlock, PlanToken, InlineToken, CommentToken } from "../../src/features/editor/model/text_editor_plan.js";

// ── Model builders ────────────────────────────────────────────────────────────

const comment = (id: string, raw: string) => ({ type: "comment" as const, id, raw });
const moveNumber = (text: string) => ({ type: "move_number" as const, text });
const result = (text: string) => ({ type: "result" as const, text });

const move = (
  id: string,
  san: string,
  opts: {
    commentsBefore?: ReturnType<typeof comment>[];
    commentsAfter?: ReturnType<typeof comment>[];
    ravs?: ReturnType<typeof variation>[];
    nags?: string[];
  } = {},
) => ({
  type: "move" as const,
  id,
  san,
  nags: opts.nags ?? [],
  commentsBefore: opts.commentsBefore ?? [],
  commentsAfter: opts.commentsAfter ?? [],
  ravs: opts.ravs ?? [],
});

const variation = (
  depth: number,
  entries: unknown[],
  trailingComments: ReturnType<typeof comment>[] = [],
) => ({
  type: "variation" as const,
  depth,
  entries,
  trailingComments,
});

const model = (root: ReturnType<typeof variation>) => ({ root });

// ── Helpers ───────────────────────────────────────────────────────────────────

const treeBlocks = (m: unknown) =>
  buildTextEditorPlan(m, { layoutMode: "tree" });

const textBlocks = (m: unknown) =>
  buildTextEditorPlan(m, { layoutMode: "text" });

const branchHeaderToken = (block: PlanBlock): InlineToken | undefined =>
  block.tokens.find(
    (t: PlanToken): t is InlineToken => t.kind === "inline" && t.tokenType === "branch_header",
  );

const blockPaths = (blocks: PlanBlock[]): string[] =>
  blocks.map((b) => (b.variationPath ? b.variationPath.join(".") : ""));

const findCommentToken = (
  blocks: PlanBlock[],
  commentId: string,
): CommentToken | undefined => (
  blocks
    .flatMap((b) => b.tokens)
    .find(
      (t: PlanToken): t is CommentToken =>
        t.kind === "comment" && t.commentId === commentId,
    )
);

// ── Tree block count ──────────────────────────────────────────────────────────

test("game with no RAVs produces one mainline block", () => {
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4"), move("m2", "e5"), result("1-0"),
  ]));
  const blocks = treeBlocks(m);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].isMainLine, true);
  assert.deepEqual(blocks[0].variationPath, [0]);
});

test("one RAV produces two blocks: mainline + branch", () => {
  const rav = variation(1, [moveNumber("1."), move("r1", "d4")]);
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4", { ravs: [rav] }), move("m2", "e5"),
  ]));
  const blocks = treeBlocks(m);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].isMainLine, true);
  assert.equal(blocks[1].isCollapsible, true);
  assert.equal(blocks[1].isMainLine, false);
});

test("two RAVs at mainline produce three blocks", () => {
  const rav1 = variation(1, [moveNumber("1."), move("r1", "d4")]);
  const rav2 = variation(1, [moveNumber("1."), move("r2", "c4")]);
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4", { ravs: [rav1, rav2] }), move("m2", "e5"),
  ]));
  const blocks = treeBlocks(m);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blockPaths(blocks), ["0", "0.0", "0.1"]);
});

test("nested RAV produces correct DFS block order", () => {
  const subRav = variation(2, [moveNumber("1."), move("s1", "c4")]);
  const rav = variation(1, [moveNumber("1."), move("r1", "d4", { ravs: [subRav] })]);
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4", { ravs: [rav] }),
  ]));
  const blocks = treeBlocks(m);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blockPaths(blocks), ["0", "0.0", "0.0.0"]);
});

// ── Branch header ─────────────────────────────────────────────────────────────

test("mainline block has no branch_header token", () => {
  const m = model(variation(0, [moveNumber("1."), move("m1", "e4")]));
  const blocks = treeBlocks(m);
  assert.equal(branchHeaderToken(blocks[0]), undefined);
});

test("first RAV block has branch_header token labelled A", () => {
  const rav = variation(1, [moveNumber("1."), move("r1", "d4")]);
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4", { ravs: [rav] }),
  ]));
  const blocks = treeBlocks(m);
  const header = branchHeaderToken(blocks[1]);
  assert.ok(header, "branch_header token should be present");
  assert.equal(String(header!.dataset.label), "A");
});

test("second RAV block has branch_header token labelled B", () => {
  const rav1 = variation(1, [moveNumber("1."), move("r1", "d4")]);
  const rav2 = variation(1, [moveNumber("1."), move("r2", "c4")]);
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4", { ravs: [rav1, rav2] }),
  ]));
  const blocks = treeBlocks(m);
  assert.equal(String(branchHeaderToken(blocks[2])!.dataset.label), "B");
});

test("sub-RAV block has branch_header token labelled A.1", () => {
  const subRav = variation(2, [moveNumber("1."), move("s1", "c4")]);
  const rav = variation(1, [moveNumber("1."), move("r1", "d4", { ravs: [subRav] })]);
  const m = model(variation(0, [
    moveNumber("1."), move("m1", "e4", { ravs: [rav] }),
  ]));
  const blocks = treeBlocks(m);
  // blocks: [mainline, A, A.1]
  assert.equal(String(branchHeaderToken(blocks[2])!.dataset.label), "A.1");
});

// ── Marker handling in tree mode ──────────────────────────────────────────────

test("[[br]] inside a comment is rendered as newline in tree mode", () => {
  const m = model(variation(0, [
    moveNumber("1."),
    move("m1", "e4", { commentsAfter: [comment("c1", "First part [[br]] Second part")] }),
  ]));
  const blocks = treeBlocks(m);
  // All moves + comment land in the same tree block.
  assert.equal(blocks.length, 1);
  const commentTok = blocks[0].tokens.find((t) => t.kind === "comment");
  assert.ok(commentTok, "comment token should be present");
  assert.equal((commentTok as { text: string }).text, "First part \n Second part");
});

// ── Marker round-trip ─────────────────────────────────────────────────────────

test("rawText preserved in tree mode — [[br]] survives for text-mode round-trip", () => {
  const m = model(variation(0, [
    moveNumber("1."),
    move("m1", "e4", { commentsAfter: [comment("c1", "Note [[br]] continued")] }),
  ]));
  const blocks = treeBlocks(m);
  const commentTok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { rawText: string }
    | undefined;
  assert.ok(commentTok);
  assert.equal(commentTok!.rawText, "Note [[br]] continued");
});

test("tree mode strips visible [[indent]] marker text from comment display", () => {
  const m = model(variation(0, [
    comment("c1", "[[indent]] Intro line"),
    moveNumber("1."),
    move("m1", "e4"),
  ]));
  const blocks = treeBlocks(m);
  const commentTok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { text: string; rawText: string }
    | undefined;
  assert.ok(commentTok);
  assert.equal(commentTok!.text, "Intro line");
  assert.equal(commentTok!.rawText, "[[indent]] Intro line");
});

// ── Intro styling ─────────────────────────────────────────────────────────────

test("first comment of mainline gets introStyling in tree mode", () => {
  const m = model(variation(0, [
    comment("c1", "Intro text"),
    moveNumber("1."), move("m1", "e4"),
  ]));
  const blocks = treeBlocks(m);
  const tok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { introStyling: boolean }
    | undefined;
  assert.ok(tok);
  assert.equal(tok!.introStyling, true);
});

test("first comment of each RAV block independently gets introStyling", () => {
  const rav = variation(1, [comment("c2", "RAV intro"), moveNumber("1."), move("r1", "d4")]);
  const m = model(variation(0, [
    comment("c1", "Main intro"),
    moveNumber("1."), move("m1", "e4", { ravs: [rav] }),
  ]));
  const blocks = treeBlocks(m);
  const mainComment = findCommentToken(blocks, "c1");
  const ravComment = findCommentToken(blocks, "c2");
  assert.ok(mainComment?.introStyling, "main first comment should have introStyling");
  assert.ok(ravComment?.introStyling, "RAV first comment should have introStyling");
});

test("text mode: commentsBefore on first move still get introStyling", () => {
  const m = model(variation(0, [
    moveNumber("1."),
    move("m1", "e4", { commentsBefore: [comment("c1", "Intro before first move")] }),
  ]));
  const blocks = textBlocks(m);
  const tok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { introStyling: boolean }
    | undefined;
  assert.ok(tok, "commentsBefore token should be emitted");
  assert.equal(tok!.introStyling, true);
});

test("tree mode: commentsBefore on first move still get introStyling", () => {
  const m = model(variation(0, [
    moveNumber("1."),
    move("m1", "e4", { commentsBefore: [comment("c1", "Intro before first move")] }),
  ]));
  const blocks = treeBlocks(m);
  const tok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { introStyling: boolean }
    | undefined;
  assert.ok(tok, "commentsBefore token should be emitted");
  assert.equal(tok!.introStyling, true);
});

// ── Plain/text modes unaffected ───────────────────────────────────────────────

test("text mode: [[indent]] alias \\i still triggers indent directive", () => {
  const rav = variation(1, [moveNumber("1."), move("r1", "d4")]);
  const m = model(variation(0, [
    comment("c1", "\\i Indented comment"),
    rav,
    moveNumber("1."), move("m1", "e4"),
  ]));
  const blocks = textBlocks(m);
  // The indented RAV should produce a block with indentDepth > 0.
  const indented = blocks.find((b) => b.indentDepth > 0);
  assert.ok(indented, "expected at least one indented block in text mode");
});

test("text mode: indent directive does not force line breaks in mainline", () => {
  const m = model(variation(0, [
    comment("c1", "[[indent]]"),
    moveNumber("1."),
    move("m1", "e4"),
    move("m2", "e5"),
  ]));
  const blocks = textBlocks(m);
  assert.ok(blocks.length >= 2);
});

test("text mode: [[deindent]] cancels prior indent for following content", () => {
  const m = model(variation(0, [
    comment("c1", "[[indent]]"),
    moveNumber("1."),
    move("m1", "e4"),
    comment("c2", "[[deindent]]"),
    moveNumber("1..."),
    move("m2", "e5"),
  ]));
  const blocks = textBlocks(m);
  assert.ok(blocks.length >= 2);
});

test("tree mode strips visible [[deindent]] marker text from comment display", () => {
  const m = model(variation(0, [
    comment("c1", "[[deindent]] Back out"),
    moveNumber("1."),
    move("m1", "e4"),
  ]));
  const blocks = treeBlocks(m);
  const commentTok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { text: string; rawText: string }
    | undefined;
  assert.ok(commentTok);
  assert.equal(commentTok!.text, "Back out");
  assert.equal(commentTok!.rawText, "[[deindent]] Back out");
});

test("plain mode: rawText shown verbatim with no splitting", () => {
  const m = model(variation(0, [
    comment("c1", "Hello [[br]] World"),
    moveNumber("1."), move("m1", "e4"),
  ]));
  const blocks = buildTextEditorPlan(m, { layoutMode: "plain" });
  const commentTok = blocks[0].tokens.find((t) => t.kind === "comment") as
    | { text: string; plainLiteralComment: boolean }
    | undefined;
  assert.ok(commentTok);
  assert.equal(commentTok!.text, "Hello [[br]] World");
  assert.equal(commentTok!.plainLiteralComment, true);
});

test("text mode suppresses redundant black move number after white move", () => {
  const m = model(variation(0, [
    moveNumber("4."),
    move("w4", "Kg5"),
    moveNumber("4..."),
    move("b4", "Nc4"),
  ]));
  const blocks = textBlocks(m);
  const text = blocks
    .flatMap((b) => b.tokens)
    .filter((t) => t.kind === "inline")
    .map((t) => t.text)
    .join(" ");
  assert.match(text, /Kg5/);
  assert.match(text, /Nc4/);
  assert.doesNotMatch(text, /4\.\.\./);
});

test("text mode suppresses redundant black move number with four dots after comment removal shape", () => {
  const m = model(variation(0, [
    moveNumber("4."),
    move("w4", "Nf3"),
    moveNumber("4...."),
    move("b4", "Nc6"),
  ]));
  const blocks = textBlocks(m);
  const text = blocks
    .flatMap((b) => b.tokens)
    .filter((t) => t.kind === "inline")
    .map((t) => t.text)
    .join(" ");
  assert.match(text, /Nf3/);
  assert.match(text, /Nc6/);
  assert.doesNotMatch(text, /4\.\.\.\./);
});

test("text mode collapses duplicate white move numbers before a move", () => {
  const m = model(variation(0, [
    moveNumber("2..."),
    move("b2", "Nc2"),
    moveNumber("3."),
    move("w3", "h5"),
    move("b3", "Ne3"),
    moveNumber("4."),
    moveNumber("4."),
    move("w4", "Kg5"),
  ]));
  const blocks = textBlocks(m);
  const text = blocks
    .flatMap((b) => b.tokens)
    .filter((t) => t.kind === "inline")
    .map((t) => t.text)
    .join(" ");
  assert.match(text, /Ne3/);
  assert.match(text, /Kg5/);
  assert.doesNotMatch(text, /4\s+4/);
});

test("text mode suppresses black move number after move even with intervening comment token", () => {
  const m = model(variation(0, [
    moveNumber("5."),
    move("w5", "h6"),
    comment("c5", ""),
    moveNumber("5..."),
    move("b5", "Ne5"),
  ]));
  const blocks = textBlocks(m);
  const text = blocks
    .flatMap((b) => b.tokens)
    .filter((t) => t.kind === "inline")
    .map((t) => t.text)
    .join(" ");
  assert.match(text, /h6/);
  assert.match(text, /Ne5/);
  assert.doesNotMatch(text, /5\.\.\./);
});
