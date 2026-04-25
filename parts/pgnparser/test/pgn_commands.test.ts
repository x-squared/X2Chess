import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../src/pgn_model.js";
import type { PgnMoveNode } from "../src/pgn_model.js";
import {
  setCommentTextById,
  removeCommentById,
  getFirstCommentMetadata,
  setFirstCommentIntroRole,
  toggleFirstCommentIntroRole,
  resolveOwningMoveIdForCommentId,
  findExistingCommentIdAroundMove,
  insertCommentAroundMove,
  toggleMoveNag,
} from "../src/pgn_commands.js";
import { getMoveCommentsAfter } from "../src/pgn_move_attachments.js";
import {
  expectInvariantSafe,
  findMainlineMoveBySan,
  isMoveEntry,
  isMoveWithSan,
  parseModel,
} from "./support/pgn_harness.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

const firstMoveId = (model: ReturnType<typeof parsePgnToModel>): string => {
  const move = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  return move.id;
};

// ── setCommentTextById ─────────────────────────────────────────────────────────

test("setCommentTextById — updates comment raw text", () => {
  const model = parseModel("1. e4 {original} e5");
  const e4 = findMainlineMoveBySan(model, "e4");
  const commentId = getMoveCommentsAfter(e4)[0].id;
  const next = setCommentTextById(model, commentId, "updated") as typeof model;
  expectInvariantSafe(next, "setCommentTextById update");
  const nextE4 = findMainlineMoveBySan(next, "e4");
  assert.equal(getMoveCommentsAfter(nextE4)[0].raw, "updated");
});

