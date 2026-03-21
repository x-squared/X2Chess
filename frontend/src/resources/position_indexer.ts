/**
 * Frontend position indexer — chess.js-based FEN hash builder.
 *
 * Integration API:
 * - Primary export: `buildPositionIndex`.
 * - Injected into `createDbAdapter` via the `buildPositionIndex` option so
 *   the canonical resource library stays independent of chess-engine packages.
 *
 * Communication API:
 * - Pure function; no I/O.
 */

import { Chess } from "chess.js";
import type { BuildPositionIndex, PositionRecord } from "../../../resource/adapters/db/position_index";

// ── FNV-1a 32-bit hash ─────────────────────────────────────────────────────

const fnv1a32 = (str: string, offsetBasis: number): number => {
  let h = offsetBasis >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * Hash a FEN string to a 16-char hex string using two FNV-1a passes.
 * Only the first four space-separated FEN fields are hashed (piece placement,
 * side to move, castling rights, en passant), ignoring halfmove/fullmove counters.
 */
const hashFen = (fen: string): string => {
  const normalised = fen.split(" ").slice(0, 4).join(" ");
  const h1 = fnv1a32(normalised, 0x811c9dc5);
  const h2 = fnv1a32(normalised, 0x5ac3a53d);
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
};

/**
 * Build a per-ply position index from a PGN string.
 *
 * @param pgnText Raw PGN source (multi-game allowed; only the first game is indexed).
 * @returns Array of position records — one per ply, starting at ply 0; empty on parse error.
 */
export const buildPositionIndex: BuildPositionIndex = (pgnText: string): PositionRecord[] => {
  try {
    const loader = new Chess();
    loader.loadPgn(pgnText);
    const history = loader.history({ verbose: true });

    const replay = new Chess();
    const records: PositionRecord[] = [{ ply: 0, hash: hashFen(replay.fen()) }];

    for (let i = 0; i < history.length; i++) {
      replay.move(history[i]);
      records.push({ ply: i + 1, hash: hashFen(replay.fen()) });
    }

    return records;
  } catch {
    return [];
  }
};
