import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBoardState,
  decodeFieldUpdate,
  encodeRequestFullScan,
  encodeEnableUpdateMode,
} from "../src/protocol/dgt_protocol.js";
import { DGT_USB_V3 } from "../src/domain/board_profile.js";

const PROFILE = DGT_USB_V3;

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

test("decodeBoardState — DGT identity ordering: byte 0 = a1", () => {
  // DGT: byte 0 = a1 (square 0)
  const raw = new Uint8Array(64).fill(0);
  raw[0] = 0x05; // white king on a1
  const state = decodeBoardState(raw, PROFILE);
  assert.ok(state !== null);
  assert.equal(state[0], 5); // a1 = square 0 = white king
});

test("decodeBoardState — byte 7 = h1 (square 7)", () => {
  const raw = new Uint8Array(64).fill(0);
  raw[7] = 0x02; // white rook on h1
  const state = decodeBoardState(raw, PROFILE);
  assert.ok(state !== null);
  assert.equal(state[7], 2); // h1 = square 7
});

test("decodeBoardState — full starting rank 1 in standard encoding", () => {
  const raw = new Uint8Array(64).fill(0);
  // a1=rook, b1=knight, c1=bishop, d1=queen, e1=king, f1=bishop, g1=knight, h1=rook
  const rank1 = [2, 3, 4, 6, 5, 4, 3, 2];
  for (let i = 0; i < 8; i++) raw[i] = rank1[i]!;
  const state = decodeBoardState(raw, PROFILE);
  assert.ok(state !== null);
  assert.deepEqual(Array.from(state.slice(0, 8)), rank1);
});

// ── decodeFieldUpdate ─────────────────────────────────────────────────────────

test("decodeFieldUpdate — returns null for short buffer", () => {
  assert.equal(decodeFieldUpdate(new Uint8Array([0x8E, 0x05]), PROFILE), null);
});

test("decodeFieldUpdate — returns null for wrong header bytes", () => {
  const msg = new Uint8Array([0x8F, 0x05, 0x00, 0x04, 0x05]);
  assert.equal(decodeFieldUpdate(msg, PROFILE), null);
});

test("decodeFieldUpdate — decodes valid field update", () => {
  // [0x8E, 0x05, 0x00, square=4, piece=5(white king)]
  const msg = new Uint8Array([0x8E, 0x05, 0x00, 0x04, 0x05]);
  const update = decodeFieldUpdate(msg, PROFILE);
  assert.ok(update !== null);
  assert.equal(update.square, 4);  // DGT identity: byte 4 → square 4 (e1)
  assert.equal(update.piece, 5);   // white king
});

test("decodeFieldUpdate — piece cleared (0x00 = empty)", () => {
  const msg = new Uint8Array([0x8E, 0x05, 0x00, 0x04, 0x00]);
  const update = decodeFieldUpdate(msg, PROFILE);
  assert.ok(update !== null);
  assert.equal(update.piece, 0); // empty
});

// ── encode commands ────────────────────────────────────────────────────────────

test("encodeRequestFullScan — returns single-byte command 0x42", () => {
  const cmd = encodeRequestFullScan(PROFILE);
  assert.equal(cmd.length, 1);
  assert.equal(cmd[0], 0x42); // DGT_SEND_BRD
});

test("encodeEnableUpdateMode — returns single-byte command 0x43", () => {
  const cmd = encodeEnableUpdateMode(PROFILE);
  assert.equal(cmd.length, 1);
  assert.equal(cmd[0], 0x43); // DGT_SEND_UPDATE
});
