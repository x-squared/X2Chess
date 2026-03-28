/**
 * move_hints — computes the legal destination squares for a piece on a given
 * square, producing typed `MoveHint` values ready for board rendering.
 *
 * Integration API:
 * - Call `computeMoveHints(game, square)` with a chess.js `Chess` instance at
 *   the target position and the square being hovered.
 * - Returns `[]` when the square is empty, the position is terminal, or the
 *   piece has no legal moves.
 *
 * Configuration API:
 * - No configuration; behaviour is determined entirely by the inputs.
 *
 * Communication API:
 * - Pure function; no side effects, no React, no DOM.
 */

import type { Chess } from "chess.js";
import type { BoardKey } from "./board_shapes";
import { isBoardKey } from "./board_shapes";
import type { ShapeColor } from "./board_shapes";

/**
 * A single legal destination for a hovered piece.
 *
 * @param square    - Destination square, e.g. `"e4"`.
 * @param isCapture - True when the destination contains an enemy piece (drives
 *                    the ring-vs-dot visual variant).
 * @param color     - Optional engine-supplied evaluation colour.  `undefined`
 *                    renders the neutral dot; a `ShapeColor` renders a coloured
 *                    dot once engine integration is wired.
 */
export type MoveHint = {
  square: BoardKey;
  isCapture: boolean;
  color?: ShapeColor;
};

type VerboseMove = {
  from: string;
  to: string;
  captured?: string;
};

/**
 * Compute all legal `MoveHint` values for the piece on `square` in `game`.
 * Returns an empty array when `square` is empty, contains no legal moves, or
 * the position is in a terminal state (checkmate / stalemate).
 *
 * @param game   - `Chess` instance at the position to query (not mutated).
 * @param square - The square whose piece's destinations are requested.
 * @returns Array of destination hints, one per legal move from `square`.
 */
export const computeMoveHints = (game: Chess, square: BoardKey): MoveHint[] => {
  const rawMoves: VerboseMove[] = game.moves({ verbose: true }) as VerboseMove[];
  const hints: MoveHint[] = [];

  for (const move of rawMoves) {
    if (move.from !== square) continue;
    if (!isBoardKey(move.to)) continue;
    hints.push({
      square: move.to,
      isCapture: !!move.captured,
    });
  }

  return hints;
};
