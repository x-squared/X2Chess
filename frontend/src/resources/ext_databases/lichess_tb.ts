/**
 * lichess_tb — Lichess tablebase adapter (E2).
 *
 * Probes the Lichess 7-piece Syzygy tablebase via REST API:
 *   https://tablebase.lichess.ovh/standard?fen=...
 *
 * No API key required. Rejects positions with > 7 pieces automatically.
 *
 * Integration API:
 * - `LICHESS_TB_ADAPTER` — singleton adapter instance.
 *
 * Configuration API:
 * - No API key required.
 *
 * Communication API:
 * - Pure async fetch; no side effects beyond network requests.
 */

import { Chess } from "chess.js";
import type { EndgameTbAdapter, TbProbeResult, TbWdl, TbMoveEntry, TbLineMove, TbMainLine } from "./endgame_types";

// ── Lichess API response types ────────────────────────────────────────────────

type LichessTbMove = {
  uci: string;
  san: string;
  zeroing: boolean;
  checkmate: boolean;
  stalemate: boolean;
  insufficient_material: boolean;
  wdl: number | null;     // 2=win, 1=cursed_win, 0=draw, -1=blessed_loss, -2=loss
  dtz: number | null;
  dtm: number | null;
};

type LichessTbResponse = {
  wdl: number | null;
  dtz: number | null;
  dtm: number | null;
  insufficient_material: boolean;
  moves: LichessTbMove[];
};

// ── In-memory caches ─────────────────────────────────────────────────────────

const cache     = new Map<string, TbProbeResult | null>();
const lineCache = new Map<string, TbMainLine | null>();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a FEN string for use as a cache key.
 *
 * Strips the half-move clock and full-move number: they do not affect
 * tablebase results, so the same position reached via different game
 * histories maps to a single cache entry.
 */
const normalizeFen = (fen: string): string => {
  const p = fen.split(" ");
  return `${p[0] ?? ""} ${p[1] ?? "w"} ${p[2] ?? "-"} ${p[3] ?? "-"} 0 1`;
};

/** Apply a UCI move to a FEN and return the resulting FEN, or null on failure. */
const applyUci = (fen: string, uci: string): string | null => {
  try {
    const chess = new Chess(fen);
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return chess.fen();
  } catch {
    return null;
  }
};

/** Pick the tablebase-optimal move for the side to move. */
const pickBestMove = (result: TbProbeResult): TbMoveEntry | null => {
  const winning = result.moves
    .filter((m) => m.wdl === "win" || m.wdl === "cursed_win")
    .sort((a, b) => (a.dtz ?? 999) - (b.dtz ?? 999));
  if (winning.length > 0) return winning[0] ?? null;

  const drawing = result.moves.filter((m) => m.wdl === "draw" || m.wdl === "blessed_loss");
  if (drawing.length > 0) return drawing[0] ?? null;

  const losing = result.moves
    .filter((m) => m.wdl === "loss")
    .sort((a, b) => (b.dtz ?? 0) - (a.dtz ?? 0));
  if (losing.length > 0) return losing[0] ?? null;

  // Fallback: Lichess API returns wdl: null (mapped to "unknown") for some positions.
  // Take any move rather than silently producing an empty line.
  return result.moves[0] ?? null;
};

const wdlFromNumber = (n: number | null): TbWdl => {
  switch (n) {
    case 2:  return "win";
    case 1:  return "cursed_win";
    case 0:  return "draw";
    case -1: return "blessed_loss";
    case -2: return "loss";
    default: return "unknown";
  }
};

/** Count pieces in a FEN string (does not count kings). */
const pieceCount = (fen: string): number => {
  const board = fen.split(" ")[0] ?? "";
  let count = 0;
  for (const ch of board) {
    if (/[a-zA-Z]/.test(ch)) count++;
  }
  return count;
};

// ── Adapter implementation ────────────────────────────────────────────────────

const probe = async (fen: string): Promise<TbProbeResult | null> => {
  if (pieceCount(fen) > 7) return null;

  const key = normalizeFen(fen);
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const params = new URLSearchParams({ fen });
    const response = await fetch(
      `https://tablebase.lichess.ovh/standard?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      cache.set(key, null);
      return null;
    }

    const data: LichessTbResponse = await response.json() as LichessTbResponse;

    const moves: TbMoveEntry[] = (data.moves ?? []).map((m: LichessTbMove) => ({
      uci: m.uci,
      san: m.san,
      wdl: wdlFromNumber(m.wdl),
      dtz: m.dtz ?? undefined,
      dtm: m.dtm ?? undefined,
      zeroing: m.zeroing,
      checkmate: m.checkmate || undefined,
      stalemate: m.stalemate || undefined,
    }));

    const result: TbProbeResult = {
      wdl: wdlFromNumber(data.wdl),
      dtz: data.dtz ?? undefined,
      dtm: data.dtm ?? undefined,
      moves,
      insufficientMaterial: data.insufficient_material || undefined,
    };

    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
};

/**
 * Follow optimal play from both sides to build a main-line continuation.
 *
 * Each half-move is fetched via `probe` (cached), and the resulting position
 * is computed with chess.js. The line is itself cached by the normalised root
 * FEN so subsequent calls for the same position are synchronous.
 */
const probeLine = async (fen: string, maxDepth = 6): Promise<TbMainLine | null> => {
  if (pieceCount(fen) > 7) return null;

  const key = normalizeFen(fen);
  if (lineCache.has(key)) return lineCache.get(key) ?? null;

  const parts = fen.split(" ");
  const startColor: "w" | "b" = parts[1] === "b" ? "b" : "w";

  const moves: TbLineMove[] = [];
  let terminal: TbMainLine["terminal"];
  let currentFen = fen;

  for (let i = 0; i < maxDepth; i++) {
    const result = await probe(currentFen);
    if (!result) break;

    const best = pickBestMove(result);
    if (!best) break;

    moves.push({ san: best.san, uci: best.uci, wdl: best.wdl, dtz: best.dtz });

    if (best.checkmate)  { terminal = "mate";      break; }
    if (best.stalemate)  { terminal = "stalemate"; break; }

    const next = applyUci(currentFen, best.uci);
    if (!next) break;
    currentFen = next;
  }

  const line: TbMainLine = { moves, startColor, terminal };
  lineCache.set(key, line);
  return line;
};

export const LICHESS_TB_ADAPTER: EndgameTbAdapter = {
  id: "lichess_tb",
  label: "Lichess Tablebase",
  maxPieces: 7,
  probe,
  probeLine,
};
