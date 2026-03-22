/**
 * lichess_games — Lichess.org game export adapter (E5).
 *
 * Uses the Lichess public API to search for games by a player username.
 * API endpoint: GET https://lichess.org/api/games/user/{username}
 * Returns NDJSON (newline-delimited JSON) when using `Accept: application/x-ndjson`.
 *
 * Integration API:
 * - `LICHESS_GAMES_ADAPTER` — singleton adapter instance.
 *
 * Configuration API:
 * - No API key required for public games.
 * - Rate-limited by Lichess (~2 req/s for unauthenticated requests).
 *
 * Communication API:
 * - `search(query)` streams up to `maxResults` games, returns `GameSearchResult`.
 * - `loadGame(ref)` fetches PGN for a single game by ID.
 */

import type {
  GameDatabaseAdapter,
  GameSearchQuery,
  GameSearchResult,
  ExtGameEntry,
  ExtGameRef,
} from "./game_db_types";

const BASE = "https://lichess.org";

// ── NDJSON row type (partial Lichess game object) ────────────────────────────

type LichessPlayer = {
  user?: { name?: string };
  name?: string;
  rating?: number;
  aiLevel?: number;
};

type LichessGameRow = {
  id: string;
  players?: {
    white?: LichessPlayer;
    black?: LichessPlayer;
  };
  winner?: "white" | "black";
  status?: string;
  opening?: { eco?: string; name?: string };
  createdAt?: number;     // Unix ms
  clock?: { initial?: number; increment?: number };
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const playerName = (p?: LichessPlayer): string => {
  if (!p) return "?";
  if (p.aiLevel !== undefined) return `Stockfish (level ${p.aiLevel})`;
  return p.user?.name ?? p.name ?? "?";
};

const playerElo = (p?: LichessPlayer): number | undefined =>
  p?.rating;

const gameResult = (row: LichessGameRow): string => {
  if (row.winner === "white") return "1-0";
  if (row.winner === "black") return "0-1";
  if (row.status === "draw") return "1/2-1/2";
  return "*";
};

const formatDate = (ms?: number): string => {
  if (!ms) return "????.??.??";
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
};

const formatTimeControl = (clock?: { initial?: number; increment?: number }): string | undefined => {
  if (!clock) return undefined;
  const init = clock.initial ?? 0;
  const inc = clock.increment ?? 0;
  return `${init}+${inc}`;
};

const rowToEntry = (row: LichessGameRow): ExtGameEntry => ({
  ref: { id: row.id, adapterId: "lichess" },
  white: playerName(row.players?.white),
  black: playerName(row.players?.black),
  result: gameResult(row),
  event: "Lichess",
  date: formatDate(row.createdAt),
  whiteElo: playerElo(row.players?.white),
  blackElo: playerElo(row.players?.black),
  eco: row.opening?.eco,
  opening: row.opening?.name,
  timeControl: formatTimeControl(row.clock),
});

// ── Adapter ───────────────────────────────────────────────────────────────────

export const LICHESS_GAMES_ADAPTER: GameDatabaseAdapter = {
  id: "lichess",
  label: "Lichess.org",
  supportsPositionSearch: false,

  async search(query: GameSearchQuery): Promise<GameSearchResult> {
    const username = query.player?.name?.trim();
    if (!username) return { entries: [], hasMore: false };

    const max = query.maxResults ?? 20;
    const params = new URLSearchParams({
      max: String(max + 1),      // fetch one extra to detect hasMore
      opening: "true",
      clocks: "false",
    });
    if (query.player?.color && query.player.color !== "any") {
      params.set("color", query.player.color);
    }
    if (query.dateFrom) {
      params.set("since", String(new Date(query.dateFrom).getTime()));
    }
    if (query.dateTo) {
      params.set("until", String(new Date(query.dateTo).getTime()));
    }

    const url = `${BASE}/api/games/user/${encodeURIComponent(username)}?${params.toString()}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/x-ndjson" },
      });
    } catch {
      return { entries: [], hasMore: false };
    }
    if (!response.ok) return { entries: [], hasMore: false };

    const text = await response.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    const hasMore = lines.length > max;
    const rows = lines.slice(0, max).map((line): LichessGameRow | null => {
      try { return JSON.parse(line) as LichessGameRow; } catch { return null; }
    }).filter((r): r is LichessGameRow => r !== null);

    return { entries: rows.map(rowToEntry), hasMore };
  },

  async loadGame(ref: ExtGameRef): Promise<string> {
    const url = `${BASE}/game/export/${encodeURIComponent(ref.id)}?literate=0`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: "application/x-chess-pgn" } });
    } catch {
      return "";
    }
    if (!response.ok) return "";
    return await response.text();
  },
};
