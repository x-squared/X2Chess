/**
 * Unit tests for `move_position.ts`: SAN application, move-position index,
 * resolution, PV replay, and PGN stripping for the board parser.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import {
  applySanWithFallback,
  buildMainlinePlyByMoveId,
  buildMovePositionById,
  replayPvToPosition,
  resolveMovePositionById,
  stripAnnotationsForBoardParser,
  type MovePositionIndex,
  type MovePositionRecord,
} from "../../src/board/move_position.js";
import type { PgnModel } from "../../../parts/pgnparser/src/pgn_model.js";

test("buildMovePositionById — empty / missing root yields empty index", () => {
  const empty: MovePositionIndex = buildMovePositionById({} as PgnModel);
  assert.deepEqual(empty, {});
  const noRoot: MovePositionIndex = buildMovePositionById({ root: undefined } as unknown as PgnModel);
  assert.deepEqual(noRoot, {});
});

test("buildMovePositionById — game with no moves yields empty index", () => {
  const model = parsePgnToModel('[Event "?"]\n\n*');
  const idx: MovePositionIndex = buildMovePositionById(model);
  assert.deepEqual(idx, {});
});

test("buildMovePositionById — mainline chains previous / next and mainlinePly", () => {
  const model = parsePgnToModel('[Event "?"]\n\n1. e4 e5 2. Nf3 *');
  const idx: MovePositionIndex = buildMovePositionById(model);
  const mainline: [string, MovePositionRecord][] = Object.entries(idx)
    .filter((entry: [string, MovePositionRecord]): boolean => entry[1].mainlinePly != null)
    .sort(
      (a: [string, MovePositionRecord], b: [string, MovePositionRecord]): number =>
        (a[1].mainlinePly ?? 0) - (b[1].mainlinePly ?? 0),
    );
  assert.equal(mainline.length, 3);
  const first: MovePositionRecord = mainline[0][1];
  const mid: MovePositionRecord = mainline[1][1];
  const last: MovePositionRecord = mainline[2][1];
  assert.equal(first.previousMoveId, null);
  assert.equal(first.nextMoveId, mainline[1][0]);
  assert.equal(mid.previousMoveId, mainline[0][0]);
  assert.equal(mid.nextMoveId, mainline[2][0]);
  assert.equal(last.previousMoveId, mainline[1][0]);
  assert.equal(last.nextMoveId, null);
  assert.equal(first.mainlinePly, 1);
  assert.equal(mid.mainlinePly, 2);
  assert.equal(last.mainlinePly, 3);
});

test("buildMovePositionById — RAV first move is variation start and lists under parent", () => {
  const model = parsePgnToModel('[Event "?"]\n\n1. e4 e5 (2. Nf3 Nc6) 2. Nf3 Nc6 *');
  const idx: MovePositionIndex = buildMovePositionById(model);
  const parentEntry: [string, MovePositionRecord] | undefined = Object.entries(idx).find(
    (entry: [string, MovePositionRecord]): boolean => entry[1].variationFirstMoveIds.length > 0,
  );
  if (parentEntry) {
    const parentId: string = parentEntry[0];
    const parentRec: MovePositionRecord = parentEntry[1];
    const firstVarId: string = parentRec.variationFirstMoveIds[0];
    const varRec: MovePositionRecord | undefined = idx[firstVarId];
    if (varRec) {
      assert.equal(varRec.isVariationStart, true);
      assert.equal(varRec.parentMoveId, parentId);
    } else {
      assert.fail("expected RAV first-move record in index");
    }
  } else {
    assert.fail("expected a mainline move with RAV children");
  }
});

test("resolveMovePositionById — matches buildMovePositionById for every indexed move", () => {
  const model = parsePgnToModel('[Event "?"]\n\n1. e4 e5 (2. Nf3 Nc6) 2. Nf3 Nc6 *');
  const idx: MovePositionIndex = buildMovePositionById(model);
  for (const moveId of Object.keys(idx)) {
    const built: MovePositionRecord | undefined = idx[moveId];
    if (built === undefined) {
      assert.fail(`missing index entry ${moveId}`);
    }
    const resolved = resolveMovePositionById(model, moveId);
    if (resolved) {
      assert.equal(resolved.fen, built.fen, `fen ${moveId}`);
      assert.equal(resolved.mainlinePly, built.mainlinePly, `mainlinePly ${moveId}`);
      assert.equal(resolved.parentMoveId, built.parentMoveId, `parentMoveId ${moveId}`);
      assert.deepEqual(resolved.lastMove, built.lastMove, `lastMove ${moveId}`);
    } else {
      assert.fail(`resolve ${moveId}`);
    }
  }
});

test("resolveMovePositionById — unknown id returns null", () => {
  const model = parsePgnToModel("1. e4 *");
  const r = resolveMovePositionById(model, "no_such_move");
  assert.equal(r, null);
});

test("buildMainlinePlyByMoveId — only root mainline move nodes", () => {
  const model = parsePgnToModel('[Event "?"]\n\n1. e4 e5 (2. Nf3 Nc6) 2. Nf3 Nc6 *');
  const byPly = buildMainlinePlyByMoveId(model);
  const entries = model.root?.entries.filter((e) => e.type === "move") ?? [];
  assert.equal(Object.keys(byPly).length, entries.length);
  let ply = 0;
  for (const e of entries) {
    if (e.type !== "move") continue;
    ply += 1;
    assert.equal(byPly[e.id], ply);
  }
});

test("applySanWithFallback — tolerates NAG suffix on SAN", () => {
  const game: Chess = new Chess();
  const moved = applySanWithFallback(game, "e4?!");
  assert.ok(moved);
  assert.ok(game.fen().includes("4P3"));
});

test("replayPvToPosition — inclusive index 0 applies first SAN", () => {
  const startFen: string = new Chess().fen();
  const result = replayPvToPosition(startFen, ["e4", "e5"], 0);
  assert.ok(result.fen.includes("4P3"));
  assert.deepEqual(result.lastMove, ["e2", "e4"]);
});

test("replayPvToPosition — bad start FEN returns original fen", () => {
  const bad = "not-a-fen";
  const result = replayPvToPosition(bad, ["e4"], 0);
  assert.equal(result.fen, bad);
  assert.equal(result.lastMove, null);
});

// Non-standard FEN (position after 1. e4 c5): white to move on move 2.
const SICILIAN_FEN = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2";

test("buildMovePositionById — non-standard FEN with standard numbering (1.) indexes all mainline moves", () => {
  const model = parsePgnToModel(`[FEN "${SICILIAN_FEN}"]\n\n1. Nf3 Nc6 2. d4 *`);
  const idx: MovePositionIndex = buildMovePositionById(model);
  const mainline: [string, MovePositionRecord][] = Object.entries(idx)
    .filter((entry: [string, MovePositionRecord]): boolean => entry[1].mainlinePly != null)
    .sort(
      (a: [string, MovePositionRecord], b: [string, MovePositionRecord]): number =>
        (a[1].mainlinePly ?? 0) - (b[1].mainlinePly ?? 0),
    );
  assert.equal(mainline.length, 3);
  assert.equal(mainline[0][1].mainlinePly, 1);
  assert.equal(mainline[1][1].mainlinePly, 2);
  assert.equal(mainline[2][1].mainlinePly, 3);
  for (const [, rec] of mainline) {
    assert.notEqual(rec.fen, SICILIAN_FEN, "move FEN must differ from start FEN");
    assert.ok(rec.lastMove != null, "lastMove must be non-null after applying move");
  }
});

test("buildMovePositionById — non-standard FEN with non-standard numbering (2.) indexes all mainline moves", () => {
  const model = parsePgnToModel(`[FEN "${SICILIAN_FEN}"]\n\n2. Nf3 Nc6 3. d4 *`);
  const idx: MovePositionIndex = buildMovePositionById(model);
  const mainline: [string, MovePositionRecord][] = Object.entries(idx)
    .filter((entry: [string, MovePositionRecord]): boolean => entry[1].mainlinePly != null)
    .sort(
      (a: [string, MovePositionRecord], b: [string, MovePositionRecord]): number =>
        (a[1].mainlinePly ?? 0) - (b[1].mainlinePly ?? 0),
    );
  assert.equal(mainline.length, 3);
  assert.equal(mainline[0][1].mainlinePly, 1);
  assert.equal(mainline[1][1].mainlinePly, 2);
  assert.equal(mainline[2][1].mainlinePly, 3);
  for (const [, rec] of mainline) {
    assert.notEqual(rec.fen, SICILIAN_FEN, "move FEN must differ from start FEN");
    assert.ok(rec.lastMove != null, "lastMove must be non-null after applying move");
  }
});

test("buildMovePositionById — non-standard FEN: standard and non-standard move numbering yield identical mainline FENs", () => {
  const idxStd: MovePositionIndex = buildMovePositionById(
    parsePgnToModel(`[FEN "${SICILIAN_FEN}"]\n\n1. Nf3 Nc6 2. d4 *`),
  );
  const idxNonStd: MovePositionIndex = buildMovePositionById(
    parsePgnToModel(`[FEN "${SICILIAN_FEN}"]\n\n2. Nf3 Nc6 3. d4 *`),
  );
  const fensOf = (idx: MovePositionIndex): string[] =>
    Object.values(idx)
      .filter((rec: MovePositionRecord): boolean => rec.mainlinePly != null)
      .sort((a: MovePositionRecord, b: MovePositionRecord): number =>
        (a.mainlinePly ?? 0) - (b.mainlinePly ?? 0),
      )
      .map((rec: MovePositionRecord): string => rec.fen);
  const fensStd = fensOf(idxStd);
  const fensNonStd = fensOf(idxNonStd);
  assert.equal(fensStd.length, 3, "expected 3 mainline positions");
  assert.deepEqual(fensStd, fensNonStd, "same starting FEN + same moves must yield same positions regardless of numbering");
});

test("buildMovePositionById — non-standard FEN with standard numbering (1.) - mainline moves all have different FENs", () => {
  const model = parsePgnToModel(`[FEN "${SICILIAN_FEN}"]\n\n1. Nf3 Nc6 2. d4 cxd4 3. Nxd4 e5 4. Nb5 d6 *`);
  const idx: MovePositionIndex = buildMovePositionById(model);
  const mainlineFens: string[] = Object.values(idx)
    .filter((rec: MovePositionRecord): boolean => rec.mainlinePly != null)
    .map((rec: MovePositionRecord): string => rec.fen);
  assert.equal(mainlineFens.length, 8, "expected 8 mainline moves");
  assert.equal(new Set(mainlineFens).size, mainlineFens.length, "each mainline move must produce a unique FEN");
});

test("stripAnnotationsForBoardParser — strips comments and parenthetical variations", () => {
  const stripped: string = stripAnnotationsForBoardParser("1. e4 {comment} e5 (2. d4 d5)");
  assert.match(stripped, /1\.\s*e4/);
  assert.ok(!stripped.includes("comment"));
  assert.ok(!stripped.includes("d4"));
});

test("FEN + null-move: mainline and variation moves resolve after null move", () => {
  const model = parsePgnToModel(
    '[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. -- 1... Kd7 (1... Kf7) *',
  );
  const idx: MovePositionIndex = buildMovePositionById(model);
  const mainline: [string, MovePositionRecord][] = Object.entries(idx)
    .filter((entry: [string, MovePositionRecord]): boolean => entry[1].mainlinePly != null)
    .sort(
      (a: [string, MovePositionRecord], b: [string, MovePositionRecord]): number =>
        (a[1].mainlinePly ?? 0) - (b[1].mainlinePly ?? 0),
    );
  assert.equal(mainline.length, 2, "null move and black reply should both be indexed");
  assert.equal(mainline[0][1].lastMove, null, "null move must not carry from/to squares");
  const resolvedMainline = resolveMovePositionById(model, mainline[1][0]);
  assert.ok(resolvedMainline, "mainline move after null move should resolve");

  const variationEntry: [string, MovePositionRecord] | undefined = Object.entries(idx).find(
    (entry: [string, MovePositionRecord]): boolean =>
      entry[1].mainlinePly === null && entry[1].parentMoveId === mainline[1][0],
  );
  if (!variationEntry) {
    assert.fail("expected variation move branching after null move");
    return;
  }
  const variationMoveId: string = variationEntry[0];
  const resolved = resolveMovePositionById(model, variationMoveId);
  assert.ok(resolved, "variation move should resolve");
  if (!resolved) return;
  assert.equal(resolved.mainlinePly, null);
  assert.equal(typeof resolved.fen, "string");
  assert.ok(resolved.fen.length > 0);
});
