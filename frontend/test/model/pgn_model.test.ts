import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel, parseCommentRuns } from "../../src/model/pgn_model.js";
import type { PgnMoveNode, PgnVariationNode } from "../../src/model/pgn_model.js";

// ── parseCommentRuns ───────────────────────────────────────────────────────────

test("parseCommentRuns — plain text returns single plain run", () => {
  const runs = parseCommentRuns("good move");
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0], { text: "good move", bold: false, italic: false, code: false });
});

test("parseCommentRuns — empty string returns empty array", () => {
  assert.deepEqual(parseCommentRuns(""), []);
});

test("parseCommentRuns — bold span", () => {
  const runs = parseCommentRuns("**key move**");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, "key move");
  assert.equal(runs[0].bold, true);
  assert.equal(runs[0].italic, false);
});

test("parseCommentRuns — italic span", () => {
  const runs = parseCommentRuns("*interesting*");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, "interesting");
  assert.equal(runs[0].italic, true);
  assert.equal(runs[0].bold, false);
});

test("parseCommentRuns — underline span", () => {
  const runs = parseCommentRuns("__underlined__");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, "underlined");
  assert.equal(runs[0].underline, true);
});

test("parseCommentRuns — code span", () => {
  const runs = parseCommentRuns("`1.e4`");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, "1.e4");
  assert.equal(runs[0].code, true);
});

test("parseCommentRuns — mixed plain and bold", () => {
  const runs = parseCommentRuns("before **bold** after");
  assert.equal(runs.length, 3);
  assert.equal(runs[0].text, "before ");
  assert.equal(runs[0].bold, false);
  assert.equal(runs[1].text, "bold");
  assert.equal(runs[1].bold, true);
  assert.equal(runs[2].text, " after");
  assert.equal(runs[2].bold, false);
});

// ── parsePgnToModel ────────────────────────────────────────────────────────────

test("parsePgnToModel — empty string returns empty model", () => {
  const model = parsePgnToModel("");
  assert.equal(model.type, "game");
  assert.deepEqual(model.headers, []);
  assert.equal(model.root.entries.length, 0);
});

test("parsePgnToModel — null/undefined treated as empty string", () => {
  const model = parsePgnToModel(null as unknown as string);
  assert.equal(model.type, "game");
  assert.equal(model.root.entries.length, 0);
});

test("parsePgnToModel — parses headers", () => {
  const pgn = `[White "Carlsen, M."]\n[Black "Nepomniachtchi, I."]\n\n1. e4 e5 *`;
  const model = parsePgnToModel(pgn);
  assert.equal(model.headers.length, 2);
  assert.equal(model.headers[0].key, "White");
  assert.equal(model.headers[0].value, "Carlsen, M.");
  assert.equal(model.headers[1].key, "Black");
  assert.equal(model.headers[1].value, "Nepomniachtchi, I.");
});

test("parsePgnToModel — parses simple moves", () => {
  const model = parsePgnToModel("1. e4 e5 2. Nf3 Nc6");
  const moves = model.root.entries.filter(e => e.type === "move") as PgnMoveNode[];
  assert.deepEqual(moves.map(m => m.san), ["e4", "e5", "Nf3", "Nc6"]);
});

test("parsePgnToModel — move ids are stable and unique", () => {
  const model = parsePgnToModel("1. e4 e5 2. Nf3");
  const moves = model.root.entries.filter(e => e.type === "move") as PgnMoveNode[];
  const ids = moves.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
  // IDs are deterministic on repeated parse of same input
  const model2 = parsePgnToModel("1. e4 e5 2. Nf3");
  const ids2 = (model2.root.entries.filter(e => e.type === "move") as PgnMoveNode[]).map(m => m.id);
  assert.deepEqual(ids, ids2);
});

test("parsePgnToModel — parses comment after move", () => {
  const model = parsePgnToModel("1. e4 {good move} e5");
  const e4 = model.root.entries.find(e => e.type === "move" && (e as PgnMoveNode).san === "e4") as PgnMoveNode;
  assert.ok(e4);
  assert.equal(e4.commentsAfter.length, 1);
  assert.equal(e4.commentsAfter[0].raw, "good move");
});

