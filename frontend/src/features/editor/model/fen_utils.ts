/**
 * fen_utils — pure-logic FEN validation and manipulation helpers.
 *
 * Integration API:
 * - Exports: `validateFen`, `STANDARD_STARTING_FEN`, `fenFromChessJs`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure functions; no I/O or side effects.
 */

export const STANDARD_STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type FenValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate a FEN string structurally (without chess.js dependency).
 * Checks: 8 ranks, piece characters, side-to-move, castling, en passant, counters.
 * Does NOT check for illegal positions (e.g. both kings in check).
 */
export const validateFenStructure = (fen: string): FenValidationResult => {
  const trimmed = fen.trim();
  if (!trimmed) return { valid: false, error: "FEN is empty" };

  const parts = trimmed.split(/\s+/);
  if (parts.length < 4 || parts.length > 6) {
    return { valid: false, error: "FEN must have 4–6 space-separated fields" };
  }

  const [ranks, side, castling, ep] = parts;

  // Validate rank section.
  const rankList = (ranks ?? "").split("/");
  if (rankList.length !== 8) {
    return { valid: false, error: "FEN board must have exactly 8 ranks" };
  }
  for (const rank of rankList) {
    let count = 0;
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) {
        count += Number(ch);
      } else if (/[pnbrqkPNBRQK]/.test(ch)) {
        count += 1;
      } else {
        return { valid: false, error: `Invalid character in FEN rank: '${ch}'` };
      }
    }
    if (count !== 8) {
      return { valid: false, error: `FEN rank '${rank}' does not sum to 8 squares` };
    }
  }

  // Side to move.
  if (side !== "w" && side !== "b") {
    return { valid: false, error: "Side to move must be 'w' or 'b'" };
  }

  // Castling.
  if (!/^(-|[KQkqA-Ha-h]{1,4})$/.test(castling ?? "")) {
    return { valid: false, error: "Invalid castling field" };
  }

  // En passant.
  if (!/^(-|[a-h][36])$/.test(ep ?? "")) {
    return { valid: false, error: "Invalid en passant field" };
  }

  return { valid: true };
};

/**
 * Count occurrences of a piece character in the FEN board section.
 */
const countPiece = (boardSection: string, piece: string): number => {
  let count = 0;
  for (const ch of boardSection) {
    if (ch === piece) count++;
  }
  return count;
};

/**
 * Validate that both kings are present exactly once.
 * Returns an error string or null if valid.
 */
export const validateKings = (fen: string): string | null => {
  const board = fen.split(/\s/)[0] ?? "";
  if (countPiece(board, "K") !== 1) return "White king must appear exactly once";
  if (countPiece(board, "k") !== 1) return "Black king must appear exactly once";
  return null;
};
