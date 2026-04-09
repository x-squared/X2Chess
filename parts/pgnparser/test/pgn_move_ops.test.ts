import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../src/pgn_model.js";
import {
  appendMove,
  insertVariation,
  replaceMove,
  truncateAfter,
  truncateBefore,
  deleteVariation,
  promoteToMainline,
  findCursorForMoveId,
} from "../src/pgn_move_ops.js";
import type { PgnCursor } from "../src/pgn_move_ops.js";
import type { PgnMoveNode, PgnModel } from "../src/pgn_model.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the SAN strings of moves in the mainline, in order. */
const mainlineSans = (model: PgnModel): string[] => {
  const result: string[] = [];
  for (const entry of model.root.entries) {
    if (entry.type === "move") result.push((entry as PgnMoveNode).san);
  }
  return result;
};

/** Returns a cursor pointing to the last move in the mainline. */
const lastMoveCursor = (model: PgnModel): PgnCursor => {
  let lastMoveId: string | null = null;
  for (const entry of model.root.entries) {
    if (entry.type === "move") lastMoveId = (entry as PgnMoveNode).id;
  }
  return { moveId: lastMoveId, variationId: model.root.id };
};

/** Returns a cursor at the root (before any move). */
const rootCursor = (model: PgnModel): PgnCursor => ({
  moveId: null,
  variationId: model.root.id,
});

// ── appendMove ─────────────────────────────────────────────────────────────────

test("appendMove — appends to empty game from root", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const [updated] = appendMove(model, rootCursor(model), "e4");
  assert.deepEqual(mainlineSans(updated), ["e4"]);
});

test("appendMove — appends after the last move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const [updated] = appendMove(model, lastMoveCursor(model), "Nf3");
  const sans = mainlineSans(updated);
  assert.equal(sans[sans.length - 1], "Nf3");
  assert.equal(sans.length, 3);
});

test("appendMove — does not mutate the original model", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 *");
  const originalLength = mainlineSans(model).length;
  appendMove(model, lastMoveCursor(model), "e5");
  assert.equal(mainlineSans(model).length, originalLength);
});

test("appendMove — returns a cursor pointing to the new move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const [updated, newCursor] = appendMove(model, rootCursor(model), "d4");
  const d4Entry = updated.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).san === "d4",
  ) as PgnMoveNode;
  assert.equal(newCursor.moveId, d4Entry.id);
});

// ── replaceMove ────────────────────────────────────────────────────────────────

test("replaceMove — replaces the first move and removes following moves", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const firstMoveEntry = model.root.entries.find((e) => e.type === "move") as PgnMoveNode;
  const cursor: PgnCursor = { moveId: null, variationId: model.root.id };
  const [updated] = replaceMove(model, cursor, "d4");
  const sans = mainlineSans(updated);
  assert.equal(sans[0], "d4");
  assert.equal(sans.length, 1);
  // Original is unchanged.
  assert.equal(mainlineSans(model)[0], firstMoveEntry.san);
});

// ── truncateAfter ──────────────────────────────────────────────────────────────

test("truncateAfter — removes the cursor move and everything after it", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 Nc6 *");
  const e5Entry = model.root.entries.filter((e) => e.type === "move")[1] as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e5Entry.id, variationId: model.root.id };
  const [updated] = truncateAfter(model, cursor);
  const sans = mainlineSans(updated);
  assert.deepEqual(sans, ["e4"]);
});

test("truncateAfter — does not mutate the original", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor = lastMoveCursor(model);
  truncateAfter(model, cursor);
  assert.equal(mainlineSans(model).length, 2);
});

// ── truncateBefore ─────────────────────────────────────────────────────────────

test("truncateBefore — removes all moves before the cursor move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 Nc6 *");
  const nf3Entry = model.root.entries.filter((e) => e.type === "move")[2] as PgnMoveNode;
  const cursor: PgnCursor = { moveId: nf3Entry.id, variationId: model.root.id };
  const [updated] = truncateBefore(model, cursor);
  const sans = mainlineSans(updated);
  assert.deepEqual(sans, ["Nf3", "Nc6"]);
});

// ── insertVariation ────────────────────────────────────────────────────────────

test("insertVariation — adds a RAV after the cursor move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4Entry = model.root.entries.filter((e) => e.type === "move")[0] as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: model.root.id };
  const [updated] = insertVariation(model, cursor, "d5");

  const e4InUpdated = updated.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).id === e4Entry.id,
  ) as PgnMoveNode;
  assert.equal(e4InUpdated.ravs.length, 1);
  const ravFirstMove = e4InUpdated.ravs[0]!.entries.find(
    (e) => e.type === "move",
  ) as PgnMoveNode;
  assert.equal(ravFirstMove.san, "d5");
});

test("insertVariation — does not branch at root cursor (returns unchanged)", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 *");
  const [result] = insertVariation(model, rootCursor(model), "d4");
  // With null cursor, insertVariation cannot branch — returns original.
  assert.equal(mainlineSans(result)[0], "e4");
});

// ── deleteVariation ────────────────────────────────────────────────────────────

test("deleteVariation — removes a RAV from its parent move", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4Entry = base.root.entries.filter((e) => e.type === "move")[0] as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: base.root.id };
  const [withVariation] = insertVariation(base, cursor, "d5");

  const e4InModel = withVariation.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).id === e4Entry.id,
  ) as PgnMoveNode;
  const ravId = e4InModel.ravs[0]!.id;
  const ravCursor: PgnCursor = { moveId: null, variationId: ravId };

  const [deleted] = deleteVariation(withVariation, ravCursor);
  const e4After = deleted.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).id === e4Entry.id,
  ) as PgnMoveNode;
  assert.equal(e4After.ravs.length, 0);
});

// ── findCursorForMoveId ────────────────────────────────────────────────────────

test("findCursorForMoveId — returns null for unknown id", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor = findCursorForMoveId(model, "nonexistent");
  assert.equal(cursor, null);
});

test("findCursorForMoveId — finds a move in the mainline", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const e4Entry = model.root.entries.filter((e) => e.type === "move")[0] as PgnMoveNode;
  const cursor = findCursorForMoveId(model, e4Entry.id);
  assert.notEqual(cursor, null);
  assert.equal(cursor?.moveId, e4Entry.id);
  assert.equal(cursor?.variationId, model.root.id);
});

// ── promoteToMainline ──────────────────────────────────────────────────────────

test("promoteToMainline — moves the RAV move to become mainline response", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4Entry = base.root.entries.filter((e) => e.type === "move")[0] as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: base.root.id };
  const [withVariation] = insertVariation(base, cursor, "d5");

  const e4InModel = withVariation.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).id === e4Entry.id,
  ) as PgnMoveNode;
  const ravId = e4InModel.ravs[0]!.id;
  const d5Move = e4InModel.ravs[0]!.entries.find((e) => e.type === "move") as PgnMoveNode;
  const ravCursor: PgnCursor = { moveId: d5Move.id, variationId: ravId };

  const [promoted] = promoteToMainline(withVariation, ravCursor);
  const sans = mainlineSans(promoted);
  assert.equal(sans[0], "e4");
  assert.equal(sans[1], "d5");
});
