import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../../../../parts/pgnparser/src/pgn_model.js";
import { getMoveRavs } from "../../../../parts/pgnparser/src/pgn_move_attachments.js";
import { resolveMoveEntryFen } from "../../../src/features/editor/hooks/useMoveEntry.js";
import type { PgnMoveNode } from "../../../../parts/pgnparser/src/pgn_model.js";

test("resolveMoveEntryFen — prefers board preview FEN over mainline replay", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const fen = resolveMoveEntryFen(
    model,
    null,
    "7k/1P6/8/8/8/8/3P4/4K3 b KQkq - 0 1",
    ["e4", "e5"],
    1,
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  );
  assert.equal(fen, "7k/1P6/8/8/8/8/3P4/4K3 b KQkq - 0 1");
});

test("resolveMoveEntryFen — resolves selected variation move position before mainline fallback", () => {
  const model = parsePgnToModel(
    "[FEN \"7k/1P6/8/8/8/8/3P4/4K3 w KQkq - 0 1\"]\n\n1. d3 Kg7 (1... Kh7) *",
  );
  const kg7 = model.root.entries.find(
    (entry): entry is PgnMoveNode => entry.type === "move" && entry.san === "Kg7",
  );
  assert.ok(kg7);
  const ravMoves = getMoveRavs(kg7)[0]?.entries.filter(
    (entry): entry is PgnMoveNode => entry.type === "move",
  );
  const kh7 = ravMoves?.find((entry) => entry.san === "Kh7");
  assert.ok(kh7);
  const fen = resolveMoveEntryFen(
    model,
    kh7.id,
    null,
    ["d3", "Kg7"],
    2,
    "7k/1P6/8/8/8/8/3P4/4K3 w KQkq - 0 1",
  );
  assert.equal(fen.split(" ")[1], "w");
});
