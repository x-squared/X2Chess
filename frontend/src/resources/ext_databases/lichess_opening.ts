/**
 * lichess_opening — Lichess opening explorer adapter (E1).
 *
 * Fetches from the Lichess opening explorer API:
 *   https://explorer.lichess.ovh/masters?fen=...
 *   https://explorer.lichess.ovh/lichess?fen=...
 *
 * Integration API:
 * - `LICHESS_OPENING_ADAPTER` — singleton adapter instance.
 *
 * Configuration API:
 * - No API key required. Rate-limited to ~5 req/s by Lichess.
 *
 * Communication API:
 * - Pure async fetch; no side effects beyond network requests.
 */

import type {
  OpeningDatabaseAdapter,
  OpeningMove,
  OpeningResult,
  OpeningQueryOptions,
} from "./opening_types";

// ── Lichess API response types ────────────────────────────────────────────────

type LichessOpeningMove = {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
};

type LichessOpeningResponse = {
  white: number;
  draws: number;
  black: number;
  moves: LichessOpeningMove[];
  opening?: { name?: string } | null;
};

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = new Map<string, OpeningResult | null>();

const cacheKey = (fen: string, options: OpeningQueryOptions): string =>
  `${options.source}:${fen}:${(options.speeds ?? []).join(",")}:${(options.ratings ?? []).join(",")}`;

// ── Adapter implementation ────────────────────────────────────────────────────

const fetchOpening = async (
  fen: string,
  options: OpeningQueryOptions,
): Promise<OpeningResult | null> => {
  const key = cacheKey(fen, options);
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const params = new URLSearchParams({ fen });
    if (options.source === "lichess") {
      if (options.speeds?.length) params.set("speeds", options.speeds.join(","));
      if (options.ratings?.length) params.set("ratings", options.ratings.map(String).join(","));
    }

    const baseUrl =
      options.source === "masters"
        ? "https://explorer.lichess.ovh/masters"
        : "https://explorer.lichess.ovh/lichess";

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      cache.set(key, null);
      return null;
    }

    const data: LichessOpeningResponse = await response.json() as LichessOpeningResponse;
    const totalGames = (data.white ?? 0) + (data.draws ?? 0) + (data.black ?? 0);

    if (totalGames === 0) {
      cache.set(key, null);
      return null;
    }

    const moves: OpeningMove[] = (data.moves ?? []).map((m: LichessOpeningMove) => ({
      uci: m.uci,
      san: m.san,
      white: m.white,
      draws: m.draws,
      black: m.black,
      averageRating: m.averageRating,
    }));

    const result: OpeningResult = {
      totalGames,
      white: data.white ?? 0,
      draws: data.draws ?? 0,
      black: data.black ?? 0,
      moves,
      openingName: data.opening?.name,
    };

    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
};

export const LICHESS_OPENING_ADAPTER: OpeningDatabaseAdapter = {
  id: "lichess",
  label: "Lichess",
  query: fetchOpening,
};
