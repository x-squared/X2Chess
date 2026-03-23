/**
 * board_diff — pure-logic board state diffing and LED signal computation.
 *
 * Integration API:
 * - `boardDiff(before, after)` — infer a MoveCandidate from two board states.
 * - `computeSyncSignal(appState, physicalState)` — LED signal for deviation.
 * - `computeMoveSignal(from, to)` — LED signal for computer move / hint.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

import type { BoardState, MoveCandidate, LedSignal, SquareId } from "../domain/board_types";

// ── boardDiff ─────────────────────────────────────────────────────────────────

/**
 * Infer a move from the difference between two consecutive board states.
 *
 * Handles:
 * - Normal moves (piece disappears from `from`, appears at `to`)
 * - Captures (destination was occupied)
 * - Castling (king + rook both move)
 * - En passant (captured pawn square differs from destination)
 * - Promotion detection (pawn reached back rank)
 *
 * Returns `null` when no single legal move can be inferred (e.g. more than
 * two squares changed — mid-move or multiple simultaneous changes).
 */
export const boardDiff = (
  before: BoardState,
  after: BoardState,
): MoveCandidate | null => {
  if (before.length !== 64 || after.length !== 64) return null;

  // Classify each square as: appeared, disappeared, or changed.
  const disappeared: SquareId[] = [];
  const appeared: SquareId[] = [];
  const changed: SquareId[] = []; // piece swapped for a different one

  for (let i = 0; i < 64; i++) {
    const b = before[i]!;
    const a = after[i]!;
    if (b === a) continue;
    if (b !== 0 && a === 0) disappeared.push(i);
    else if (b === 0 && a !== 0) appeared.push(i);
    else changed.push(i);
  }

  const totalChanges = disappeared.length + appeared.length + changed.length;

  // ── Normal move ────────────────────────────────────────────────────────────
  if (disappeared.length === 1 && appeared.length === 1 && changed.length === 0) {
    const from = disappeared[0]!;
    const to = appeared[0]!;
    const movingPiece = before[from]!;

    const promotionRequired =
      (movingPiece === 1 && to >= 56) || (movingPiece === 7 && to <= 7);

    return {
      from,
      to,
      ...(promotionRequired ? { promotionRequired: true } : {}),
    };
  }

  // ── Capture: destination square had a piece that was replaced ──────────────
  if (disappeared.length === 1 && appeared.length === 0 && changed.length === 1) {
    const from = disappeared[0]!;
    const to = changed[0]!;
    const capturedPiece = before[to]!;
    const movingPiece = before[from]!;

    const promotionRequired =
      (movingPiece === 1 && to >= 56) || (movingPiece === 7 && to <= 7);

    return {
      from,
      to,
      capturedPiece,
      ...(promotionRequired ? { promotionRequired: true } : {}),
    };
  }

  // ── En passant: pawn moves diagonally, captured pawn square is empty'd ─────
  // Pattern: 1 piece disappeared (from), 1 piece appeared (to),
  //          1 piece disappeared on a different rank (captured pawn).
  if (disappeared.length === 2 && appeared.length === 1 && changed.length === 0) {
    const to = appeared[0]!;
    const movingPieceCode = after[to]!;
    const movingIdx = disappeared.findIndex((sq) => before[sq] === movingPieceCode);
    if (movingIdx !== -1) {
      const from = disappeared[movingIdx]!;
      const capturedSq = disappeared[1 - movingIdx]!;
      const capturedPiece = before[capturedSq]!;
      // Validate: destination is empty in before (en passant characteristic)
      if (before[to] === 0) {
        return { from, to, capturedPiece };
      }
    }
  }

  // ── Castling: king + rook both move (4 changed squares) ───────────────────
  if (disappeared.length === 2 && appeared.length === 2 && changed.length === 0) {
    // Find the king among the disappeared.
    const kingIdx = disappeared.findIndex((sq) => {
      const p = before[sq]!;
      return p === 5 || p === 11; // white or black king
    });
    if (kingIdx !== -1) {
      const kingFrom = disappeared[kingIdx]!;
      // The king's destination: look for the king piece code in appeared squares.
      const kingCode = before[kingFrom]!;
      const kingToIdx = appeared.findIndex((sq) => after[sq] === kingCode);
      if (kingToIdx !== -1) {
        const kingTo = appeared[kingToIdx]!;
        return { from: kingFrom, to: kingTo };
      }
    }
  }

  // More than a castling-level change → ambiguous, return null.
  void totalChanges;
  return null;
};

// ── LED signal helpers ─────────────────────────────────────────────────────────

/**
 * Compute the LED signal for a sync deviation (app position ≠ board position).
 * Lights the squares that differ between the two states, held until resolved.
 */
export const computeSyncSignal = (
  appState: BoardState,
  physicalState: BoardState,
): LedSignal => {
  const leds = [];
  for (let i = 0; i < 64; i++) {
    if (appState[i] !== physicalState[i]) {
      leds.push({ square: i as SquareId, color: "orange" as const });
    }
  }
  return leds.length > 0
    ? { kind: "static", leds }
    : { kind: "off" };
};

/**
 * Compute the LED signal for a computer move or hint.
 * Lights `from` in orange and `to` in red, held until the user responds.
 */
export const computeMoveSignal = (from: SquareId, to: SquareId): LedSignal => ({
  kind: "static",
  leds: [
    { square: from, color: "orange" },
    { square: to, color: "red" },
  ],
});
