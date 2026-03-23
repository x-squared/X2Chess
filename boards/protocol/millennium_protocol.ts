/**
 * millennium_protocol — Millennium ChessLink binary encode/decode.
 *
 * Integration API:
 * - `decodeBoardState(raw, profile)` — parse a 64-byte board dump.
 * - `decodeDelta(raw, profile)` — parse a 3-byte delta event.
 * - `encodeRequestFullScan(profile)` — build the "request full scan" command.
 * - `encodeEnableUpdateMode(profile)` — build the "enable update mode" command.
 * - `encodeLedCommand(squares, profile)` — build a LED command payload.
 *
 * Configuration API:
 * - All functions accept a `BoardProfile` and are purely profile-driven.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

import type { BoardProfile } from "../domain/board_profile";
import type { BoardState, PieceCode, SquareId } from "../domain/board_types";

// ── Parity helper ─────────────────────────────────────────────────────────────

/**
 * Apply odd parity to a byte: set bit 7 so the total number of 1-bits is odd.
 * Used by Millennium's serial framing.
 */
const withOddParity = (byte: number): number => {
  let b = byte & 0x7F; // strip existing parity bit
  let count = 0;
  let n = b;
  while (n) { count += n & 1; n >>= 1; }
  // odd parity: set bit 7 if current bit count is already odd (to make total even → flip)
  // actually: set bit 7 so that total 1-count including bit 7 is odd.
  return (count % 2 === 0) ? (b | 0x80) : b;
};

const applyParity = (bytes: Uint8Array, useOddParity: boolean): Uint8Array => {
  if (!useOddParity) return bytes;
  return bytes.map(withOddParity);
};

// ── Decode helpers ────────────────────────────────────────────────────────────

/**
 * Map a raw board byte to its PieceCode using the profile's piece encoding.
 * Unknown bytes map to 0 (empty).
 */
const rawToPieceCode = (raw: number, profile: BoardProfile): PieceCode => {
  const clean = raw & 0x7F; // strip parity bit if present
  return (profile.pieceEncoding[clean] ?? 0) as PieceCode;
};

/**
 * Map a raw byte index to an internal square index (a1=0 … h8=63) using
 * the profile's squareMap.
 */
const rawToSquare = (rawIndex: number, profile: BoardProfile): SquareId =>
  profile.squareMap[rawIndex] ?? rawIndex;

// ── Decode: full board state ──────────────────────────────────────────────────

/**
 * Parse a 64-byte full board dump into an internal BoardState.
 * The raw bytes are in the board's native square ordering (see squareMap).
 */
export const decodeBoardState = (
  raw: Uint8Array,
  profile: BoardProfile,
): BoardState | null => {
  if (raw.length < 64) return null;
  const state: PieceCode[] = new Array<PieceCode>(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const sq = rawToSquare(i, profile);
    state[sq] = rawToPieceCode(raw[i]!, profile);
  }
  return state;
};

// ── Decode: delta event ───────────────────────────────────────────────────────

export type MillenniumDelta = {
  square: SquareId;
  piece: PieceCode;
};

/**
 * Parse a 3-byte Millennium delta message:
 *   [0xE1, raw_square, raw_piece_code]
 *
 * Returns `null` if the message does not match the expected format.
 */
export const decodeDelta = (
  raw: Uint8Array,
  profile: BoardProfile,
): MillenniumDelta | null => {
  if (raw.length < profile.framing.deltaMessageLength) return null;
  // Strip parity from first byte before checking the marker.
  const marker = raw[0]! & 0x7F;
  if (marker !== 0x61) return null; // 0xE1 with parity stripped = 0x61

  const square = rawToSquare(raw[1]! & 0x7F, profile);
  const piece = rawToPieceCode(raw[2]!, profile);
  return { square, piece };
};

// ── Encode: host → board commands ─────────────────────────────────────────────

/**
 * Build the "request full board scan" command bytes.
 */
export const encodeRequestFullScan = (profile: BoardProfile): Uint8Array => {
  const raw = new Uint8Array([profile.cmd.requestFullScan, 0x00]);
  return applyParity(raw, profile.framing.useOddParity);
};

/**
 * Build the "enable update mode" command bytes.
 * Millennium uses [0x44, 0x01] to activate delta streaming.
 */
export const encodeEnableUpdateMode = (profile: BoardProfile): Uint8Array => {
  const raw = new Uint8Array([profile.cmd.enableUpdateMode, 0x01]);
  return applyParity(raw, profile.framing.useOddParity);
};

/**
 * Build a LED command for the given internal square indices.
 * Millennium uses a bitmask per rank (8 bytes × 8 bits = 64 squares).
 * Squares are encoded in the board's native byte ordering (squareMap inverse).
 */
export const encodeLedCommand = (
  squares: readonly SquareId[],
  profile: BoardProfile,
): Uint8Array => {
  // Build inverse squareMap: internal index → raw byte index
  const inverse = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const sq = profile.squareMap[i] ?? i;
    inverse[sq] = i;
  }

  // Build an 8-byte bitmask (one bit per square, per rank)
  const mask = new Uint8Array(8);
  for (const sq of squares) {
    const raw = inverse[sq] ?? sq;
    const rank = Math.floor(raw / 8);
    const bit = raw % 8;
    mask[rank] = (mask[rank]! | (1 << bit)) & 0xFF;
  }

  const cmd = new Uint8Array([profile.cmd.setLeds, ...mask]);
  return applyParity(cmd, profile.framing.useOddParity);
};
