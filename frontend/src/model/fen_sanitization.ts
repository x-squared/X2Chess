/**
 * fen_sanitization — Canonical FEN normalization for UI setup and engine I/O.
 *
 * Standard chess: strips impossible `KQkq` castling flags relative to rook/king
 * placement (chess.js keeps inconsistent tokens in `.fen()`). Chess960: relies on
 * chess.js load/`fen()` only — castling uses file letters; do not apply standard
 * king-on-e1/e8 rules.
 *
 * Integration API:
 * - `sanitizeSetupFen(fen, mode)` — single six-field FEN (New Game, headers, engines).
 * - `sanitizeEnginePositionForUci(position)` — engine root with optional UCI replay.
 */

import { Chess, type Move } from "chess.js";
import type { EnginePosition } from "../../../parts/engines/src/domain/analysis_types";
import { log } from "../logger";

const STANDARD_STARTING_FEN: string =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** How to interpret the castling field when normalizing. */
export type FenSanitizeMode = "standard" | "chess960";

/** Narrow unknown catch values for logging without relying on default Object stringification. */
const messageFromUnknown = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
};

const whiteKingOnE1 = (game: Chess): boolean => {
  const wk = game.get("e1");
  return wk?.type === "k" && wk.color === "w";
};

const blackKingOnE8 = (game: Chess): boolean => {
  const bk = game.get("e8");
  return bk?.type === "k" && bk.color === "b";
};

const canWhiteCastleKingside = (game: Chess): boolean => {
  if (!whiteKingOnE1(game)) return false;
  const rh = game.get("h1");
  return (
    rh?.type === "r" &&
    rh.color === "w" &&
    game.get("f1") === undefined &&
    game.get("g1") === undefined
  );
};

const canWhiteCastleQueenside = (game: Chess): boolean => {
  if (!whiteKingOnE1(game)) return false;
  const ra = game.get("a1");
  return (
    ra?.type === "r" &&
    ra.color === "w" &&
    game.get("b1") === undefined &&
    game.get("c1") === undefined &&
    game.get("d1") === undefined
  );
};

const canBlackCastleKingside = (game: Chess): boolean => {
  if (!blackKingOnE8(game)) return false;
  const rh = game.get("h8");
  return (
    rh?.type === "r" &&
    rh.color === "b" &&
    game.get("f8") === undefined &&
    game.get("g8") === undefined
  );
};

const canBlackCastleQueenside = (game: Chess): boolean => {
  if (!blackKingOnE8(game)) return false;
  const ra = game.get("a8");
  return (
    ra?.type === "r" &&
    ra.color === "b" &&
    game.get("b8") === undefined &&
    game.get("c8") === undefined &&
    game.get("d8") === undefined
  );
};

/**
 * Keep only K/Q/k/q letters that match standard king/rook geometry.
 *
 * @param game - Loaded position.
 * @param originalRights - Castling field from the incoming FEN (`-` or subset of `KQkq`).
 * @returns Normalized castling substring without `-`; caller maps empty to `-`.
 */
const filterStandardCastlingField = (game: Chess, originalRights: string): string => {
  const letters: string[] = originalRights
    .replaceAll("-", "")
    .split("")
    .filter((c: string): boolean => "KQkq".includes(c));
  const orig: Set<string> = new Set(letters);
  const out: string[] = [];

  if (orig.has("K") && canWhiteCastleKingside(game)) out.push("K");
  if (orig.has("Q") && canWhiteCastleQueenside(game)) out.push("Q");
  if (orig.has("k") && canBlackCastleKingside(game)) out.push("k");
  if (orig.has("q") && canBlackCastleQueenside(game)) out.push("q");

  return out.join("");
};

/**
 * Normalize a full FEN for storage and engine input.
 *
 * @param fen - Six-field FEN. Empty string and `startpos` pass through unchanged.
 * @param mode - `standard` applies castling correction; `chess960` uses chess.js only.
 * @returns Normalized FEN, or the original string when parsing fails.
 */
export const sanitizeSetupFen = (
  fen: string,
  mode: FenSanitizeMode = "standard",
): string => {
  const trimmed: string = fen.trim();
  if (trimmed === "" || trimmed === "startpos") {
    return fen;
  }
  if (trimmed.replaceAll(/\s+/g, " ") === STANDARD_STARTING_FEN) {
    return STANDARD_STARTING_FEN;
  }

  if (mode === "chess960") {
    try {
      const game: Chess = new Chess(trimmed);
      return game.fen();
    } catch (err: unknown) {
      log.warn("fen_sanitization", "sanitizeSetupFen (chess960): chess.js rejected FEN", {
        message: messageFromUnknown(err),
      });
      return fen;
    }
  }

  let game: Chess;
  try {
    game = new Chess(trimmed);
  } catch (err: unknown) {
    log.warn("fen_sanitization", "sanitizeSetupFen: chess.js rejected FEN", {
      message: messageFromUnknown(err),
    });
    return fen;
  }

  const parts: string[] = trimmed.split(/\s+/);
  if (parts.length < 6) {
    return fen;
  }

  const placement: string = parts[0] ?? "";
  const stm: string = parts[1] ?? "w";
  const castlingIn: string = parts[2] ?? "-";
  const ep: string = parts[3] ?? "-";
  const half: string = parts[4] ?? "0";
  const full: string = parts[5] ?? "1";

  const castlingOut: string = filterStandardCastlingField(
    game,
    castlingIn === "-" ? "" : castlingIn,
  );
  const castlingToken: string = castlingOut.length > 0 ? castlingOut : "-";

  const rebuilt: string = `${placement} ${stm} ${castlingToken} ${ep} ${half} ${full}`;

  try {
    const verified: Chess = new Chess(rebuilt);
    return verified.fen();
  } catch (err: unknown) {
    log.warn("fen_sanitization", "sanitizeSetupFen: rebuilt FEN rejected — using original", {
      rebuilt,
      message: messageFromUnknown(err),
    });
    return fen;
  }
};

/**
 * Sanitize the engine analysis root (`fen` + optional UCI moves). Always uses
 * standard castling rules (Chess960 analysis uses `UCI_Chess960` separately).
 *
 * @param position - Engine root position.
 * @returns Sanitized position; on replay failure returns the original argument.
 */
export const sanitizeEnginePositionForUci = (position: EnginePosition): EnginePosition => {
  const moves: string[] = position.moves;
  if (moves.length === 0) {
    return { fen: sanitizeSetupFen(position.fen, "standard"), moves: [] };
  }

  const baseFen: string = sanitizeSetupFen(position.fen, "standard");
  let game: Chess;
  try {
    game = new Chess(
      baseFen === "" || baseFen === "startpos" ? undefined : baseFen,
    );
  } catch (err: unknown) {
    log.warn("fen_sanitization", "sanitizeEnginePositionForUci: cannot load base FEN", {
      message: messageFromUnknown(err),
    });
    return position;
  }

  for (const uci of moves) {
    if (uci.length < 4) {
      log.warn("fen_sanitization", `sanitizeEnginePositionForUci: short UCI "${uci}"`);
      return position;
    }
    const from: string = uci.slice(0, 2);
    const to: string = uci.slice(2, 4);
    const promotion: "q" | "r" | "b" | "n" | undefined =
      uci.length >= 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
    let moved: Move | null = null;
    try {
      moved = game.move({ from, to, promotion });
    } catch {
      moved = null;
    }
    if (!moved) {
      log.warn("fen_sanitization", `sanitizeEnginePositionForUci: illegal UCI "${uci}"`);
      return position;
    }
  }

  return { fen: game.fen(), moves: [] };
};
