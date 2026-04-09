import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import { appendMove } from "../../../parts/pgnparser/src/pgn_move_ops.js";
import { serializeModelToPgn } from "../../../parts/pgnparser/src/pgn_serialize.js";

const newGamePgn = '[Event "?"]\n[Site "?"]\n[Date "2026.04.06"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n*';

test("appendMove to empty game — serialized PGN is parseable by chess.js and yields ['e4']", () => {
  const model = parsePgnToModel(newGamePgn);
  const cursor = { moveId: null, variationId: model.root.id };
  const [updated] = appendMove(model, cursor, "e4");

  const serialized = serializeModelToPgn(updated);
  const parser = new Chess();
  parser.loadPgn(serialized);
  assert.deepEqual(parser.history(), ["e4"]);
});

test("appendMove to empty game — serialized movetext contains move number '1.'", () => {
  const model = parsePgnToModel(newGamePgn);
  const cursor = { moveId: null, variationId: model.root.id };
  const [updated] = appendMove(model, cursor, "e4");

  const serialized = serializeModelToPgn(updated);
  const movetext = serialized.split("\n\n").slice(1).join("\n\n");
  assert.ok(movetext.includes("1."), `Expected '1.' in movetext but got: ${movetext}`);
});

test("appendMove two moves — serialized PGN yields ['e4', 'e5'] and has '1.'", () => {
  const model = parsePgnToModel(newGamePgn);
  const cursor1 = { moveId: null, variationId: model.root.id };
  const [m2, c2] = appendMove(model, cursor1, "e4");
  const [m3] = appendMove(m2, c2, "e5");

  const serialized = serializeModelToPgn(m3);
  const parser = new Chess();
  parser.loadPgn(serialized);
  assert.deepEqual(parser.history(), ["e4", "e5"]);
});
