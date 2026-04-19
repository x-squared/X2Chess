/**
 * Unit tests for `move_position.ts`: SAN application, move-position index,
 * resolution, PV replay, and PGN stripping for the board parser.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import { normalizeForChessJs } from "../../../parts/pgnparser/src/pgn_headers.js";
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

test("buildMovePositionById — Namangan 2025 PGN builds resolvable index", () => {
  const pgn = `[Event "Namangan, 2025"]
[Site "?"]
[Date "2025.05.28"]
[Round "9.1"]
[White "Abdurakhmonov, Mukhammadali"]
[Black "Rasulov, Vugar"]
[Result "0-1"]
[WhiteElo "2348"]
[BlackElo "2483"]
[ECO "D35"]
[PlyCount "70"]
[BlackFideId "13402390"]
[BlackTitle "GM"]
[BroadcastName "Namangan Open"]
[BroadcastURL "https://lichess.org/broadcast/namangan-open/round-9/TtyNSSNY"]
[GameURL "https://lichess.org/broadcast/namangan-open/round-9/TtyNSSNY/tJV8m0GD"]
[Opening "Queen's Gambit Declined"]
[Source "https://lichess.org/broadcast/namangan-open/round-9/TtyNSSNY/tJV8m0GD"]
[TimeControl "90+30"]
[UTCDate "2025.05.28"]
[UTCTime "20:47:14"]
[Variant "Standard"]
[WhiteFideId "14207346"]
[WhiteTitle "IM"]
[Annotator "Carlsen, Magnus"]
[XSqrChessStyle "tree"]

{This is an example of a game with the Carlsbad setup. This is a system of asymmetrical __pawn__-chains on bith sides in the centre. The Carlsbad setup often results from the Caro Kan *exchangevariation*, or the Queen's gambit declined exchange variation.[[br]][[br]]The key features are:[[br]][[br]]- Bishop **placement**[[br]][[br]]- Night in centre[[br]][[br]]- Minority attack} 1.d4 d5 2.c4 e6 3.cxd5 {More precise is Nc3, Nf6, cd, ed, Bg5} (3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 c6 6.e3 h6 {Bf5 is followed by Qf3} 7.Bh4 Be7 8.Bd3 O-O {} 9.Qc2 Re8 10.Nge2 {On Nf3, Ne4} 10...Qc7 11.O-O Qa5 12.f3 b5) 3...exd5 4.Nc3 c6 {Prepares Bf5 and Bd6; on Bf5 immediately, you would have to handle Qb3; now this is countered with Qb6} 5.Nf3 {This will necessitate the minority attack on the Queen side; Qc2 to prevent Bf5 could b met with g6} 5...Nf6 {Simpler is Bd6, Bg5, Ne7 or Bf5} {} 6.Bg5 {Or h6, Bh4, Bf5; the h6 allows g5 on Qb3 followed by Qb6} 6...Be7 7.e3 Bf5 8.Be2 Nbd7 9.O-O h6 10.Bh4 O-O 11.Nd2 {Appreciating possibly Ne4, preparing to move to b3} 11...Re8 12.a3 Bd6 13.Bg3 {Do not leave the Bd6 unopposed; the resulting pawn structure is a good defense} 13...Bxg3 14.hxg3 Nb6 {On the way to d6} 15.b4 Nc8 (15...a6 16.a4 Qd6 17.b5 $2 cxb5 18.axb5 a5 {is an example of a peemature pawn storm; now black gets the c-file}) 16.a4 Nd6 17.b5 Rc8 18.Rc1 {On bc, Rxc6 and later Qa5} 18...Re7 {On the way to c7} 19.Qb3 Rec7 20.b6 axb6 21.Qxb6 h5 22.a5 g6 23.Na4 {Moves away a defender; better a6} 23...Kg7 24.Nc5 Qe7 25.a6 bxa6 26.Bxa6 Rh8 27.Nf3 Ng4 28.Nd3 $2 {Nh4 or Be2 are possible; the following line shows how tricky the best move Bd3 is} (28.Bd3 h4 29.gxh4 Rxh4 30.Bxf5 gxf5 31.Ne6+ fxe6 32.Nxh4 Rb7 33.Qxc6 Qxh4 34.Qxd6 e5 35.Rc7+ Rxc7 36.Qxc7+ {and perpetual check}) 28...h4 29.gxh4 {On Nxh4, Rxh4, and the queen breaks in} 29...Be4 30.Nde5 Nf5 $2 (30...Nxe5 31.Nxe5 Qxh4 32.f3 Re7 33.Qb2 Nf5 34.fxe4 Nxe3 35.Rb1 Qh1+ 36.Kf2 Qxg2+ 37.Kxe3 Qxe4+ 38.Kd2 Rh2+ 39.Kc3) 31.Ng5 $4 {[%eval -3.56] Blunder. Rxc6 was best. [%clk 0:03:56]} (31.Rxc6 Rxc6 32.Qxc6 Nxh4 33.Nd2 {just holds for white!}) 31...Nxe5 32.dxe5 Bxg2 33.e6 $4 (33.Rxc6 Rxc6 34.Qxc6 Bxf1 35.Bxf1 Qxe5) 33...Qxg5 34.hxg5 $4 (34.Qb2+ d4 35.f4 {On hg, Bf3} 35...Qxh4 36.Qxg2 Nxe3) 34...Bf3 35.Qb2+ d4 {and mate on h1} 0-1`;
  const model = parsePgnToModel(pgn);
  const index: MovePositionIndex = buildMovePositionById(model);
  const mainlineById: Record<string, number> = buildMainlinePlyByMoveId(model);
  const indexMainlineCount = Object.values(index).filter((entry) => entry.mainlinePly != null).length;
  assert.equal(indexMainlineCount, Object.keys(mainlineById).length);
  const primaryParser: Chess = new Chess();
  assert.throws(() => primaryParser.loadPgn(normalizeForChessJs(pgn)));
  const fallbackParser: Chess = new Chess();
  fallbackParser.loadPgn(normalizeForChessJs(stripAnnotationsForBoardParser(pgn)));
  assert.equal(fallbackParser.history().length, Object.keys(mainlineById).length);
  assert.ok(Object.keys(index).length > 0);
  const firstMove = model.root?.entries.find((entry) => entry.type === "move");
  assert.ok(firstMove?.type === "move");
  const firstResolved = resolveMovePositionById(model, firstMove?.id ?? "");
  assert.ok(firstResolved);
});

test("normalizeForChessJs — strips custom X2Chess headers for chess.js compatibility", () => {
  const source = `[Event "?"]
[XSqrChessStyle "tree"]
[XSqrChessBoardOrientation "black"]
[X2Style "tree"]
[X2BoardOrientation "black"]

1. e4 e5 *`;
  const parser: Chess = new Chess();
  parser.loadPgn(normalizeForChessJs(source));
  assert.equal(parser.history().length, 2);
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
