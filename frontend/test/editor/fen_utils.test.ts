import test from "node:test";
import assert from "node:assert/strict";
import {
  STANDARD_STARTING_FEN,
  validateFenStructure,
  validateKings,
} from "../../src/editor/fen_utils.js";

// ── STANDARD_STARTING_FEN ──────────────────────────────────────────────────────

test("STANDARD_STARTING_FEN — is a valid FEN", () => {
  const result = validateFenStructure(STANDARD_STARTING_FEN);
  assert.equal(result.valid, true);
});

// ── validateFenStructure — valid cases ─────────────────────────────────────────

test("validateFenStructure — starting position is valid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(r.valid, true);
});

test("validateFenStructure — position after 1. e4 is valid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  assert.equal(r.valid, true);
});

test("validateFenStructure — accepts 4-field FEN (no counters)", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -");
  assert.equal(r.valid, true);
});

test("validateFenStructure — accepts black to move", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  assert.equal(r.valid, true);
});

test("validateFenStructure — accepts no castling rights", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1");
  assert.equal(r.valid, true);
});

// ── validateFenStructure — invalid cases ──────────────────────────────────────

test("validateFenStructure — empty string is invalid", () => {
  const r = validateFenStructure("");
  assert.equal(r.valid, false);
});

test("validateFenStructure — wrong number of ranks is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(r.valid, false);
  assert.ok(!r.valid && r.error.includes("8 ranks"));
});

test("validateFenStructure — rank that doesn't sum to 8 is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/4P4/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(r.valid, false);
  assert.ok(!r.valid && r.error.includes("does not sum to 8"));
});

test("validateFenStructure — invalid piece character is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/4X3/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(r.valid, false);
  assert.ok(!r.valid && r.error.includes("Invalid character"));
});

test("validateFenStructure — invalid side to move is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1");
  assert.equal(r.valid, false);
  assert.ok(!r.valid && r.error.includes("Side to move"));
});

test("validateFenStructure — invalid castling field is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQKQK - 0 1");
  assert.equal(r.valid, false);
  assert.ok(!r.valid && r.error.includes("castling"));
});

test("validateFenStructure — invalid en passant square is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e5 0 1");
  assert.equal(r.valid, false);
  assert.ok(!r.valid && r.error.includes("en passant"));
});

test("validateFenStructure — too many fields is invalid", () => {
  const r = validateFenStructure("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 extra");
  assert.equal(r.valid, false);
});

// ── validateKings ─────────────────────────────────────────────────────────────

test("validateKings — starting position has both kings: no error", () => {
  assert.equal(validateKings(STANDARD_STARTING_FEN), null);
});

test("validateKings — missing white king returns error", () => {
  const noWhiteKing = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".replace("K", "R");
  const result = validateKings(noWhiteKing);
  assert.ok(typeof result === "string");
  assert.ok(result.includes("White king"));
});

test("validateKings — missing black king returns error", () => {
  const noBlackKing = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".replace("k", "b");
  const result = validateKings(noBlackKing);
  assert.ok(typeof result === "string");
  assert.ok(result.includes("Black king"));
});
