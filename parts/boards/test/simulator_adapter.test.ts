import test from "node:test";
import assert from "node:assert/strict";
import {
  createBoardSimulator,
  parseFenPlacement,
} from "../src/adapters/simulator_adapter.js";

// ── parseFenPlacement ─────────────────────────────────────────────────────────

test("parseFenPlacement — returns null for invalid FEN", () => {
  assert.equal(parseFenPlacement("not-a-fen"), null);
});

test("parseFenPlacement — empty board FEN decodes to all zeros", () => {
  const board = parseFenPlacement("8/8/8/8/8/8/8/8 w - - 0 1");
  assert.ok(board !== null);
  assert.ok(board.every((p) => p === 0));
});

test("parseFenPlacement — white king on e1 (index 4)", () => {
  // Starting position: e1 = rank 1, file e = index 4
  const board = parseFenPlacement("8/8/8/8/8/8/8/4K3 w - - 0 1");
  assert.ok(board !== null);
  assert.equal(board[4], 5); // white king
});

test("parseFenPlacement — white pawn on a2 (index 8)", () => {
  // a2 = rank 2, file a = index 8
  const board = parseFenPlacement("8/8/8/8/8/8/P7/8 w - - 0 1");
  assert.ok(board !== null);
  assert.equal(board[8], 1); // white pawn
});

test("parseFenPlacement — black king on e8 (index 60)", () => {
  // e8 = rank 8, file e = index 60
  const board = parseFenPlacement("4k3/8/8/8/8/8/8/8 w - - 0 1");
  assert.ok(board !== null);
  assert.equal(board[60], 11); // black king
});

