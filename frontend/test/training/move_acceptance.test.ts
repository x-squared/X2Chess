import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import { acceptMove } from "../../src/training/domain/move_acceptance.js";
import type { MoveAcceptanceContext } from "../../src/training/domain/move_acceptance.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Get the PgnMoveNode at ply `n` (0-based) from a PGN string. */
const nodeAt = (pgn: string, ply: number) => {
  const model = parsePgnToModel(pgn);
  let count = 0;
  for (const entry of model.root.entries) {
    if (entry.type === "move") {
      if (count === ply) return entry;
      count++;
    }
  }
  throw new Error(`No move at ply ${ply}`);
};

/** FEN after replaying the first `ply` moves from a PGN. */
const fenAt = (pgn: string, ply: number): string => {
  const model = parsePgnToModel(pgn);
  const chess = new Chess();
  let count = 0;
  for (const entry of model.root.entries) {
    if (entry.type === "move") {
      if (count === ply) break;
      chess.move(entry.san, { strict: false });
      count++;
    }
  }
  return chess.fen();
};

const makeCtx = (
  overrides: Partial<MoveAcceptanceContext> & {
    pgn: string;
    ply?: number;
    userUci: string;
    userSan: string;
  },
): MoveAcceptanceContext => {
  const ply = overrides.ply ?? 0;
  const pgn = overrides.pgn;
  return {
    userMove: { uci: overrides.userUci, san: overrides.userSan, timestamp: 0 },
    node: nodeAt(pgn, ply),
    positionFen: fenAt(pgn, ply),
    mainlineUci: (() => {
      const chess = new Chess(fenAt(pgn, ply));
      const n = nodeAt(pgn, ply);
      const r = chess.move(n.san, { strict: false });
      return r ? r.from + r.to + (r.promotion ?? "") : "";
    })(),
    inferiorMovePolicy: overrides.inferiorMovePolicy ?? "reject",
    evalAcceptThresholdCp: overrides.evalAcceptThresholdCp ?? 30,
    evalInferiorThresholdCp: overrides.evalInferiorThresholdCp ?? 80,
  };
};

// ── Basic correct/wrong ────────────────────────────────────────────────────────

test("acceptMove — exact mainline match → correct", () => {
  const ctx = makeCtx({
    pgn: "1. e4 e5 *",
    userUci: "e2e4",
    userSan: "e4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "correct");
});

test("acceptMove — wrong move → wrong + correctMove provided", () => {
  const ctx = makeCtx({
    pgn: "1. e4 e5 *",
    userUci: "d2d4",
    userSan: "d4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "wrong");
  assert.ok(result.correctMove !== undefined);
  assert.equal(result.correctMove?.uci, "e2e4");
});

// ── NAG on game move ───────────────────────────────────────────────────────────

test("acceptMove — game move $1 (!) → correct when user matches", () => {
  const ctx = makeCtx({
    pgn: "1. e4 $1 e5 *",
    userUci: "e2e4",
    userSan: "e4",
  });
  assert.equal(acceptMove(ctx).feedback, "correct");
});

test("acceptMove — game move $4 (??) + no better RAV → accepted (canonical = mainline)", () => {
  const ctx = makeCtx({
    pgn: "1. e4 $4 e5 *",
    userUci: "e2e4",
    userSan: "e4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
});

test("acceptMove — game move $4 (??) with better RAV $1 (!) → correct_better when user plays RAV move", () => {
  const ctx = makeCtx({
    pgn: "1. e4 $4 (1. d4 $1 d5) e5 *",
    userUci: "d2d4",
    userSan: "d4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "correct_better");
});

test("acceptMove — game move $4 (??) with better RAV $1 (!) → wrong when user plays game move", () => {
  // Game move is ?? and a better RAV (d4 $1) exists — canonical is d4, so e4 is wrong
  const ctx = makeCtx({
    pgn: "1. e4 $4 (1. d4 $1 d5) e5 *",
    userUci: "e2e4",
    userSan: "e4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "wrong");
  assert.equal(result.correctMove?.uci, "d2d4");
});

test("acceptMove — game move $6 (?!) → correct_dubious when user plays it + betterMoveExists set", () => {
  const ctx = makeCtx({
    pgn: "1. e4 $6 (1. d4 $1 d5) e5 *",
    userUci: "e2e4",
    userSan: "e4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "correct_dubious");
  assert.ok(result.betterMoveExists !== undefined);
  assert.equal(result.betterMoveExists?.uci, "d2d4");
});

// ── RAV alternatives ───────────────────────────────────────────────────────────

test("acceptMove — unannotated RAV → legal_variant", () => {
  const ctx = makeCtx({
    pgn: "1. e4 (1. d4 d5) e5 *",
    userUci: "d2d4",
    userSan: "d4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "legal_variant");
});

test("acceptMove — RAV with ! → legal_variant (accepted alternative)", () => {
  const ctx = makeCtx({
    pgn: "1. e4 (1. d4! d5) e5 *",
    userUci: "d2d4",
    userSan: "d4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "legal_variant");
});

test("acceptMove — RAV with $6 (?!) → inferior (policy=reject) → accepted=false", () => {
  const ctx = makeCtx({
    pgn: "1. e4 (1. f4 $6 e5) e5 *",
    userUci: "f2f4",
    userSan: "f4",
    inferiorMovePolicy: "reject",
  });
  const result = acceptMove(ctx);
  assert.equal(result.feedback, "inferior");
  assert.equal(result.accepted, false);
});

test("acceptMove — RAV with $6 (?!) → inferior (policy=accept) → accepted=true", () => {
  const ctx = makeCtx({
    pgn: "1. e4 (1. f4 $6 e5) e5 *",
    userUci: "f2f4",
    userSan: "f4",
    inferiorMovePolicy: "accept",
  });
  const result = acceptMove(ctx);
  assert.equal(result.feedback, "inferior");
  assert.equal(result.accepted, true);
});

test("acceptMove — RAV with $4 (??) → wrong with annotation from RAV comment", () => {
  const ctx = makeCtx({
    pgn: "1. e4 (1. f4 $4 {The King's Gambit refuted} e5) e5 *",
    userUci: "f2f4",
    userSan: "f4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "wrong");
  assert.ok(result.annotation?.includes("King's Gambit"));
});

// ── [%train] override ─────────────────────────────────────────────────────────

test("acceptMove — [%train accept] overrides RAV classification", () => {
  // g1h3 is not in any RAV, but [%train] explicitly accepts it
  const ctx = makeCtx({
    pgn: '1. {[%train accept="g1h3"]} e4 e5 *',
    userUci: "g1h3",
    userSan: "Nh3",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "correct");
});

test("acceptMove — [%train reject] overrides mainline acceptance", () => {
  const ctx = makeCtx({
    pgn: '1. {[%train reject="e2e4"]} e4 e5 *',
    userUci: "e2e4",
    userSan: "e4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "wrong");
});

test("acceptMove — [%train] move not in accept or reject → wrong", () => {
  const ctx = makeCtx({
    pgn: '1. {[%train accept="d2d4"]} e4 e5 *',
    userUci: "c2c4",
    userSan: "c4",
  });
  const result = acceptMove(ctx);
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "wrong");
});

test("acceptMove — [%train hint] surfaces in annotation on wrong move", () => {
  const ctx = makeCtx({
    pgn: '1. {[%train accept="d2d4" hint="Control the center with a pawn"]} e4 e5 *',
    userUci: "c2c4",
    userSan: "c4",
  });
  const result = acceptMove(ctx);
  assert.ok(result.annotation?.includes("Control the center"));
});
