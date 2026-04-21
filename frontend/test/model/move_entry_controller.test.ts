import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import { resolveMoveEntry } from "../../src/model/move_entry_controller.js";
import { insertVariation } from "../../../parts/pgnparser/src/pgn_move_ops.js";
import { getMoveRavs } from "../../../parts/pgnparser/src/pgn_move_attachments.js";
import type { PgnCursor } from "../../../parts/pgnparser/src/pgn_move_ops.js";
import type { PgnMoveNode } from "../../../parts/pgnparser/src/pgn_model.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// FEN after 1. e4
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
// FEN after 1. e4 e5
const AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";

// ── append ─────────────────────────────────────────────────────────────────────

test("resolveMoveEntry — append when game is empty (root cursor)", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const cursor: PgnCursor = { moveId: null, variationId: model.root.id };
  const result = resolveMoveEntry({
    boardMove: { from: "e2", to: "e4" },
    currentFen: START_FEN,
    model,
    cursor,
  });
  assert.ok(result !== null);
  assert.equal(result?.kind, "append");
  assert.equal((result as { kind: "append"; san: string }).san, "e4");
});

test("resolveMoveEntry — append when cursor is at the last move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 *");
  const e4Entry = model.root.entries.find((e) => e.type === "move") as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: model.root.id };
  const result = resolveMoveEntry({
    boardMove: { from: "e7", to: "e5" },
    currentFen: AFTER_E4_FEN,
    model,
    cursor,
  });
  assert.ok(result !== null);
  assert.equal(result?.kind, "append");
});

// ── advance ────────────────────────────────────────────────────────────────────

test("resolveMoveEntry — advance when played move matches next mainline move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor: PgnCursor = { moveId: null, variationId: model.root.id };
  const result = resolveMoveEntry({
    boardMove: { from: "e2", to: "e4" },
    currentFen: START_FEN,
    model,
    cursor,
  });
  assert.ok(result !== null);
  assert.equal(result?.kind, "advance");
  const e4Entry = model.root.entries.find((e) => e.type === "move") as PgnMoveNode;
  assert.equal((result as { kind: "advance"; san: string; nextMoveId: string }).nextMoveId, e4Entry.id);
});

// ── fork ───────────────────────────────────────────────────────────────────────

test("resolveMoveEntry — fork when played move differs from next mainline move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor: PgnCursor = { moveId: null, variationId: model.root.id };
  const result = resolveMoveEntry({
    boardMove: { from: "d2", to: "d4" },
    currentFen: START_FEN,
    model,
    cursor,
  });
  assert.ok(result !== null);
  assert.equal(result?.kind, "fork");
  const fork = result as { kind: "fork"; san: string; existingNextSan: string };
  assert.equal(fork.san, "d4");
  assert.equal(fork.existingNextSan, "e4");
});

// ── enter_variation ───────────────────────────────────────────────────────────

test("resolveMoveEntry — enter_variation when played move matches a RAV on the next mainline move", () => {
  // RAVs representing black alternatives belong on the black move (nextMove), not
  // on the preceding white move. Cursor is on e4; the variation d5 is stored as
  // a RAV on e5 (the next mainline move); playing d5 should detect enter_variation.
  const gameModel = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const gameE5 = gameModel.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).san === "e5",
  ) as PgnMoveNode;
  const [withRav] = insertVariation(
    gameModel,
    { moveId: gameE5.id, variationId: gameModel.root.id },
    "d5",
  );

  const gameE4 = gameModel.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).san === "e4",
  ) as PgnMoveNode;
  const e5InUpdated = withRav.root.entries.find(
    (e) => e.type === "move" && (e as PgnMoveNode).id === gameE5.id,
  ) as PgnMoveNode;
  const result = resolveMoveEntry({
    boardMove: { from: "d7", to: "d5" },
    currentFen: AFTER_E4_FEN,
    model: withRav,
    cursor: { moveId: gameE4.id, variationId: withRav.root.id },
  });
  assert.ok(result !== null);
  assert.equal(result?.kind, "enter_variation");
  const ev = result as { kind: "enter_variation"; san: string; variationId: string };
  assert.equal(ev.san, "d5");
  assert.equal(ev.variationId, getMoveRavs(e5InUpdated)[0]!.id);
});

// ── illegal ────────────────────────────────────────────────────────────────────

test("resolveMoveEntry — illegal when move is not valid in the position", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const cursor: PgnCursor = { moveId: null, variationId: model.root.id };
  // e2 to e5 is illegal from start position
  const result = resolveMoveEntry({
    boardMove: { from: "e2", to: "e5" },
    currentFen: START_FEN,
    model,
    cursor,
  });
  assert.ok(result !== null);
  assert.equal(result?.kind, "illegal");
});

// ── null on invalid FEN ────────────────────────────────────────────────────────

test("resolveMoveEntry — returns null for invalid FEN", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const cursor: PgnCursor = { moveId: null, variationId: model.root.id };
  const result = resolveMoveEntry({
    boardMove: { from: "e2", to: "e4" },
    currentFen: "not-a-fen",
    model,
    cursor,
  });
  assert.equal(result, null);
});
