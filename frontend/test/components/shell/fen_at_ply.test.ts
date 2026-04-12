import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { buildFenAtPly } from "../../../src/app/shell/fen_at_ply.js";

test("buildFenAtPly replays SAN on standard start", (): void => {
  const fen: string = buildFenAtPly(["e4", "e5", "Nf3"], 3);
  const game = new Chess();
  game.move("e4");
  game.move("e5");
  game.move("Nf3");
  assert.equal(fen, game.fen());
});

test("buildFenAtPly supports null moves on custom FEN start", (): void => {
  const startFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  const fen: string = buildFenAtPly(["--", "Kd7"], 2, startFen);
  const game = new Chess(startFen);
  game.move("--");
  game.move("Kd7");
  assert.equal(fen, game.fen());
});

test("buildFenAtPly does not throw on invalid SAN and returns last valid position", (): void => {
  const startFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  const fen: string = buildFenAtPly(["--", "Nd4+"], 2, startFen);
  const game = new Chess(startFen);
  game.move("--");
  assert.equal(fen, game.fen());
});
