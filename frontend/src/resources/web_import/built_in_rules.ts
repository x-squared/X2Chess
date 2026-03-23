/**
 * built_in_rules — Built-in web import rule registry (data only, no logic).
 *
 * Integration API:
 * - `BUILT_IN_RULES` — array of `WebImportRule` objects; consumed by `rule_registry.ts`.
 *
 * Configuration API:
 * - Rules are pure data. To override a rule, add a user rule with the same `id`.
 *
 * Communication API:
 * - No I/O, no side effects.
 */

import type { WebImportRule } from "./web_import_types";

/**
 * Built-in web import rules shipped with the app.
 *
 * Rules are matched in array order; the first URL pattern match wins.
 * More-specific patterns should appear before more-general ones.
 */
export const BUILT_IN_RULES: WebImportRule[] = [
  // ── Tier 1 — browser fetch (JSON/PGN API) ──────────────────────────────────

  {
    id: "lichess-puzzle",
    label: "Lichess puzzle",
    urlPattern: "^https?://lichess\\.org/training/([a-zA-Z0-9]+)",
    strategy: "api",
    fetchUrl: "https://lichess.org/api/puzzle/$1",
    responseType: "json.pgn",
    fieldPaths: { pgn: "game.pgn" },
  },

  {
    id: "lichess-game",
    label: "Lichess game",
    // Negative lookahead prevents matching known non-game path prefixes like /training/.
    urlPattern: "^https?://lichess\\.org/(?!training/)([a-zA-Z0-9]{8})",
    strategy: "api",
    fetchUrl: "https://lichess.org/game/export/$1?evals=false&clocks=false",
    responseType: "pgn",
    requestHeaders: { Accept: "application/x-chess-pgn" },
  },

  {
    id: "chessdotcom-daily-puzzle",
    label: "Chess.com daily puzzle",
    urlPattern: "^https?://(www\\.)?chess\\.com/(puzzles|daily-chess-puzzle)",
    strategy: "api",
    fetchUrl: "https://api.chess.com/pub/puzzle",
    responseType: "json.fen+pgn",
    fieldPaths: { title: "title" },
  },

  {
    id: "chessdotcom-game",
    label: "Chess.com live game",
    urlPattern: "^https?://(www\\.)?chess\\.com/game/(live|daily)/([0-9]+)",
    strategy: "api",
    fetchUrl: "https://api.chess.com/pub/game/$3",
    responseType: "json.pgn",
    fieldPaths: { pgn: "pgn" },
  },

  {
    id: "direct-pgn",
    label: "Direct PGN file URL",
    urlPattern: "\\.pgn(\\?.*)?$",
    strategy: "direct",
    responseType: "pgn",
  },

  // ── Tier 2 — Tauri native HTTP + HTML parsing ──────────────────────────────
  // (Requires strategy "native-html"; rule_fetcher.ts handles this in Phase W2.)

  {
    id: "chesspuzzle-net",
    label: "chesspuzzle.net puzzle",
    urlPattern: "^https?://chesspuzzle\\.net/Puzzle/([0-9]+)",
    strategy: "native-html",
    fetchUrl: "https://chesspuzzle.net/Puzzle/$1",
    responseType: "html.extract",
    requestHeaders: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    htmlExtract: [
      { type: "css-attr", selector: "[data-fen]", attribute: "data-fen" },
      { type: "script-regex", pattern: "fen\\s*[=:]\\s*['\"]([^'\"]{10,})['\"]" },
      { type: "script-regex", pattern: "\"fen\"\\s*:\\s*\"([^\"]{10,})\"" },
    ],
  },
];