test("setCommentTextById — does not mutate original", () => {
  const model = parsePgnToModel("1. e4 {original} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const commentId = getMoveCommentsAfter(e4)[0].id;
  setCommentTextById(model, commentId, "changed");
  // Original still has old text
  assert.equal(getMoveCommentsAfter(e4)[0].raw, "original");
});

test("setCommentTextById — empty text removes comment node", () => {
  const model = parsePgnToModel("4. Nf3 {temp} 4... Nc6");
  const nf3 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const commentId = getMoveCommentsAfter(nf3)[0].id;
  const next = setCommentTextById(model, commentId, "") as typeof model;
  const nextNf3 = next.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.equal(getMoveCommentsAfter(nextNf3).length, 0);
});

test("setCommentTextById — [[br]] only (cleared contentEditable) removes comment node", () => {
  const model = parsePgnToModel("1. Nd4+ Nxd4 {test} 2. Kf6 *");
  const nxd4 = model.root.entries.find(isMoveWithSan("Nxd4")) as PgnMoveNode;
  const commentId = getMoveCommentsAfter(nxd4)[0].id;
  const next = setCommentTextById(model, commentId, "[[br]]") as typeof model;
  const nextNxd4 = next.root.entries.find(isMoveWithSan("Nxd4")) as PgnMoveNode;
  assert.equal(getMoveCommentsAfter(nextNxd4).length, 0);
});

test("setCommentTextById — whitespace and repeated [[br]] only removes comment", () => {
  const model = parsePgnToModel("1. e4 {x} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const commentId = getMoveCommentsAfter(e4)[0].id;
  const next = setCommentTextById(model, commentId, "  [[br]]\n[[BR]]  ") as typeof model;
  const nextE4 = next.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.equal(getMoveCommentsAfter(nextE4).length, 0);
});

test("setCommentTextById — html/literal break marker text only removes comment", () => {
  const model = parsePgnToModel("1. e4 {x} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const commentId = getMoveCommentsAfter(e4)[0].id;
  const next = setCommentTextById(model, commentId, "  <br />  \\n  ") as typeof model;
  const nextE4 = next.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.equal(getMoveCommentsAfter(nextE4).length, 0);
});

test("setCommentTextById — unknown id returns model unchanged", () => {
  const model = parsePgnToModel("1. e4");
  const result = setCommentTextById(model, "no-such-id", "text");
  assert.deepEqual(result, model);
});

// ── removeCommentById ──────────────────────────────────────────────────────────

test("removeCommentById — removes comment after move", () => {
  const model = parseModel("1. e4 {to remove} e5");
  const e4 = findMainlineMoveBySan(model, "e4");
  const commentId = getMoveCommentsAfter(e4)[0].id;
  const next = removeCommentById(model, commentId);
  expectInvariantSafe(next as typeof model, "removeCommentById");
  const nextE4 = findMainlineMoveBySan(next as typeof model, "e4");
  assert.equal(getMoveCommentsAfter(nextE4).length, 0);
});

test("removeCommentById — unknown id returns same model reference", () => {
  const model = parsePgnToModel("1. e4");
  const result = removeCommentById(model, "no-such-id");
  assert.equal(result, model);
});

// ── getFirstCommentMetadata ────────────────────────────────────────────────────

test("getFirstCommentMetadata — no comments returns exists=false", () => {
  const model = parsePgnToModel("1. e4 e5");
  const meta = getFirstCommentMetadata(model);
  assert.equal(meta.exists, false);
  assert.equal(meta.commentId, null);
});

test("getFirstCommentMetadata — finds first comment", () => {
  const model = parsePgnToModel("1. e4 {hello} e5");
  const meta = getFirstCommentMetadata(model);
  assert.equal(meta.exists, true);
  assert.ok(meta.commentId !== null);
  assert.equal(meta.isIntro, false);
});

test("getFirstCommentMetadata — detects \\intro directive", () => {
  const model = parsePgnToModel(String.raw`1. e4 {\intro Opening study} e5`);
  const meta = getFirstCommentMetadata(model);
  assert.equal(meta.isIntro, true);
});

// ── setFirstCommentIntroRole ───────────────────────────────────────────────────

test("setFirstCommentIntroRole — adds \\intro when set to true", () => {
  const model = parsePgnToModel("1. e4 {plain text} e5");
  const next = setFirstCommentIntroRole(model, true);
  const meta = getFirstCommentMetadata(next);
  assert.equal(meta.isIntro, true);
});

test("setFirstCommentIntroRole — removes \\intro when set to false", () => {
  const model = parsePgnToModel(String.raw`1. e4 {\intro some text} e5`);
  const next = setFirstCommentIntroRole(model, false);
  const meta = getFirstCommentMetadata(next);
  assert.equal(meta.isIntro, false);
  assert.equal(meta.exists, true);
});

test("setFirstCommentIntroRole — no-op when already in desired state returns same model", () => {
  const model = parsePgnToModel(String.raw`1. e4 {\intro text} e5`);
  const result = setFirstCommentIntroRole(model, true);
  assert.equal(result, model);
});

// ── toggleFirstCommentIntroRole ────────────────────────────────────────────────

test("toggleFirstCommentIntroRole — toggles intro on", () => {
  const model = parsePgnToModel("1. e4 {plain} e5");
  const next = toggleFirstCommentIntroRole(model);
  const meta = getFirstCommentMetadata(next);
  assert.equal(meta.isIntro, true);
});

test("toggleFirstCommentIntroRole — toggles intro off", () => {
  const model = parsePgnToModel(String.raw`1. e4 {\intro plain} e5`);
  const next = toggleFirstCommentIntroRole(model);
  const meta = getFirstCommentMetadata(next);
  assert.equal(meta.isIntro, false);
});

test("toggleFirstCommentIntroRole — returns same model when no comment exists", () => {
  const model = parsePgnToModel("1. e4 e5");
  const result = toggleFirstCommentIntroRole(model);
  assert.equal(result, model);
});

// ── resolveOwningMoveIdForCommentId ────────────────────────────────────────────

test("resolveOwningMoveIdForCommentId — comment after move resolves to that move", () => {
  const model = parsePgnToModel("1. e4 {note} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const commentId = getMoveCommentsAfter(e4)[0].id;
  const moveId = resolveOwningMoveIdForCommentId(model, commentId);
  assert.equal(moveId, e4.id);
});

test("resolveOwningMoveIdForCommentId — unknown id returns null", () => {
  const model = parsePgnToModel("1. e4 e5");
  assert.equal(resolveOwningMoveIdForCommentId(model, "no-id"), null);
});

test("resolveOwningMoveIdForCommentId — empty commentId returns null", () => {
  const model = parsePgnToModel("1. e4 e5");
  assert.equal(resolveOwningMoveIdForCommentId(model, ""), null);
});

// ── findExistingCommentIdAroundMove ────────────────────────────────────────────

test("findExistingCommentIdAroundMove — finds after-comment", () => {
  const model = parsePgnToModel("1. e4 {after} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const found = findExistingCommentIdAroundMove(model, e4.id, "after");
  assert.equal(found, getMoveCommentsAfter(e4)[0].id);
});

test("findExistingCommentIdAroundMove — returns null when no comment in that position", () => {
  const model = parsePgnToModel("1. e4 e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.equal(findExistingCommentIdAroundMove(model, e4.id, "after"), null);
});

test("findExistingCommentIdAroundMove — defaults to after when position omitted", () => {
  const model = parsePgnToModel("1. e4 {after} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const found = findExistingCommentIdAroundMove(model, e4.id);
  assert.equal(found, getMoveCommentsAfter(e4)[0].id);
});

// ── insertCommentAroundMove ────────────────────────────────────────────────────

test("insertCommentAroundMove — inserts new comment after move", () => {
  const model = parseModel("1. e4 e5");
  const e4 = findMainlineMoveBySan(model, "e4");
  const { model: next, created, insertedCommentId } = insertCommentAroundMove(model, e4.id, "after", "new note");
  assert.equal(created, true);
  assert.ok(insertedCommentId !== null);
  expectInvariantSafe(next as typeof model, "insertCommentAroundMove");
  const nextE4 = findMainlineMoveBySan(next as typeof model, "e4");
  assert.ok(getMoveCommentsAfter(nextE4).some(c => c.raw === "new note"));
});

test("insertCommentAroundMove — returns existing comment id without creating", () => {
  const model = parsePgnToModel("1. e4 {existing} e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const existingId = getMoveCommentsAfter(e4)[0].id;
  const { created, insertedCommentId } = insertCommentAroundMove(model, e4.id, "after");
  assert.equal(created, false);
  assert.equal(insertedCommentId, existingId);
});

test("insertCommentAroundMove — unknown moveId returns model unchanged", () => {
  const model = parsePgnToModel("1. e4 e5");
  const { model: result, created } = insertCommentAroundMove(model, "no-such-id", "after");
  assert.equal(created, false);
  assert.equal(result, model);
});

// ── toggleMoveNag ──────────────────────────────────────────────────────────────

test("toggleMoveNag — adds NAG to move", () => {
  const model = parsePgnToModel("1. e4 e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const next = toggleMoveNag(model, e4.id, "$1") as typeof model;
  const nextE4 = next.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.ok(nextE4.nags.includes("$1"));
});

test("toggleMoveNag — removes NAG when already present", () => {
  const model = parsePgnToModel("1. e4 $1 e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.ok(e4.nags.includes("$1"));
  const next = toggleMoveNag(model, e4.id, "$1") as typeof model;
  const nextE4 = next.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.ok(!nextE4.nags.includes("$1"));
});

test("toggleMoveNag — group exclusivity: adding $2 removes $1", () => {
  // $1 = ! and $2 = ? are in the same move-quality group
  const model = parsePgnToModel("1. e4 $1 e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const next = toggleMoveNag(model, e4.id, "$2") as typeof model;
  const nextE4 = next.root.entries.find(isMoveEntry) as PgnMoveNode;
  assert.ok(nextE4.nags.includes("$2"), `nags: ${nextE4.nags}`);
  assert.ok(!nextE4.nags.includes("$1"), `nags: ${nextE4.nags}`);
});

test("toggleMoveNag — unknown moveId returns same model reference", () => {
  const model = parsePgnToModel("1. e4 e5");
  const result = toggleMoveNag(model, "no-such-id", "$1");
  assert.equal(result, model);
});

test("toggleMoveNag — does not mutate original model", () => {
  const model = parsePgnToModel("1. e4 e5");
  const e4 = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  toggleMoveNag(model, e4.id, "$1");
  assert.deepEqual(e4.nags, []);
});
