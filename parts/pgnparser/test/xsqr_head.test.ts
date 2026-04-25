import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../src/pgn_model.js";
import { joinXsqrHeadParts, serializeXsqrHeadMovetext, XSQR_HEAD_HEADER_KEY } from "../src/pgn_serialize.js";

test("joinXsqrHeadParts glues white move number to SAN", () => {
  assert.equal(joinXsqrHeadParts(["1.", "e4", "e5"]), "1.e4 e5");
  assert.equal(joinXsqrHeadParts(["12.", "Nf3"]), "12.Nf3");
});

test("serializeXsqrHeadMovetext — mainline moves only (no *, NAGs, comments)", () => {
  const pgn: string = `[Event "?"]\n\n1. e4 {hello} e5 $1 2. Nf3 Nc6 *`;
  const model = parsePgnToModel(pgn);
  const head: string = serializeXsqrHeadMovetext(model);
  assert.equal(head, "1.e4 e5 2.Nf3 Nc6");
  assert.ok(!head.includes("*"));
  assert.ok(!head.includes("$"));
  assert.ok(!head.includes("{"));
});

test("serializeXsqrHeadMovetext — mainline moves without decorations", () => {
  const pgn: string = `[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6 *`;
  const model = parsePgnToModel(pgn);
  assert.equal(serializeXsqrHeadMovetext(model), "1.e4 e5 2.Nf3 Nc6");
});

test("serializeXsqrHeadMovetext — stops at first sibling variation", () => {
  const pgn: string = `[Event "?"]\n\n1. e4 (1. d4 d5) e5 *`;
  const model = parsePgnToModel(pgn);
  const head: string = serializeXsqrHeadMovetext(model);
  assert.equal(head, "1.e4");
  assert.ok(!head.includes("e5"));
});

test("serializeXsqrHeadMovetext — stops at RAV after a move", () => {
  const pgn: string = `[Event "?"]\n\n1. e4 e5 (1... c5) 2. Nf3 *`;
  const model = parsePgnToModel(pgn);
  const head: string = serializeXsqrHeadMovetext(model);
  assert.equal(head, "1.e4 e5");
  assert.ok(!head.includes("Nf3"));
});

test("serializeXsqrHeadMovetext — move node may omit ravs (no throw)", () => {
  const model: unknown = {
    root: {
      entries: [
        { type: "move_number", text: "1.", id: "n0" },
        { id: "m0", type: "move", san: "e4" },
        { type: "result", text: "*", id: "r0" },
      ],
    },
  };
  assert.equal(serializeXsqrHeadMovetext(model), "1.e4");
});

test("XSQR_HEAD_HEADER_KEY is stable", () => {
  assert.equal(XSQR_HEAD_HEADER_KEY, "Head");
});
