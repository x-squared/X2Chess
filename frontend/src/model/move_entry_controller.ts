/**
 * move_entry_controller — pure-logic fork detection for board-driven move entry.
 *
 * Integration API:
 * - `resolveMoveEntry(input)` — given a board move (from/to/promotion) and the
 *   current PGN state, returns a `MoveResolution` describing what action to take.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure function; no side effects or React dependencies.
 * - Chess.js is used internally to convert board coordinates to SAN.
 */

import { Chess } from "chess.js";
import type { PgnModel, PgnMoveNode, PgnVariationNode } from "./pgn_model";
import type { PgnCursor } from "./pgn_move_ops";

// ── Types ──────────────────────────────────────────────────────────────────────

/** A move played on the board, identified by from/to squares and optional promotion. */
export type BoardMove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

/**
 * Describes what the MoveEntryController determined after a board move:
 *
 * - `advance`:         The played move matches the next mainline move. Advance cursor.
 * - `enter_variation`: The played move matches the first move of an existing RAV.
 * - `append`:          No next move exists; the move can be appended to the end of
 *                      the current line.
 * - `fork`:            A next move exists but differs from the played move. The user
 *                      must choose: Replace, Add as variation, or Promote to mainline.
 * - `illegal`:         chess.js rejected the move (should not happen if the board
 *                      already filtered illegal moves, but provided as a safety net).
 */
export type MoveResolution =
  | { kind: "advance"; san: string; nextMoveId: string }
  | {
      kind: "enter_variation";
      san: string;
      variationId: string;
      firstMoveId: string;
    }
  | { kind: "append"; san: string }
  | {
      kind: "fork";
      san: string;
      existingNextSan: string;
      existingNextMoveId: string;
    }
  | { kind: "illegal" };

export type MoveEntryInput = {
  boardMove: BoardMove;
  /** FEN of the current position (before the move is played). */
  currentFen: string;
  model: PgnModel;
  cursor: PgnCursor;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const findVariation = (
  root: PgnVariationNode,
  id: string,
): PgnVariationNode | null => {
  if (root.id === id) return root;
  for (const entry of root.entries) {
    if (entry.type === "move") {
      for (const rav of (entry as PgnMoveNode).ravs) {
        const found = findVariation(rav, id);
        if (found) return found;
      }
    }
    if (entry.type === "variation") {
      const found = findVariation(entry as PgnVariationNode, id);
      if (found) return found;
    }
  }
  return null;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve how a board move (from/to/promotion) maps onto the current PGN state.
 *
 * Returns null if `currentFen` is unparseable.
 */
export const resolveMoveEntry = (
  input: MoveEntryInput,
): MoveResolution | null => {
  const { boardMove, currentFen, model, cursor } = input;

  // Convert the board move to SAN.
  const chess = new Chess();
  try {
    chess.load(currentFen);
  } catch {
    return null;
  }

  const chessMove = chess.move({
    from: boardMove.from,
    to: boardMove.to,
    promotion: boardMove.promotion ?? "q",
  });

  if (!chessMove) return { kind: "illegal" };
  const san: string = chessMove.san;

  // Find the current variation.
  const variation = findVariation(model.root, cursor.variationId);
  if (!variation) return { kind: "append", san };

  // Find the index of the cursor move.
  const cursorIdx =
    cursor.moveId === null
      ? -1
      : variation.entries.findIndex(
          (e) => e.type === "move" && e.id === cursor.moveId,
        );

  // Find the next move in this variation after the cursor.
  let nextMove: PgnMoveNode | null = null;
  for (let i = cursorIdx + 1; i < variation.entries.length; i++) {
    if (variation.entries[i].type === "move") {
      nextMove = variation.entries[i] as PgnMoveNode;
      break;
    }
  }

  // No next move → append.
  if (!nextMove) return { kind: "append", san };

  // Played move matches the next mainline move → advance.
  if (nextMove.san === san) {
    return { kind: "advance", san, nextMoveId: nextMove.id };
  }

  // Check existing RAVs off the cursor move.
  const cursorMove =
    cursor.moveId !== null && cursorIdx >= 0
      ? (variation.entries[cursorIdx] as PgnMoveNode)
      : null;

  if (cursorMove) {
    for (const rav of cursorMove.ravs) {
      // Find the first move in the RAV.
      for (const entry of rav.entries) {
        if (entry.type === "move") {
          const firstRavMove = entry as PgnMoveNode;
          if (firstRavMove.san === san) {
            return {
              kind: "enter_variation",
              san,
              variationId: rav.id,
              firstMoveId: firstRavMove.id,
            };
          }
          break; // Only check the first move of each RAV.
        }
      }
    }
  }

  // Fork: played move differs from the existing next move.
  return {
    kind: "fork",
    san,
    existingNextSan: nextMove.san,
    existingNextMoveId: nextMove.id,
  };
};
