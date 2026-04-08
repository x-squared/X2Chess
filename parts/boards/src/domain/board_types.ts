/**
 * board_types — Core types for physical chess board integration.
 *
 * Integration API:
 * - Primary exports: `PieceCode`, `SquareId`, `BoardState`, `LedCommand`,
 *   `LedFrame`, `LedSignal`, `BoardSignalKind`, `MoveCandidate`,
 *   `BoardConnection`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure type definitions; no I/O or runtime state.
 */

// ── Square and piece encoding ─────────────────────────────────────────────────

/**
 * Piece encoding used for board state arrays.
 *   0 = empty
 *   1–6 = white pawn/rook/knight/bishop/king/queen
 *   7–12 = black pawn/rook/knight/bishop/king/queen
 */
export type PieceCode =
  | 0   // empty
  | 1   // white pawn
  | 2   // white rook
  | 3   // white knight
  | 4   // white bishop
  | 5   // white king
  | 6   // white queen
  | 7   // black pawn
  | 8   // black rook
  | 9   // black knight
  | 10  // black bishop
  | 11  // black king
  | 12; // black queen

/** Square index: 0 = a1, 63 = h8 (file-major: a1=0, b1=1, …, h1=7, a2=8, …). */
export type SquareId = number;

/** Immutable 64-element snapshot of all squares (a1=index 0, h8=index 63). */
export type BoardState = readonly PieceCode[];

// ── LED types ─────────────────────────────────────────────────────────────────

/** A single lit square with optional colour. */
export type LedCommand = {
  square: SquareId;
  /** Boards without colour support treat any colour as "on". */
  color?: "white" | "red" | "orange";
};

/** One frame of an animation: which squares are lit and for how long. */
export type LedFrame = {
  leds: LedCommand[];
  durationMs: number;
};

/**
 * A LED signal is either a persistent state, a timed animation sequence,
 * or an all-off clear.
 */
export type LedSignal =
  | { kind: "static";   leds: LedCommand[] }
  | { kind: "sequence"; frames: LedFrame[]; repeat?: number }
  | { kind: "off" };

/** Named application signals dispatched by the app layer. */
export type BoardSignalKind =
  | "connection_confirmed"
  | "position_set"
  | "computer_move"
  | "move_accepted"
  | "illegal_move"
  | "check"
  | "hint"
  | "sync_deviation"
  | "study_correct"
  | "study_wrong"
  | "all_off";

// ── Move detection ────────────────────────────────────────────────────────────

/**
 * Candidate move inferred from comparing two consecutive board states.
 * The adapter reconciles this against the game model to determine legality.
 */
export type MoveCandidate = {
  from: SquareId;
  to: SquareId;
  /** Piece that was on `to` in the before-state (capture). */
  capturedPiece?: PieceCode;
  /** True when a pawn reached the back rank and promotion is required. */
  promotionRequired?: boolean;
};

// ── BoardConnection ───────────────────────────────────────────────────────────

/** Consumer-facing interface for a connected physical board. */
export interface BoardConnection {
  readonly boardType: "millennium" | "dgt" | "simulator";
  readonly portOrAddress: string;

  /** Returns current board state on demand. */
  getBoardState(): Promise<BoardState>;

  /**
   * Registers a callback invoked whenever the board state changes.
   * Returns an unsubscribe function.
   */
  onStateChange(handler: (state: BoardState) => void): () => void;

  /** Send a LED signal (static state, animation, or off). */
  sendSignal(signal: LedSignal): Promise<void>;

  disconnect(): Promise<void>;
}
