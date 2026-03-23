/**
 * dgt_protocol — DGT board binary encode/decode.
 *
 * Integration API:
 * - `decodeBoardState(raw, profile)` — parse a 64-byte board dump.
 * - `decodeFieldUpdate(raw, profile)` — parse a 5-byte delta event.
 * - `encodeRequestFullScan(profile)` — build the "request board" command.
 * - `encodeEnableUpdateMode(profile)` — build the "enable update" command.
 *
 * Configuration API:
 * - All functions accept a `BoardProfile` and are purely profile-driven.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

import type { BoardProfile } from "../domain/board_profile";
import type { BoardState, PieceCode, SquareId } from "../domain/board_types";

// ── Decode helpers ────────────────────────────────────────────────────────────

const rawToPieceCode = (raw: number, profile: BoardProfile): PieceCode =>
  (profile.pieceEncoding[raw] ?? 0) as PieceCode;

const rawToSquare = (rawIndex: number, profile: BoardProfile): SquareId =>
  profile.squareMap[rawIndex] ?? rawIndex;

// ── Decode: full board state ──────────────────────────────────────────────────

/**
 * Parse a 64-byte DGT board dump into an internal BoardState.
 * DGT native ordering: a1=byte 0, b1=byte 1, …, h1=byte 7, a2=byte 8, …, h8=byte 63.
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

// ── Decode: field update ──────────────────────────────────────────────────────

export type DgtFieldUpdate = {
  square: SquareId;
  piece: PieceCode;
};

/**
 * Parse a 5-byte DGT field update message:
 *   [0x8E, 0x05, 0x00, raw_square, raw_piece_code]
 *
 * Returns `null` if the message does not match the expected format.
 */
export const decodeFieldUpdate = (
  raw: Uint8Array,
  profile: BoardProfile,
): DgtFieldUpdate | null => {
  if (raw.length < profile.framing.deltaMessageLength) return null;
  if (raw[0] !== 0x8E || raw[1] !== 0x05) return null;

  const square = rawToSquare(raw[3]!, profile);
  const piece = rawToPieceCode(raw[4]!, profile);
  return { square, piece };
};

// ── Encode: host → board commands ─────────────────────────────────────────────

/**
 * Build the DGT_SEND_BRD command (request full 64-byte board dump).
 */
export const encodeRequestFullScan = (profile: BoardProfile): Uint8Array =>
  new Uint8Array([profile.cmd.requestFullScan]);

/**
 * Build the DGT_SEND_UPDATE command (enable field update mode).
 */
export const encodeEnableUpdateMode = (profile: BoardProfile): Uint8Array =>
  new Uint8Array([profile.cmd.enableUpdateMode]);