test("parseFenPlacement — full starting position", () => {
  const board = parseFenPlacement(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  assert.ok(board !== null);
  // White pieces on rank 1 (indices 0-7): R N B Q K B N R
  assert.equal(board[0], 2);  // white rook a1
  assert.equal(board[3], 6);  // white queen d1
  assert.equal(board[4], 5);  // white king e1
  assert.equal(board[7], 2);  // white rook h1
  // White pawns on rank 2 (indices 8-15)
  for (let i = 8; i < 16; i++) assert.equal(board[i], 1);
  // Black pawns on rank 7 (indices 48-55)
  for (let i = 48; i < 56; i++) assert.equal(board[i], 7);
  // Black pieces on rank 8 (indices 56-63)
  assert.equal(board[56], 8);  // black rook a8
  assert.equal(board[59], 12); // black queen d8
  assert.equal(board[60], 11); // black king e8
});

// ── createBoardSimulator ──────────────────────────────────────────────────────

test("createBoardSimulator — boardType is 'simulator'", () => {
  const sim = createBoardSimulator();
  assert.equal(sim.boardType, "simulator");
});

test("createBoardSimulator — default portOrAddress is 'simulator'", () => {
  const sim = createBoardSimulator();
  assert.equal(sim.portOrAddress, "simulator");
});

test("createBoardSimulator — custom portOrAddress is preserved", () => {
  const sim = createBoardSimulator("sim-1");
  assert.equal(sim.portOrAddress, "sim-1");
});

test("getBoardState — initial state is all zeros", async () => {
  const sim = createBoardSimulator();
  const state = await sim.getBoardState();
  assert.equal(state.length, 64);
  assert.ok(state.every((p) => p === 0));
});

// ── setPositionFromFen ────────────────────────────────────────────────────────

test("setPositionFromFen — sets board state from FEN", async () => {
  const sim = createBoardSimulator();
  sim.setPositionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  const state = await sim.getBoardState();
  assert.equal(state[4], 5);  // white king e1
  assert.equal(state[60], 11); // black king e8
});

test("setPositionFromFen — throws on invalid FEN", () => {
  const sim = createBoardSimulator();
  assert.throws(() => sim.setPositionFromFen("bad/fen"), /Invalid FEN/);
});

test("setPositionFromFen — fires onStateChange subscribers", () => {
  const sim = createBoardSimulator();
  const states: number[] = [];
  sim.onStateChange((state) => states.push(state[4]!));
  sim.setPositionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(states.length, 1);
  assert.equal(states[0], 5); // white king e1
});

// ── simulateMove ──────────────────────────────────────────────────────────────

test("simulateMove — moves piece from one square to another", async () => {
  const sim = createBoardSimulator();
  sim.setPositionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  sim.simulateMove(4, 5); // white king e1 → f1
  const state = await sim.getBoardState();
  assert.equal(state[4], 0); // e1 now empty
  assert.equal(state[5], 5); // f1 has white king
});

test("simulateMove — fires onStateChange", () => {
  const sim = createBoardSimulator();
  sim.setPositionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  let callCount = 0;
  sim.onStateChange(() => callCount++);
  sim.simulateMove(4, 5);
  assert.equal(callCount, 1);
});

test("simulateMove — throws on out-of-range square", () => {
  const sim = createBoardSimulator();
  assert.throws(() => sim.simulateMove(0, 64), /out of range/);
  assert.throws(() => sim.simulateMove(-1, 0), /out of range/);
});

// ── onStateChange / unsubscribe ───────────────────────────────────────────────

test("onStateChange — multiple subscribers all receive updates", () => {
  const sim = createBoardSimulator();
  let a = 0, b = 0;
  sim.onStateChange(() => a++);
  sim.onStateChange(() => b++);
  sim.setPositionFromFen("8/8/8/8/8/8/8/8 w - - 0 1");
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test("onStateChange — unsubscribe stops receiving updates", () => {
  const sim = createBoardSimulator();
  let count = 0;
  const unsub = sim.onStateChange(() => count++);
  sim.setPositionFromFen("8/8/8/8/8/8/8/8 w - - 0 1");
  assert.equal(count, 1);
  unsub();
  sim.simulateMove(0, 1);
  assert.equal(count, 1); // no new call
});

// ── sendSignal / getLeds ──────────────────────────────────────────────────────

test("getLeds — initially empty", () => {
  const sim = createBoardSimulator();
  assert.equal(sim.getLeds().length, 0);
});

test("sendSignal — static signal updates getLeds", async () => {
  const sim = createBoardSimulator();
  await sim.sendSignal({
    kind: "static",
    leds: [{ square: 4, color: "orange" }, { square: 12, color: "red" }],
  });
  const leds = sim.getLeds();
  assert.equal(leds.length, 2);
  assert.equal(leds.find((l) => l.square === 4)?.color, "orange");
  assert.equal(leds.find((l) => l.square === 12)?.color, "red");
});

test("sendSignal — off clears LEDs", async () => {
  const sim = createBoardSimulator();
  await sim.sendSignal({ kind: "static", leds: [{ square: 4 }] });
  await sim.sendSignal({ kind: "off" });
  assert.equal(sim.getLeds().length, 0);
});

test("sendSignal — sequence uses first frame LEDs", async () => {
  const sim = createBoardSimulator();
  await sim.sendSignal({
    kind: "sequence",
    frames: [
      { leds: [{ square: 10, color: "white" }], durationMs: 300 },
      { leds: [{ square: 20, color: "red" }], durationMs: 300 },
    ],
  });
  const leds = sim.getLeds();
  assert.equal(leds.length, 1);
  assert.equal(leds[0]!.square, 10);
});

// ── disconnect ────────────────────────────────────────────────────────────────

test("disconnect — stops onStateChange from firing", async () => {
  const sim = createBoardSimulator();
  let count = 0;
  sim.onStateChange(() => count++);
  await sim.disconnect();
  sim.simulateMove(0, 1);
  assert.equal(count, 0);
});

test("disconnect — clears LEDs", async () => {
  const sim = createBoardSimulator();
  await sim.sendSignal({ kind: "static", leds: [{ square: 4 }] });
  await sim.disconnect();
  assert.equal(sim.getLeds().length, 0);
});
