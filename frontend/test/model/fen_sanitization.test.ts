import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSetupFen,
  sanitizeEnginePositionForUci,
} from "../../src/model/fen_sanitization.js";

test("sanitizeSetupFen (standard) — strips impossible White kingside castling flag", () => {
  const bad: string = "3k4/8/8/4B3/8/8/8/4Kb2 w K - 16 11";
  const out: string = sanitizeSetupFen(bad, "standard");
  assert.match(out, /\sw\s-\s/);
  assert.ok(!/\sw\sK[\s-]/.test(out));
});

test("sanitizeSetupFen (standard) — leaves standard start position unchanged", () => {
  const std: string =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  assert.equal(sanitizeSetupFen(std, "standard"), std);
});

test("sanitizeEnginePositionForUci — empty moves uses sanitized FEN only", () => {
  const bad: string = "3k4/8/8/4B3/8/8/8/4Kb2 w K - 16 11";
  const pos = sanitizeEnginePositionForUci({ fen: bad, moves: [] });
  assert.match(pos.fen, /\sw\s-\s/);
  assert.equal(pos.moves.length, 0);
});
