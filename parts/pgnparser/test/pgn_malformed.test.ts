import test from "node:test";
import assert from "node:assert/strict";
import type { PgnMoveNode } from "../src/pgn_model.js";
import {
  findFirstMoveInEntries,
  findMainlineMoveBySan,
  isMoveEntry,
  parseModel,
  serializeModel,
} from "./support/pgn_harness.js";
import { getMoveCommentsAfter, getMoveRavs } from "../src/pgn_move_attachments.js";

test("malformed PGN — unterminated comment consumes the rest as one comment", () => {
  const model = parseModel("1. e4 {unterminated comment");
  const e4: PgnMoveNode = findMainlineMoveBySan(model, "e4");
  const commentsAfter = getMoveCommentsAfter(e4);
  assert.equal(commentsAfter.length, 1);
  assert.equal(commentsAfter[0].raw, "unterminated comment");
});

test("malformed PGN — unmatched opening parenthesis keeps parsed side-variation", () => {
  const model = parseModel("1. e4 (1... c5");
  const e4: PgnMoveNode = findMainlineMoveBySan(model, "e4");
  const ravs = getMoveRavs(e4);
  assert.equal(ravs.length, 1);
  const c5 = findFirstMoveInEntries(ravs[0].entries);
  assert.equal(c5?.san, "c5");
});

test("malformed PGN — unmatched closing parenthesis stops further parsing safely", () => {
  const model = parseModel("1. e4 ) 1... e5 2. Nf3");
  const moves = model.root.entries.filter(isMoveEntry);
  assert.deepEqual(moves.map((move): string => move.san), ["e4"]);
});

test("malformed PGN — unknown symbols are preserved as SAN tokens", () => {
  const model = parseModel("1. e4 ??? e5");
  const moves = model.root.entries.filter(isMoveEntry);
  assert.deepEqual(moves.map((move): string => move.san), ["e4", "???", "e5"]);
});

test("malformed PGN — serializer remains stable for malformed parse result", () => {
  const model = parseModel("1. e4 ) 1... e5");
  const serialized = serializeModel(model);
  assert.equal(serialized, "1. e4");
});
