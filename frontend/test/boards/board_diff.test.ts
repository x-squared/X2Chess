import test from "node:test";
import assert from "node:assert/strict";
import { boardDiff, computeSyncSignal, computeMoveSignal } from "../../../boards/protocol/board_diff.js";
import type { BoardState, PieceCode } from "../../../boards/domain/board_types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

/** Build a board state (64 squares) with specified pieces. */
const makeBoard = (pieces: Record<number, PieceCode> = {}): BoardState => {
  const board = new Array<PieceCode>(64).fill(0) as PieceCode[];
  for (const [sq, piece] of Object.entries(pieces)) {
    board[Number(sq)] = piece;
  }
  return board;
};

// Standard starting position (simplified: just kings and a few pieces)
const EMPTY_BOARD = makeBoard();

// ── boardDiff — normal moves ───────────────────────────────────────────────────

test("boardDiff — returns null for identical boards", () => {
  const board = makeBoard({ 4: 5 }); // white king on e1 (index 4)
  assert.equal(boardDiff(board, board), null);
});

test("boardDiff — detects a simple pawn move (e2 to e4)", () => {
  // e2 = index 12, e4 = index 28 in a1=0 file-major encoding
  const before = makeBoard({ 12: 1 }); // white pawn on e2
  const after = makeBoard({ 28: 1 });  // white pawn on e4
  const result = boardDiff(before, after);
  assert.ok(result !== null);
  assert.equal(result.from, 12);
  assert.equal(result.to, 28);
  assert.equal(result.capturedPiece, undefined);
});

test("boardDiff — detects a capture", () => {
  // Rook on e1 captures bishop on e8
  const before = makeBoard({ 4: 2, 60: 4 }); // white rook on e1, black bishop on e8
  const after = makeBoard({ 60: 2 });          // white rook on e8
  const result = boardDiff(before, after);
  assert.ok(result !== null);
  assert.equal(result.from, 4);
  assert.equal(result.to, 60);
  assert.equal(result.capturedPiece, 4); // black bishop
});

// ── boardDiff — promotion ──────────────────────────────────────────────────────

test("boardDiff — detects promotion (white pawn to rank 8)", () => {
  // White pawn on a7 (index 48) moves to a8 (index 56)
  const before = makeBoard({ 48: 1 });  // white pawn
  const after = makeBoard({ 56: 1 });   // still shows as pawn (board just detects arrival)
  const result = boardDiff(before, after);
  assert.ok(result !== null);
  assert.equal(result.from, 48);
  assert.equal(result.to, 56);
  assert.equal(result.promotionRequired, true);
});

test("boardDiff — black pawn promotion (to rank 1)", () => {
  // Black pawn on a2 (index 8) moves to a1 (index 0)
  const before = makeBoard({ 8: 7 });  // black pawn
  const after = makeBoard({ 0: 7 });
  const result = boardDiff(before, after);
  assert.ok(result !== null);
  assert.equal(result.promotionRequired, true);
});

// ── boardDiff — castling ───────────────────────────────────────────────────────

test("boardDiff — detects kingside castling", () => {
  // White: king on e1 (index 4), rook on h1 (index 7)
  // After: king on g1 (index 6), rook on f1 (index 5)
  const before = makeBoard({ 4: 5, 7: 2 });
  const after = makeBoard({ 6: 5, 5: 2 });
  const result = boardDiff(before, after);
  assert.ok(result !== null);
  // King's from/to
  assert.equal(result.from, 4);
  assert.equal(result.to, 6);
});

// ── boardDiff — en passant ────────────────────────────────────────────────────

test("boardDiff — detects en passant capture", () => {
  // White pawn on e5 (index 36) captures black pawn on d5 (index 35)
  // via en passant: white pawn moves to d6 (index 43)
  const before = makeBoard({ 36: 1, 35: 7 }); // white pawn e5, black pawn d5
  const after = makeBoard({ 43: 1 });           // white pawn on d6, d5 now empty
  const result = boardDiff(before, after);
  assert.ok(result !== null);
  assert.equal(result.from, 36);
  assert.equal(result.to, 43);
  assert.equal(result.capturedPiece, 7); // black pawn
});

// ── boardDiff — invalid inputs ────────────────────────────────────────────────

test("boardDiff — returns null for short board array", () => {
  assert.equal(boardDiff(new Array(32).fill(0) as PieceCode[], EMPTY_BOARD), null);
});

test("boardDiff — returns null for ambiguous state (3+ squares changed)", () => {
  // Multiple pieces moved simultaneously — ambiguous
  const before = makeBoard({ 0: 1, 1: 2, 2: 3 });
  const after = makeBoard({ 10: 1, 11: 2, 12: 3 });
  const result = boardDiff(before, after);
  assert.equal(result, null);
});

// ── computeSyncSignal ──────────────────────────────────────────────────────────

test("computeSyncSignal — off when boards match", () => {
  const signal = computeSyncSignal(EMPTY_BOARD, EMPTY_BOARD);
  assert.equal(signal.kind, "off");
});

test("computeSyncSignal — static signal with differing squares", () => {
  const app = makeBoard({ 4: 5 });      // king on e1
  const physical = makeBoard({ 5: 5 }); // king on f1
  const signal = computeSyncSignal(app, physical);
  assert.equal(signal.kind, "static");
  if (signal.kind === "static") {
    // Squares 4 and 5 differ
    assert.equal(signal.leds.length, 2);
  }
});

// ── computeMoveSignal ─────────────────────────────────────────────────────────

test("computeMoveSignal — returns static signal with from and to leds", () => {
  const signal = computeMoveSignal(4, 12);
  assert.equal(signal.kind, "static");
  if (signal.kind === "static") {
    assert.equal(signal.leds.length, 2);
    const from = signal.leds.find((l) => l.square === 4);
    const to = signal.leds.find((l) => l.square === 12);
    assert.ok(from !== undefined);
    assert.ok(to !== undefined);
    assert.equal(from.color, "orange");
    assert.equal(to.color, "red");
  }
});
