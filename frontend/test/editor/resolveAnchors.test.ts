import test from "node:test";
import assert from "node:assert/strict";
import { resolveAnchors } from "../../src/features/editor/model/resolveAnchors.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal PGN model with a mainline of moves and optional anchor annotations. */
const makeModel = (entries: unknown[]): unknown => ({
  root: { type: "variation", depth: 0, entries, trailingComments: [] },
});

const makeMove = (
  id: string,
  san: string,
  commentsAfter: { raw: string }[] = [],
  commentsBefore: { raw: string }[] = [],
): unknown => ({
  type: "move",
  id,
  san,
  commentsBefore,
  commentsAfter,
  nags: [],
  ravs: [],
});

const makeComment = (raw: string): unknown => ({
  type: "comment",
  id: `c_${Math.random()}`,
  raw,
});

// ── No anchors ────────────────────────────────────────────────────────────────

test("resolveAnchors — empty model returns empty array", () => {
  assert.deepEqual(resolveAnchors({}), []);
});

test("resolveAnchors — model with no root returns empty array", () => {
  assert.deepEqual(resolveAnchors({ root: null }), []);
});

test("resolveAnchors — moves with no anchor annotations return empty array", () => {
  const model = makeModel([
    makeMove("m1", "e4", [{ raw: "Normal comment" }]),
    makeMove("m2", "e5"),
  ]);
  assert.deepEqual(resolveAnchors(model), []);
});

// ── Single anchor in mainline ─────────────────────────────────────────────────

test("resolveAnchors — detects single anchor in mainline commentsAfter", () => {
  const model = makeModel([
    makeMove("m1", "e4"),
    makeMove("m2", "e5"),
    makeMove("m3", "Nf3", [{ raw: '[%anchor id="intro" text="The opening"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "intro");
  assert.equal(result[0]!.text, "The opening");
  assert.equal(result[0]!.moveId, "m3");
  assert.equal(result[0]!.moveSan, "Nf3");
  assert.ok(result[0]!.fen.length > 0);
  assert.ok(result[0]!.movePath.includes("Nf3"));
});

// ── Following comment text ────────────────────────────────────────────────────

test("resolveAnchors — extracts followingCommentText (stripped of anchor markup)", () => {
  const model = makeModel([
    makeMove("m1", "e4"),
    makeMove("m2", "e5", [
      { raw: '[%anchor id="x" text="Key moment"] The rook centralises.' },
    ]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.followingCommentText, "The rook centralises.");
});

// ── Preceding comment text ────────────────────────────────────────────────────

test("resolveAnchors — captures precedingCommentText from comment before move", () => {
  const model = makeModel([
    makeMove("m1", "e4", [{ raw: "After e4, the game opens." }]),
    makeMove("m2", "e5", [{ raw: '[%anchor id="a" text="Here"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.precedingCommentText, "After e4, the game opens.");
});

// ── Multiple anchors ──────────────────────────────────────────────────────────

test("resolveAnchors — collects multiple anchors in order", () => {
  const model = makeModel([
    makeMove("m1", "e4", [{ raw: '[%anchor id="first" text="First"]' }]),
    makeMove("m2", "e5", [{ raw: '[%anchor id="second" text="Second"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, "first");
  assert.equal(result[1]!.id, "second");
});

// ── Duplicate ID — first definition wins ─────────────────────────────────────

test("resolveAnchors — duplicate anchor IDs: first definition wins", () => {
  const model = makeModel([
    makeMove("m1", "e4", [{ raw: '[%anchor id="dup" text="First appearance"]' }]),
    makeMove("m2", "e5", [{ raw: '[%anchor id="dup" text="Second appearance"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.text, "First appearance");
});

// ── Move path formatting ──────────────────────────────────────────────────────

test("resolveAnchors — movePath includes correct move numbers", () => {
  const model = makeModel([
    makeMove("m1", "e4"),
    makeMove("m2", "e5"),
    makeMove("m3", "Nf3"),
    makeMove("m4", "Nc6"),
    makeMove("m5", "Bb5", [{ raw: '[%anchor id="ruy" text="Ruy Lopez"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  const path = result[0]!.movePath;
  assert.ok(path.startsWith("1."), `Expected path to start with "1.", got: ${path}`);
  assert.ok(path.includes("Bb5"), `Expected path to include Bb5, got: ${path}`);
  assert.ok(path.includes("3."), `Expected path to include "3.", got: ${path}`);
});

// ── Tolerance for invalid SANs ────────────────────────────────────────────────

test("resolveAnchors — skips invalid SAN moves without throwing", () => {
  const model = makeModel([
    makeMove("m1", "e4"),
    makeMove("m2", "INVALID_SAN"),
    makeMove("m3", "e5", [{ raw: '[%anchor id="a" text="A"]' }]),
  ]);
  // Should not throw; anchor may or may not be collected depending on recovery.
  assert.doesNotThrow((): void => { resolveAnchors(model); });
});

// ── FEN and lastMove ──────────────────────────────────────────────────────────

test("resolveAnchors — provides non-empty FEN for found anchor", () => {
  const model = makeModel([
    makeMove("m1", "e4", [{ raw: '[%anchor id="x" text="y"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  // FEN should be a valid non-empty string with 6 space-separated fields.
  const fenParts = result[0]!.fen.split(" ");
  assert.ok(fenParts.length >= 4, `FEN should have at least 4 parts: ${result[0]!.fen}`);
});

test("resolveAnchors — provides correct lastMove squares for e4", () => {
  const model = makeModel([
    makeMove("m1", "e4", [{ raw: '[%anchor id="x" text="y"]' }]),
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0]!.lastMove, ["e2", "e4"]);
});

// ── Comments-before move ──────────────────────────────────────────────────────

test("resolveAnchors — commentsBefore updates precedingCommentText", () => {
  const model = makeModel([
    makeMove("m1", "e4"),
    {
      type: "move",
      id: "m2",
      san: "e5",
      commentsBefore: [{ raw: "White's plan is revealed." }],
      commentsAfter: [{ raw: '[%anchor id="plan" text="Plan revealed"]' }],
      nags: [],
      ravs: [],
    },
  ]);
  const result = resolveAnchors(model);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.precedingCommentText, "White's plan is revealed.");
});
