/**
 * board_profile — BoardProfile type and built-in profile registry.
 *
 * Integration API:
 * - `BoardProfile` — protocol configuration for a specific board/firmware.
 * - `BUILT_IN_PROFILES` — registry of known profiles.
 * - `MILLENNIUM_CHESSLINK_V1`, `DGT_USB_V3` — individual profile constants.
 *
 * Configuration API:
 * - User-calibrated profiles are merged at startup, overriding defaults when
 *   the firmware version matches.
 *
 * Communication API:
 * - Pure data; no I/O.
 */

import type { LedSignal, BoardSignalKind } from "./board_types";

// ── BoardProfile type ─────────────────────────────────────────────────────────

export type BoardProfile = {
  /** Human-readable label for the connect panel and diagnostics UI. */
  readonly label: string;

  /** Board family — selects which adapter and protocol module to use. */
  readonly family: "millennium" | "dgt" | "simulator";

  /** Firmware version string as reported by the board, or "unknown". */
  readonly firmwareVersion: string;

  // ── Transport ─────────────────────────────────────────────────────────────
  readonly baudRate: number;
  readonly bleServiceUuid?: string;
  readonly bleTxCharUuid?: string;
  readonly bleRxCharUuid?: string;

  // ── Command bytes (host → board) ──────────────────────────────────────────
  readonly cmd: {
    requestFullScan: number;
    enableUpdateMode: number;
    requestFirmware: number;
    setLeds: number;
    allLedsOff: Uint8Array;
  };

  // ── Message framing ───────────────────────────────────────────────────────
  readonly framing: {
    useOddParity: boolean;
    useCrc: boolean;
    deltaMessageLength: number;
  };

  // ── Piece encoding: raw byte → PieceCode ──────────────────────────────────
  /** Index = raw byte from board; value = internal PieceCode (0 = empty). */
  readonly pieceEncoding: readonly number[];

  // ── Square byte ordering ──────────────────────────────────────────────────
  /** Maps raw byte index (0–63) → internal square index (a1=0…h8=63). */
  readonly squareMap: readonly number[];

  // ── LED support ───────────────────────────────────────────────────────────
  readonly supportsLeds: boolean;
  readonly signalOverrides?: Partial<Record<BoardSignalKind, LedSignal>>;
};

// ── Square map helpers ────────────────────────────────────────────────────────

/**
 * Build the identity square map (DGT-style: byte 0 = a1, byte 63 = h8).
 * a1=0, b1=1, …, h1=7, a2=8, …, h8=63 (file-major).
 */
const dgtSquareMap = (): readonly number[] =>
  Array.from({ length: 64 }, (_, i) => i);

/**
 * Build the Millennium square map (reverse-engineered from python-mchess).
 *
 * Within each rank the h-file is byte 0 and a-file is byte 7:
 *   byte i → internal square = floor(i/8)*8 + (7 - i%8)
 *
 * Confirmed by the hardware verification experiment described in the plan.
 */
const millenniumSquareMap = (): readonly number[] =>
  Array.from({ length: 64 }, (_, i) => Math.floor(i / 8) * 8 + (7 - (i % 8)));

// ── Shared piece encoding (same for Millennium and DGT v3) ───────────────────

/**
 * Piece encoding shared by Millennium and DGT USB v3:
 *   raw byte 0x00 = empty, 0x01 = white pawn, …, 0x06 = white queen,
 *              0x07 = black pawn, …, 0x0C = black queen.
 */
const STANDARD_PIECE_ENCODING: readonly number[] = [
  0,  // 0x00 = empty
  1,  // 0x01 = white pawn
  2,  // 0x02 = white rook
  3,  // 0x03 = white knight
  4,  // 0x04 = white bishop
  5,  // 0x05 = white king
  6,  // 0x06 = white queen
  7,  // 0x07 = black pawn
  8,  // 0x08 = black rook
  9,  // 0x09 = black knight
  10, // 0x0A = black bishop
  11, // 0x0B = black king
  12, // 0x0C = black queen
];

// ── Built-in profiles ─────────────────────────────────────────────────────────

export const MILLENNIUM_CHESSLINK_V1: BoardProfile = Object.freeze({
  label: "Millennium ChessLink v1.x",
  family: "millennium",
  firmwareVersion: "unknown",

  baudRate: 38400,

  bleServiceUuid: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E",
  bleTxCharUuid:  "6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
  bleRxCharUuid:  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E",

  cmd: {
    requestFullScan:  0x44,
    enableUpdateMode: 0x44, // param 0x01
    requestFirmware:  0x56,
    setLeds:          0x4C,
    allLedsOff: new Uint8Array([0x4C, 0x00]),
  },

  framing: {
    useOddParity: true,
    useCrc: false,
    deltaMessageLength: 3, // [0xE1, square, piece_code]
  },

  pieceEncoding: STANDARD_PIECE_ENCODING,
  squareMap: millenniumSquareMap(),

  supportsLeds: true,
});

export const DGT_USB_V3: BoardProfile = Object.freeze({
  label: "DGT USB v3",
  family: "dgt",
  firmwareVersion: "3.x",

  baudRate: 9600,

  cmd: {
    requestFullScan:  0x42, // DGT_SEND_BRD
    enableUpdateMode: 0x43, // DGT_SEND_UPDATE
    requestFirmware:  0x4D, // DGT_SEND_VERSION
    setLeds:          0x60, // DGT_SET_LEDS
    allLedsOff: new Uint8Array([0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  },

  framing: {
    useOddParity: false,
    useCrc: false,
    deltaMessageLength: 5, // [0x8E, 0x05, 0x00, square, piece_code]
  },

  pieceEncoding: STANDARD_PIECE_ENCODING,
  squareMap: dgtSquareMap(),

  supportsLeds: false, // most DGT USB boards have no LEDs
});

export const BUILT_IN_PROFILES: readonly BoardProfile[] = [
  MILLENNIUM_CHESSLINK_V1,
  DGT_USB_V3,
];

/**
 * Find the best-matching profile for a given board family and detected
 * firmware version. Falls back to the first profile of the same family if no
 * exact match is found.
 */
export const findProfile = (
  family: BoardProfile["family"],
  firmwareVersion: string,
): BoardProfile | null => {
  const candidates = BUILT_IN_PROFILES.filter((p) => p.family === family);
  const exact = candidates.find((p) => p.firmwareVersion === firmwareVersion);
  return exact ?? candidates[0] ?? null;
};
