/**
 * pgn_transforms — Pure FEN and PGN transformation utilities for training variants.
 *
 * Integration API:
 * - `mirrorPgn(pgnText)` — produce a PGN with colors swapped and ranks mirrored.
 * - `rotatePgn(pgnText, degrees)` — produce a PGN with the board rotated by 90/180/270°.
 *   Only meaningful for pawnless positions; check `TrainingGameContext.isPawnless` first.
 *
 * Configuration API:
 * - None — all options are passed as parameters.
 *
 * Communication API:
 * - Pure functions; no side effects. Uses chess.js for move replay after transform.
 *
 * Transform invariants:
 * - The returned PGN is a minimal valid PGN (headers + moves) suitable for passing to
 *   a training protocol as `pgnText`.
 * - On any failure (invalid FEN, move replay error), the original `pgnText` is returned
 *   unchanged so the caller can fall back gracefully.
 */

import { Chess } from "chess.js";
import { parsePgnToModel } from "../../../../parts/pgnparser/src/pgn_model";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Expand a FEN rank string to exactly 8 single-character piece/empty tokens. */
const expandRank = (rank: string): string => {
  let result = "";
  for (const ch of rank) {
    const n = parseInt(ch, 10);
    if (!isNaN(n)) {
      result += ".".repeat(n);
    } else {
      result += ch;
    }
  }
  return result;
};

/** Compress an 8-character rank string (dots = empty) back to FEN notation. */
const compressRank = (rank: string): string => {
  let result = "";
  let emptyCount = 0;
  for (const ch of rank) {
    if (ch === ".") {
      emptyCount++;
    } else {
      if (emptyCount > 0) {
        result += String(emptyCount);
        emptyCount = 0;
      }
      result += ch;
    }
  }
  if (emptyCount > 0) result += String(emptyCount);
  return result;
};

/** Swap piece character case: lowercase ↔ uppercase. Digits and dots pass through. */
const swapPieceCase = (ch: string): string => {
  if (ch >= "a" && ch <= "z") return ch.toUpperCase();
  if (ch >= "A" && ch <= "Z") return ch.toLowerCase();
  return ch;
};

/** Flip all piece colors in a board section string (does not reorder ranks). */
const swapBoardColors = (board: string): string =>
  board.split("").map(swapPieceCase).join("");

/**
 * Build an 8×8 grid from a FEN board section.
 * Result: `grid[rankIdx][fileIdx]` where rankIdx=0 is rank 1, rankIdx=7 is rank 8.
 * Empty squares are represented as ".".
 */
const buildGrid = (boardFen: string): string[][] => {
  const fenRanks = boardFen.split("/"); // [rank8, rank7, …, rank1]
  const grid: string[][] = Array.from({ length: 8 }, () => Array<string>(8).fill("."));
  for (let i = 0; i < 8; i++) {
    const rankIdx = 7 - i; // FEN index 0 = rank 8 → grid row 7
    const expanded = expandRank(fenRanks[i] ?? "8");
    for (let f = 0; f < 8; f++) {
      grid[rankIdx][f] = expanded[f] ?? ".";
    }
  }
  return grid;
};

/**
 * Serialize a grid back to a FEN board section.
 * `grid[rankIdx][fileIdx]`, rankIdx=0 = rank 1.
 */
const gridToFen = (grid: string[][]): string => {
  const fenRanks: string[] = [];
  for (let i = 7; i >= 0; i--) { // rank8 first in FEN
    fenRanks.push(compressRank((grid[i] ?? []).join("")));
  }
  return fenRanks.join("/");
};

/** Mirror a single square name by flipping its rank (rank n → rank 9−n). */
const mirrorSquare = (sq: string): string => `${sq[0] ?? ""}${9 - parseInt(sq[1] ?? "1", 10)}`;

/** Rotate a square 90° clockwise: (col, row) → (7−row, col). */
const rotateSquare90CW = (sq: string): string => {
  const col = sq.charCodeAt(0) - 97; // 0=a … 7=h
  const row = parseInt(sq[1] ?? "1", 10) - 1; // 0=rank1 … 7=rank8
  const newCol = 7 - row;
  const newRow = col;
  return `${String.fromCharCode(97 + newCol)}${newRow + 1}`;
};

/** Rotate a square 90° counter-clockwise: (col, row) → (row, 7−col). */
const rotateSquare90CCW = (sq: string): string => {
  const col = sq.charCodeAt(0) - 97;
  const row = parseInt(sq[1] ?? "1", 10) - 1;
  const newCol = row;
  const newRow = 7 - col;
  return `${String.fromCharCode(97 + newCol)}${newRow + 1}`;
};

/** Rotate a square 180°: (col, row) → (7−col, 7−row). */
const rotateSquare180 = (sq: string): string => {
  const col = sq.charCodeAt(0) - 97;
  const row = parseInt(sq[1] ?? "1", 10) - 1;
  return `${String.fromCharCode(97 + (7 - col))}${7 - row + 1}`;
};

