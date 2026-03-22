/**
 * chessdotcom_games — Chess.com public games adapter (E7).
 *
 * Uses the Chess.com public API to fetch games for a player by month.
 * API endpoint: GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
 * Returns JSON with a `games` array; each game has embedded `pgn`.
 *
 * Integration API:
 * - `CHESSDOTCOM_GAMES_ADAPTER` — singleton adapter instance.
 *
 * Configuration API:
 * - No API key required. Rate-limited by Chess.com.
 *
 * Communication API:
 * - `search(query)` fetches the most recent month's games and filters by player/color.
 *   Pass `dateFrom` / `dateTo` to scope the months fetched.
 * - `loadGame(ref)` returns the embedded PGN directly (no second fetch needed).
 */

import type {
  GameDatabaseAdapter,
  GameSearchQuery,
  GameSearchResult,
  ExtGameEntry,
  ExtGameRef,
} from "./game_db_types";

const BASE = "https://api.chess.com/pub";

// ── Chess.com game object (subset) ─────────────────────────────────────────────

type ChessDotComPlayer = {
  username: string;
  rating?: number;
  result: string;
};

type ChessDotComGame = {
  url: string;            // e.g. "https://www.chess.com/game/live/12345678"
  pgn: string;            // full PGN text
  time_class: string;     // "bullet" | "blitz" | "rapid" | "daily"
  rules: string;          // "chess" | "chess960" | …
  white: ChessDotComPlayer;
  black: ChessDotComPlayer;
  end_time: number;       // Unix timestamp (seconds)
  eco?: string;
};

type ChessDotComMonthResponse = {
  games?: ChessDotComGame[];
};

// ── Internal helpers ────────────────────────────────────────────────────────────

/** Derive the month archive URL for a given year/month pair. */
const monthUrl = (username: string, year: number, month: number): string =>
  `${BASE}/player/${encodeURIComponent(username)}/games/${year}/${String(month).padStart(2, "0")}`;

/** Extract the "YYYY/MM" strings to fetch given optional date bounds. */
const monthsToFetch = (
  dateFrom?: string,
  dateTo?: string,
): { year: number; month: number }[] => {
  const now = new Date();
  const end = dateTo
    ? new Date(dateTo)
    : now;
  const start = dateFrom
    ? new Date(dateFrom)
    : new Date(end.getFullYear(), end.getMonth() - 1, 1); // default: last 2 months

  const months: { year: number; month: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }
  // Most recent first.
  return months.reverse();
};

const resultFromPlayers = (
  white: ChessDotComPlayer,
  black: ChessDotComPlayer,
): string => {
  if (white.result === "win") return "1-0";
  if (black.result === "win") return "0-1";
  if (["drawn", "agreed", "repetition", "stalemate", "insufficient", "50move"].includes(white.result)) {
    return "1/2-1/2";
  }
  return "*";
};

const formatDate = (unixSec: number): string => {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
};

/** Extract the last path segment of a Chess.com game URL as a stable ID. */
const gameId = (game: ChessDotComGame): string => {
  const parts = game.url.split("/");
  return `chessdotcom:${parts[parts.length - 1]}`;
};

/** Extract ECO from embedded PGN headers. */
const pgnHeader = (pgn: string, key: string): string | undefined => {
  const m = new RegExp(`\\[${key} "([^"]+)"\\]`).exec(pgn);
  return m?.[1];
};

const gameToEntry = (game: ChessDotComGame): ExtGameEntry => ({
  ref: { id: gameId(game), adapterId: "chessdotcom" },
  white: game.white.username,
  black: game.black.username,
  result: resultFromPlayers(game.white, game.black),
  event: `Chess.com ${game.time_class}`,
  date: formatDate(game.end_time),
  whiteElo: game.white.rating,
  blackElo: game.black.rating,
  eco: game.eco ?? pgnHeader(game.pgn, "ECO"),
  opening: pgnHeader(game.pgn, "Opening"),
  timeControl: pgnHeader(game.pgn, "TimeControl"),
});

// ── In-memory PGN store (so loadGame doesn't need a second fetch) ─────────────

const pgnStore = new Map<string, string>();

// ── Adapter ───────────────────────────────────────────────────────────────────

export const CHESSDOTCOM_GAMES_ADAPTER: GameDatabaseAdapter = {
  id: "chessdotcom",
  label: "Chess.com",
  supportsPositionSearch: false,

  async search(query: GameSearchQuery): Promise<GameSearchResult> {
    const username = query.player?.name?.trim();
    if (!username) return { entries: [], hasMore: false };

    const max = query.maxResults ?? 25;
    const months = monthsToFetch(query.dateFrom, query.dateTo);

    const entries: ExtGameEntry[] = [];

    for (const { year, month } of months) {
      if (entries.length >= max) break;

      let response: Response;
      try {
        response = await fetch(monthUrl(username, year, month), {
          headers: { Accept: "application/json" },
        });
      } catch {
        continue;
      }
      if (!response.ok) continue;

      const data = await response.json() as ChessDotComMonthResponse;
      const games = (data.games ?? []).reverse(); // newest first

      const colorFilter = query.player?.color ?? "any";
      const filtered = games.filter((g) => {
        if (colorFilter === "white") return g.white.username.toLowerCase() === username.toLowerCase();
        if (colorFilter === "black") return g.black.username.toLowerCase() === username.toLowerCase();
        return true;
      });

      for (const g of filtered) {
        if (entries.length >= max + 1) break;
        const entry = gameToEntry(g);
        // Cache PGN keyed by stable ID.
        pgnStore.set(entry.ref.id, g.pgn);
        entries.push(entry);
      }
    }

    const hasMore = entries.length > max;
    return { entries: entries.slice(0, max), hasMore };
  },

  async loadGame(ref: ExtGameRef): Promise<string> {
    return pgnStore.get(ref.id) ?? "";
  },
};