test("parsePgnToModel — multiple comments after a move attach to that move", () => {
  const model = parsePgnToModel("1. e4 {intro} {second} e5");
  const e4 = model.root.entries.find(e => e.type === "move" && (e as PgnMoveNode).san === "e4") as PgnMoveNode;
  assert.ok(e4.commentsAfter.length >= 1);
});

test("parsePgnToModel — parses variation", () => {
  const model = parsePgnToModel("1. e4 (1. d4 d5) e5");
  const e4 = model.root.entries.find(e => e.type === "move" && (e as PgnMoveNode).san === "e4") as PgnMoveNode;
  assert.ok(e4);
  assert.equal(e4.ravs.length, 1);
  const rav = e4.ravs[0] as PgnVariationNode;
  assert.equal(rav.type, "variation");
  assert.equal(rav.depth, 1);
  const ravMoves = rav.entries.filter(e => e.type === "move") as PgnMoveNode[];
  assert.deepEqual(ravMoves.map(m => m.san), ["d4", "d5"]);
});

test("parsePgnToModel — variation parentMoveId links to branch point", () => {
  const model = parsePgnToModel("1. e4 (1. d4) e5");
  const e4 = model.root.entries.find(e => e.type === "move") as PgnMoveNode;
  const rav = e4.ravs[0];
  assert.equal(rav.parentMoveId, e4.id);
});

test("parsePgnToModel — parses NAGs", () => {
  const model = parsePgnToModel("1. e4 $1 e5 $2");
  const moves = model.root.entries.filter(e => e.type === "move") as PgnMoveNode[];
  assert.deepEqual(moves[0].nags, ["$1"]);
  assert.deepEqual(moves[1].nags, ["$2"]);
});

test("parsePgnToModel — parses result token", () => {
  const model = parsePgnToModel("1. e4 e5 1-0");
  const result = model.root.entries.find(e => e.type === "result");
  assert.ok(result);
  assert.equal((result as { type: string; text: string }).text, "1-0");
});

test("parsePgnToModel — nested variations increment depth", () => {
  const model = parsePgnToModel("1. e4 (1. d4 (1. c4)) e5");
  const e4 = model.root.entries.find(e => e.type === "move") as PgnMoveNode;
  const outer = e4.ravs[0];
  assert.equal(outer.depth, 1);
  const d4 = outer.entries.find(e => e.type === "move") as PgnMoveNode;
  const inner = d4.ravs[0];
  assert.equal(inner.depth, 2);
});

test("parsePgnToModel — postItems preserves comment+rav order", () => {
  const model = parsePgnToModel("1. e4 {after e4} (1. d4) e5");
  const e4 = model.root.entries.find(e => e.type === "move" && (e as PgnMoveNode).san === "e4") as PgnMoveNode;
  assert.equal(e4.postItems[0].type, "comment");
  assert.equal(e4.postItems[1].type, "rav");
});

test("parsePgnToModel — escape sequences decoded in comments", () => {
  const model = parsePgnToModel(String.raw`1. e4 {line1\nline2}`);
  const e4 = model.root.entries.find(e => e.type === "move") as PgnMoveNode;
  assert.equal(e4.commentsAfter[0].raw, "line1\nline2");
});

test("parsePgnToModel — comment after last move in rav goes to commentsAfter", () => {
  const model = parsePgnToModel("1. e4 e5 (1... c5 {trailing})");
  const e5 = model.root.entries.find(e => e.type === "move" && (e as PgnMoveNode).san === "e5") as PgnMoveNode;
  const rav = e5.ravs[0];
  assert.ok(rav, "e5 should have a RAV");
  const c5 = rav.entries.find(e => e.type === "move") as PgnMoveNode;
  assert.equal(c5.commentsAfter.length, 1);
  assert.equal(c5.commentsAfter[0].raw, "trailing");
});
