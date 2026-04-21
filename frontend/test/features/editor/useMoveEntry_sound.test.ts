import test from "node:test";
import assert from "node:assert/strict";
import { resolveMoveSoundTypeForBoardMove } from "../../../src/features/editor/hooks/useMoveEntry.js";

test("resolveMoveSoundTypeForBoardMove — classifies a normal move", () => {
  const startFen: string = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const soundType = resolveMoveSoundTypeForBoardMove(startFen, "e2", "e4");
  assert.equal(soundType, "move");
});

test("resolveMoveSoundTypeForBoardMove — classifies castling", () => {
  const fen: string = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  const soundType = resolveMoveSoundTypeForBoardMove(fen, "e1", "g1");
  assert.equal(soundType, "castling");
});

test("resolveMoveSoundTypeForBoardMove — classifies checkmate", () => {
  const fen: string = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2";
  const soundType = resolveMoveSoundTypeForBoardMove(fen, "d8", "h4");
  assert.equal(soundType, "checkmate");
});
