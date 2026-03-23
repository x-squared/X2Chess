import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../../src/model/pgn_model.js";
import { applyMergeToModel, mergeToNewPgn } from "../../src/training/merge_transcript.js";
import type { MergeSelection, TrainingAnnotation } from "../../src/training/domain/training_transcript.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeAnnotation = (ply: number, content: string): TrainingAnnotation => ({
  ply,
  kind: "comment",
  content,
  source: "user",
});

const makeMergeSelection = (
  annotations: TrainingAnnotation[],
  includeAll = true,
): MergeSelection => ({
  annotations: annotations.map((a) => ({ annotation: a, include: includeAll })),
  mergeTarget: "source_game",
});

const TEST_PGN = "[Event \"Test\"]\n\n1. e4 e5 2. Nf3 Nc6 *";

// ── applyMergeToModel ──────────────────────────────────────────────────────────

test("applyMergeToModel — empty selection returns model unchanged", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection: MergeSelection = { annotations: [], mergeTarget: "source_game" };
  const result = applyMergeToModel(model, selection);
  // Should still have the same moves
  const moves = result.root.entries.filter((e) => e.type === "move");
  assert.equal(moves.length, 4);
});

test("applyMergeToModel — excluded annotation is not applied", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection: MergeSelection = {
    annotations: [{ annotation: makeAnnotation(0, "Nice move"), include: false }],
    mergeTarget: "source_game",
  };
  const result = applyMergeToModel(model, selection);
  // No comments should be in entries
  const comments = result.root.entries.filter((e) => e.type === "comment");
  assert.equal(comments.length, 0);
});

test("applyMergeToModel — does not mutate the original model", () => {
  const model = parsePgnToModel(TEST_PGN);
  const originalEntryCount = model.root.entries.length;
  const selection = makeMergeSelection([makeAnnotation(0, "Nice!")]);
  applyMergeToModel(model, selection);
  assert.equal(model.root.entries.length, originalEntryCount);
});

test("applyMergeToModel — annotation at unknown ply is silently skipped", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection = makeMergeSelection([makeAnnotation(99, "Way out of range")]);
  const result = applyMergeToModel(model, selection);
  // Should complete without error; model is unchanged
  const moves = result.root.entries.filter((e) => e.type === "move");
  assert.equal(moves.length, 4);
});

// ── mergeToNewPgn ─────────────────────────────────────────────────────────────

test("mergeToNewPgn — returns a PGN string", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection: MergeSelection = { annotations: [], mergeTarget: "new_variation" };
  const pgn = mergeToNewPgn(model, selection);
  assert.ok(typeof pgn === "string");
  assert.ok(pgn.length > 0);
});

test("mergeToNewPgn — appends Training suffix to Event header by default", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection: MergeSelection = { annotations: [], mergeTarget: "new_variation" };
  const pgn = mergeToNewPgn(model, selection);
  assert.ok(pgn.includes("Training"), `Expected 'Training' in PGN, got: ${pgn.slice(0, 200)}`);
});

test("mergeToNewPgn — custom event suffix is applied", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection: MergeSelection = { annotations: [], mergeTarget: "new_variation" };
  const pgn = mergeToNewPgn(model, selection, "Review");
  assert.ok(pgn.includes("Review"));
});

test("mergeToNewPgn — empty suffix omits parenthetical", () => {
  const model = parsePgnToModel(TEST_PGN);
  const selection: MergeSelection = { annotations: [], mergeTarget: "source_game" };
  const pgn = mergeToNewPgn(model, selection, "");
  // Event should be just "Test" without " ()"
  assert.ok(!pgn.includes("()"));
});
