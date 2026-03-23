import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBoardState,
  decodeDelta,
  encodeRequestFullScan,
  encodeEnableUpdateMode,
} from "../../../boards/protocol/millennium_protocol.js";
import { MILLENNIUM_CHESSLINK_V1 } from "../../../boards/domain/board_profile.js";

const PROFILE = MILLENNIUM_CHESSLINK_V1;

// ── decodeBoardState ───────────────────────────────────────────────────────────

test("decodeBoardState — returns null for short buffer", () => {
  assert.equal(decodeBoardState(new Uint8Array(32), PROFILE), null);
});

test("decodeBoardState — empty board decodes to all zeros", () => {
  const raw = new Uint8Array(64).fill(0);
  const state = decodeBoardState(raw, PROFILE);
  assert.ok(state !== null);
  assert.ok(state.every((p) => p === 0));
});

test("decodeBoardState — white pawn on a1 (raw byte 7 = 0x01)", () => {
  // a1 is raw byte index 7 in Millennium ordering.
  const raw = new Uint8Array(64).fill(0);
  raw[7] = 0x01; // white pawn
  const state = decodeBoardState(raw, PROFILE);
  assert.ok(state !== null);
  // Internal square a1 = 0
  assert.equal(state[0], 1); // white pawn
});

test("decodeBoardState — starting position white rook on a1 and h1", () => {
  // In Millennium byte ordering: a1 = byte 7, h1 = byte 0
  const raw = new Uint8Array(64).fill(0);
  raw[7] = 0x02; // white rook on a1
  raw[0] = 0x02; // white rook on h1
  const state = decodeBoardState(raw, PROFILE);
  assert.ok(state !== null);
  assert.equal(state[0], 2); // a1 = square 0
  assert.equal(state[7], 2); // h1 = square 7
});

// ── decodeDelta ────────────────────────────────────────────────────────────────

test("decodeDelta — returns null for short buffer", () => {
  assert.equal(decodeDelta(new Uint8Array([0x61]), PROFILE), null);
});

test("decodeDelta — returns null for wrong marker byte", () => {
  const msg = new Uint8Array([0x44, 0x07, 0x01]);
  assert.equal(decodeDelta(msg, PROFILE), null);
});

test("decodeDelta — decodes valid delta message", () => {
  // Marker 0x61 (0xE1 with parity stripped), raw square 7 (a1), piece 1 (white pawn)
  const msg = new Uint8Array([0x61, 0x07, 0x01]);
  const delta = decodeDelta(msg, PROFILE);
  assert.ok(delta !== null);
  assert.equal(delta.square, 0);   // a1 = internal square 0
  assert.equal(delta.piece, 1);     // white pawn
});

// ── encodeRequestFullScan ──────────────────────────────────────────────────────

test("encodeRequestFullScan — returns a 2-byte command", () => {
  const cmd = encodeRequestFullScan(PROFILE);
  assert.equal(cmd.length, 2);
});

test("encodeRequestFullScan — first byte contains the request command", () => {
  const cmd = encodeRequestFullScan(PROFILE);
  // With odd parity applied, bit 7 may be set
  assert.equal(cmd[0]! & 0x7F, PROFILE.cmd.requestFullScan & 0x7F);
});

// ── encodeEnableUpdateMode ─────────────────────────────────────────────────────

test("encodeEnableUpdateMode — returns a 2-byte command", () => {
  const cmd = encodeEnableUpdateMode(PROFILE);
  assert.equal(cmd.length, 2);
});

test("encodeEnableUpdateMode — second byte is 0x01 (enable param)", () => {
  const cmd = encodeEnableUpdateMode(PROFILE);
  assert.equal(cmd[1]! & 0x7F, 0x01);
});
