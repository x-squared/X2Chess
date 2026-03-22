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

import type { EndgameTbAdapter, TbProbeResult, TbWdl, TbMoveEntry } from "./endgame_types";

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

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = new Map<string, TbProbeResult | null>();

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  // Reject positions with more than 7 pieces.
  if (pieceCount(fen) > 7) return null;

  const key = fen;
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

export const LICHESS_TB_ADAPTER: EndgameTbAdapter = {
  id: "lichess_tb",
  label: "Lichess Tablebase",
  maxPieces: 7,
  probe,
};