type SquareTransform = (sq: string) => string;

/** Transform a UCI move string by remapping origin and destination squares. */
const transformUci = (uci: string, transform: SquareTransform): string => {
  if (uci.length < 4) return uci;
  const from = transform(uci.slice(0, 2));
  const to = transform(uci.slice(2, 4));
  const promo = uci.slice(4); // e.g. "q" for promotion
  return `${from}${to}${promo}`;
};

/** Rotate an FEN board section using a square-to-square transform. */
const rotateBoard = (boardFen: string, squareTransform: SquareTransform): string => {
  const grid = buildGrid(boardFen);
  const newGrid: string[][] = Array.from({ length: 8 }, () => Array<string>(8).fill("."));
  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
      const sq = `${String.fromCharCode(97 + fileIdx)}${rankIdx + 1}`;
      const newSq = squareTransform(sq);
      const newFileIdx = newSq.charCodeAt(0) - 97;
      const newRankIdx = parseInt(newSq[1] ?? "1", 10) - 1;
      newGrid[newRankIdx][newFileIdx] = grid[rankIdx][fileIdx] ?? ".";
    }
  }
  return gridToFen(newGrid);
};

// ── FEN transforms ────────────────────────────────────────────────────────────

/**
 * Mirror a FEN: swap piece colors, reverse rank order, flip side-to-move,
 * swap castling rights (K↔k, Q↔q), and mirror the en-passant square.
 * The result is the "same" position viewed from the other color's perspective.
 */
export const mirrorFen = (fen: string): string => {
  const parts = fen.split(" ");
  const board = parts[0] ?? "";
  const side = parts[1] ?? "w";
  const castling = parts[2] ?? "-";
  const ep = parts[3] ?? "-";
  const half = parts[4] ?? "0";
  const full = parts[5] ?? "1";

  // Reverse ranks and swap piece colors
  const mirroredBoard = board
    .split("/")
    .reverse()
    .map(swapBoardColors)
    .join("/");

  const newSide = side === "w" ? "b" : "w";

  // Swap castling: K↔k, Q↔q
  const newCastling =
    castling === "-"
      ? "-"
      : castling
          .split("")
          .map((ch) => (ch >= "A" && ch <= "Z" ? ch.toLowerCase() : ch.toUpperCase()))
          .join("");

  // Mirror EP square: rank 3↔6
  let newEp = "-";
  if (ep !== "-" && ep.length >= 2) {
    const epRank = parseInt(ep[1] ?? "1", 10);
    newEp = `${ep[0]}${9 - epRank}`;
  }

  return [mirroredBoard, newSide, newCastling, newEp, half, full].join(" ");
};

/**
 * Rotate a FEN board section by 90, 180, or 270 degrees.
 * - Castling rights are always cleared (piece positions no longer satisfy castling rules).
 * - En passant is always cleared (only meaningful for pawn positions; rotation is
 *   intended for pawnless endgames).
 * - Side to move is preserved.
 */
export const rotateFen = (fen: string, degrees: 90 | 180 | 270): string => {
  const parts = fen.split(" ");
  const board = parts[0] ?? "";
  const side = parts[1] ?? "w";
  const half = parts[4] ?? "0";
  const full = parts[5] ?? "1";

  let squareTransform: SquareTransform;
  if (degrees === 90) squareTransform = rotateSquare90CW;
  else if (degrees === 270) squareTransform = rotateSquare90CCW;
  else squareTransform = rotateSquare180;

  const rotatedBoard = rotateBoard(board, squareTransform);

  return [rotatedBoard, side, "-", "-", half, full].join(" ");
};

// ── PGN extraction helpers ────────────────────────────────────────────────────

type ExtractedGame = {
  startFen: string;
  ucis: string[];
};

/**
 * Parse a PGN text and extract the starting FEN and mainline UCI move list.
 * Returns null if the PGN cannot be parsed or replayed.
 */
const extractGame = (pgnText: string): ExtractedGame | null => {
  try {
    const model = parsePgnToModel(pgnText);
    const fenHeader = model.headers.find((h) => h.key === "FEN");
    const startFen =
      fenHeader?.value ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const chess = new Chess();
    try {
      chess.load(startFen);
    } catch {
      return null;
    }

    const ucis: string[] = [];
    for (const entry of model.root.entries) {
      if (entry.type !== "move") continue;
      const result = chess.move(entry.san, { strict: false });
      if (!result) break;
      ucis.push(result.from + result.to + (result.promotion ?? ""));
    }

    return { startFen, ucis };
  } catch {
    return null;
  }
};

/**
 * Replay transformed UCIs from a transformed FEN and collect the resulting SANs.
 * Returns null if the first move fails to apply.
 */
