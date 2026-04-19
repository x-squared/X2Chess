/**
 * training_game_context — Derives training-relevant facts from the active PGN model.
 *
 * Integration API:
 * - `buildTrainingGameContext(pgnModel)` — compute a `TrainingGameContext` from the
 *   current `PgnModel`. Pass `null` to get a safe default.
 * - `TrainingGameContext` — value type consumed by `TrainingLauncher` to determine
 *   which protocols and transforms are available.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure function; no side effects.
 */

import { Chess } from "chess.js";
import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";

export const STANDARD_STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Training-relevant facts derived from the active game.
 * Determines which training protocols and board transforms are available.
 */
export type TrainingGameContext = {
  /**
   * True when the game's starting position is not the standard one (SetUp: 1).
   * Enables the "Find Move" protocol and the mirror/rotation transforms in the launcher.
   */
  hasCustomStartingPosition: boolean;
  /**
   * True when the game is Chess960 (Variant: Chess960 header or chess960-style castling
   * rights such as "AHah"). Chess960 games are treated as standard-position games for
   * protocol selection (replay and opening are available; Find Move is not).
   */
  isChess960: boolean;
  /**
   * True when the starting position contains no pawns.
   * Only pawnless positions allow 90°/180°/270° board rotation transforms.
   */
  isPawnless: boolean;
  /**
   * Number of mainline moves in the game (0 if the game has no moves).
   * Used to bound the start-ply picker range.
   */
  moveCount: number;
  /**
   * SAN strings for each mainline move, in order.
   * `mainlineSans[n]` is the move played at ply n+1 (0-based game move index).
   * Used to display move labels in the start-ply picker.
   */
  mainlineSans: string[];
  /**
   * The starting FEN for the game (standard FEN when no custom position is set).
   */
  startingFen: string;
  /**
   * Side to move in the starting FEN: "w" (White) or "b" (Black).
   */
  startingSide: "w" | "b";
};

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Derive a `TrainingGameContext` from the current parsed PGN model.
 *
 * Safe to call with `null` — returns a context representing an empty standard game.
 *
 * @param pgnModel The current parsed PGN model, or null if no game is open.
 * @returns A `TrainingGameContext` capturing all training-relevant game facts.
 */
export const buildTrainingGameContext = (pgnModel: PgnModel | null): TrainingGameContext => {
  const defaultCtx: TrainingGameContext = {
    hasCustomStartingPosition: false,
    isChess960: false,
    isPawnless: false,
    moveCount: 0,
    mainlineSans: [],
    startingFen: STANDARD_STARTING_FEN,
    startingSide: "w",
  };

  if (!pgnModel) return defaultCtx;

  const headers = pgnModel.headers;

  // Detect Chess960
  const variantHeader = headers.find((h) => h.key === "Variant");
  const isChess960 =
    variantHeader?.value?.toLowerCase().includes("960") === true ||
    variantHeader?.value?.toLowerCase() === "fischerandom";

  // Detect custom starting position
  const setUpHeader = headers.find((h) => h.key === "SetUp");
  const fenHeader = headers.find((h) => h.key === "FEN");
  const hasSetUp = setUpHeader?.value === "1" && !!fenHeader;
  const startingFen = fenHeader?.value ?? STANDARD_STARTING_FEN;

  // Normalize "no custom position" to false even if SetUp header is present but FEN is standard
  const isStandardFen =
    startingFen === STANDARD_STARTING_FEN ||
    !fenHeader;
  const hasCustomStartingPosition = hasSetUp && !isStandardFen && !isChess960;

  // Detect pawnless position (only relevant for custom positions)
  const boardSection = startingFen.split(" ")[0] ?? "";
  const isPawnless = hasCustomStartingPosition && !/[pP]/.test(boardSection);

  // Determine side to move
  const sideField = startingFen.split(" ")[1] ?? "w";
  const startingSide: "w" | "b" = sideField === "b" ? "b" : "w";

  // Extract mainline SANs
  const mainlineSans: string[] = [];
  try {
    const chess = new Chess();
    try {
      chess.load(startingFen);
    } catch {
      // Invalid FEN — skip move extraction
    }
    for (const entry of pgnModel.root.entries) {
      if (entry.type !== "move") continue;
      try {
        const result = chess.move(entry.san, { strict: false });
        if (!result) break;
        mainlineSans.push(result.san);
      } catch {
        break;
      }
    }
  } catch {
    // Non-critical; move count falls back to 0
  }

  return {
    hasCustomStartingPosition,
    isChess960,
    isPawnless,
    moveCount: mainlineSans.length,
    mainlineSans,
    startingFen,
    startingSide,
  };
};

// ── Ply label helper ──────────────────────────────────────────────────────────

/**
 * Return a human-readable label for a given ply index in a game.
 *
 * Examples:
 * - ply 0: "Start"
 * - ply 1 (White opened with e4): "After 1. e4"
 * - ply 2 (Black replied e5): "After 1… e5"
 *
 * @param ply Zero-based ply index (0 = starting position).
 * @param ctx Game context supplying `mainlineSans` and `startingSide`.
 * @returns Label string for display in the start-ply picker.
 */
export const plyLabel = (ply: number, ctx: TrainingGameContext): string => {
  if (ply <= 0) return "Start";
  const san = ctx.mainlineSans[ply - 1];
  if (!san) return `Ply ${ply}`;

  // Work out the full-move number and which side moved.
  // ply 1 = first move; if White started (startingSide "w"), ply 1 = White's move 1.
  // full-move number advances after Black's move.
  const whiteMoveFirst = ctx.startingSide === "w";
  let moveNum: number;
  let isWhiteMove: boolean;
  if (whiteMoveFirst) {
    // ply 1 → move 1 White, ply 2 → move 1 Black, ply 3 → move 2 White …
    isWhiteMove = ply % 2 === 1;
    moveNum = Math.ceil(ply / 2);
  } else {
    // ply 1 → move 1 Black, ply 2 → move 2 White, ply 3 → move 2 Black …
    isWhiteMove = ply % 2 === 0;
    moveNum = isWhiteMove ? ply / 2 : Math.ceil(ply / 2);
  }

  const dotStr = isWhiteMove ? "." : "\u2026"; // "." or "…"
  return `After ${moveNum}${dotStr} ${san}`;
};
