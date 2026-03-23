import test from "node:test";
import assert from "node:assert/strict";
import {
  MILLENNIUM_CHESSLINK_V1,
  DGT_USB_V3,
  BUILT_IN_PROFILES,
  findProfile,
} from "../../../boards/domain/board_profile.js";

// ── Built-in profiles ──────────────────────────────────────────────────────────

test("MILLENNIUM_CHESSLINK_V1 — family is millennium", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.family, "millennium");
});

test("MILLENNIUM_CHESSLINK_V1 — baud rate is 38400", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.baudRate, 38400);
});

test("MILLENNIUM_CHESSLINK_V1 — has BLE UUIDs", () => {
  assert.ok(MILLENNIUM_CHESSLINK_V1.bleServiceUuid !== undefined);
  assert.ok(MILLENNIUM_CHESSLINK_V1.bleTxCharUuid !== undefined);
  assert.ok(MILLENNIUM_CHESSLINK_V1.bleRxCharUuid !== undefined);
});

test("MILLENNIUM_CHESSLINK_V1 — square map has 64 entries", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.squareMap.length, 64);
});

test("MILLENNIUM_CHESSLINK_V1 — square map maps a1 (raw 7) to index 7", () => {
  // From the plan: Within each rank, h-file is byte 0 and a-file is byte 7.
  // So byte 7 → rank 0, file 7 → internal square = 0*8 + (7-7) = 0 (a1).
  assert.equal(MILLENNIUM_CHESSLINK_V1.squareMap[7], 0); // a1 is byte 7 → square 0
});

test("MILLENNIUM_CHESSLINK_V1 — square map maps h1 (raw 0) to index 7", () => {
  // byte 0 → rank 0, file 7-0=7 → square 7 (h1)
  assert.equal(MILLENNIUM_CHESSLINK_V1.squareMap[0], 7); // h1 is byte 0 → square 7
});

test("MILLENNIUM_CHESSLINK_V1 — piece encoding has 13 entries (0–12)", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.pieceEncoding.length, 13);
});

test("MILLENNIUM_CHESSLINK_V1 — empty = 0, white pawn = 1", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.pieceEncoding[0], 0); // empty
  assert.equal(MILLENNIUM_CHESSLINK_V1.pieceEncoding[1], 1); // white pawn
});

test("MILLENNIUM_CHESSLINK_V1 — uses odd parity framing", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.framing.useOddParity, true);
});

test("MILLENNIUM_CHESSLINK_V1 — supports LEDs", () => {
  assert.equal(MILLENNIUM_CHESSLINK_V1.supportsLeds, true);
});

test("DGT_USB_V3 — family is dgt", () => {
  assert.equal(DGT_USB_V3.family, "dgt");
});

test("DGT_USB_V3 — baud rate is 9600", () => {
  assert.equal(DGT_USB_V3.baudRate, 9600);
});

test("DGT_USB_V3 — identity square map (DGT native ordering)", () => {
  for (let i = 0; i < 64; i++) {
    assert.equal(DGT_USB_V3.squareMap[i], i);
  }
});

test("DGT_USB_V3 — no odd parity framing", () => {
  assert.equal(DGT_USB_V3.framing.useOddParity, false);
});

test("DGT_USB_V3 — delta message length is 5", () => {
  assert.equal(DGT_USB_V3.framing.deltaMessageLength, 5);
});

// ── BUILT_IN_PROFILES ─────────────────────────────────────────────────────────

test("BUILT_IN_PROFILES — contains both built-in profiles", () => {
  assert.ok(BUILT_IN_PROFILES.includes(MILLENNIUM_CHESSLINK_V1));
  assert.ok(BUILT_IN_PROFILES.includes(DGT_USB_V3));
});

// ── findProfile ───────────────────────────────────────────────────────────────

test("findProfile — returns Millennium profile for millennium family", () => {
  const p = findProfile("millennium", "unknown");
  assert.ok(p !== null);
  assert.equal(p.family, "millennium");
});

test("findProfile — returns DGT profile for dgt family", () => {
  const p = findProfile("dgt", "3.x");
  assert.ok(p !== null);
  assert.equal(p.family, "dgt");
});

test("findProfile — returns null for unknown family", () => {
  const p = findProfile("simulator", "1.0");
  assert.equal(p, null);
});

test("findProfile — exact firmware version match is preferred", () => {
  const p = findProfile("dgt", "3.x");
  assert.ok(p !== null);
  assert.equal(p.firmwareVersion, "3.x");
});
