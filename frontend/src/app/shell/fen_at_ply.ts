import { Chess, type Move } from "chess.js";
import { applySanWithFallback } from "../../board/move_position";
import { log } from "../../logger";

/**
 * fen_at_ply — resilient SAN replay helper for shell-level FEN derivation.
 *
 * Integration API:
 * - `buildFenAtPly(sanMoves, ply, startFen?)` — compute board FEN by replaying SAN moves.
 *
 * Configuration API:
 * - `startFen` optionally seeds replay from a custom start position (for `[FEN]` games).
 *
 * Communication API:
 * - Emits structured warnings via `log.warn` when replay cannot continue.
 */

/**
 * Build FEN at the requested ply by replaying SAN moves with tolerant parsing.
 *
 * Accepts non-standard SAN forms handled by `applySanWithFallback` and supports
 * null moves (`--`) by applying a pass move in chess.js. Replay is best-effort:
 * if a move cannot be applied, the function returns the last valid position
 * instead of throwing.
 *
 * @param sanMoves - Ordered SAN move list for the current game.
 * @param ply - Target 0-based half-move position.
 * @param startFen - Optional custom start FEN (for `[FEN]`/`SetUp` games).
 * @returns FEN string after replaying up to `ply`.
 */
export const buildFenAtPly = (sanMoves: string[], ply: number, startFen?: string): string => {
  const game: Chess = (() => {
    if (!startFen) return new Chess();
    try {
      return new Chess(startFen);
    } catch {
      log.warn("fen_at_ply", `buildFenAtPly: invalid startFen="${startFen}" — falling back to initial position`);
      return new Chess();
    }
  })();

  const limit: number = Math.min(Math.max(ply, 0), sanMoves.length);
  for (let i = 0; i < limit; i += 1) {
    const san: string = String(sanMoves[i] ?? "").trim();
    if (!san) continue;
    if (san === "--") {
      try {
        game.move("--");
      } catch {
        log.warn("fen_at_ply", `buildFenAtPly: null move rejected at ply=${i + 1}`);
        break;
      }
      continue;
    }
    const moved: Move | null = applySanWithFallback(game, san);
    if (!moved) {
      log.warn("fen_at_ply", `buildFenAtPly: SAN replay failed at ply=${i + 1} san="${san}"`);
      break;
    }
  }
  return game.fen();
};