const replayTransformedGame = (
  transformedFen: string,
  transformedUcis: string[],
): string[] | null => {
  const chess = new Chess();
  try {
    chess.load(transformedFen);
  } catch {
    return null;
  }
  const sans: string[] = [];
  for (const uci of transformedUcis) {
    const result = chess.move(
      { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] },
    );
    if (!result) break; // stop at first invalid move
    sans.push(result.san);
  }
  return sans;
};

/**
 * Render a minimal valid PGN from headers, a starting FEN, and SANs.
 * The standard starting position does not get a FEN/SetUp header.
 */
const buildMinimalPgn = (
  originalHeaders: Array<{ key: string; value: string }>,
  transformedFen: string,
  sans: string[],
  startingSide: "w" | "b",
): string => {
  const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const isStandard = transformedFen === STANDARD_FEN;

  // Carry over metadata headers (White, Black, Event, Date, Result) but not FEN/SetUp.
  const metaKeys = new Set(["White", "Black", "Event", "Date", "Result", "Round"]);
  const metaHeaders = originalHeaders.filter((h) => metaKeys.has(h.key));

  let pgn = "";
  for (const h of metaHeaders) {
    pgn += `[${h.key} "${h.value}"]\n`;
  }
  if (!isStandard) {
    pgn += `[SetUp "1"]\n`;
    pgn += `[FEN "${transformedFen}"]\n`;
  }
  pgn += "\n";

  // Format moves with move numbers.
  let moveNum = 1;
  let sideToMove: "w" | "b" = startingSide;
  for (let i = 0; i < sans.length; i++) {
    const san = sans[i] ?? "";
    if (sideToMove === "w") {
      pgn += `${moveNum}. ${san} `;
    } else {
      if (i === 0) {
        // Game starts with Black to move
        pgn += `${moveNum}... ${san} `;
      } else {
        pgn += `${san} `;
        moveNum++;
      }
    }
    sideToMove = sideToMove === "w" ? "b" : "w";
  }
  pgn += "*";
  return pgn.trim();
};

// ── Public PGN transforms ─────────────────────────────────────────────────────

/**
 * Produce a mirrored variant of the given PGN text.
 *
 * The transform:
 * 1. Mirrors the starting FEN (swaps piece colors, reverses ranks, flips side-to-move).
 * 2. Mirrors each mainline UCI move (flips origin/destination ranks).
 * 3. Rebuilds the game from the mirrored position to obtain valid SANs.
 *
 * Use this to train the "other color's role" in a custom-FEN game.
 *
 * @param pgnText Source PGN string (may contain a FEN header for custom positions).
 * @returns Transformed PGN string, or the original `pgnText` if the transform fails.
 */
export const mirrorPgn = (pgnText: string): string => {
  try {
    const model = parsePgnToModel(pgnText);
    const extracted = extractGame(pgnText);
    if (!extracted) return pgnText;

    const { startFen, ucis } = extracted;
    const transformedFen = mirrorFen(startFen);
    const transformedUcis = ucis.map((u) => transformUci(u, mirrorSquare));
    const sans = replayTransformedGame(transformedFen, transformedUcis);
    if (!sans) return pgnText;

    const startingSide = (transformedFen.split(" ")[1] ?? "w") as "w" | "b";
    return buildMinimalPgn(model.headers, transformedFen, sans, startingSide);
  } catch {
    return pgnText;
  }
};

/**
 * Produce a rotated variant of the given PGN text.
 *
 * The transform:
 * 1. Rotates the starting FEN board (clears castling and en-passant).
 * 2. Rotates each mainline UCI move (remaps squares).
 * 3. Rebuilds the game from the rotated position to obtain valid SANs.
 *
 * Only meaningful for pawnless positions (pawns have directional constraints).
 * Verify `TrainingGameContext.isPawnless` before calling.
 *
 * @param pgnText Source PGN string.
 * @param degrees Clockwise rotation angle: 90, 180, or 270.
 * @returns Transformed PGN string, or the original `pgnText` if the transform fails.
 */
export const rotatePgn = (pgnText: string, degrees: 90 | 180 | 270): string => {
  try {
    const model = parsePgnToModel(pgnText);
    const extracted = extractGame(pgnText);
    if (!extracted) return pgnText;

    const { startFen, ucis } = extracted;
    const transformedFen = rotateFen(startFen, degrees);

    let squareTransform: SquareTransform;
    if (degrees === 90) squareTransform = rotateSquare90CW;
    else if (degrees === 270) squareTransform = rotateSquare90CCW;
    else squareTransform = rotateSquare180;

    const transformedUcis = ucis.map((u) => transformUci(u, squareTransform));
    const sans = replayTransformedGame(transformedFen, transformedUcis);
    if (!sans) return pgnText;

    const startingSide = (transformedFen.split(" ")[1] ?? "w") as "w" | "b";
    return buildMinimalPgn(model.headers, transformedFen, sans, startingSide);
  } catch {
    return pgnText;
  }
};
