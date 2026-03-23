# Web Import Plan — Positions and Games from Chess Websites

**File:** `web_import_5f6a7b8c.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Allow the user to drop or paste a URL from a chess website into X2Chess and
have the app automatically extract the position (FEN) or full game (PGN) and
open it as a new game session — identically to dragging in a `.pgn` file today.

The system is **rule-based**: each supported site is described by a JSON rule
object, not hardcoded logic. Users can add or edit rules for sites that are not
built in, without touching code.

---

## URL detection trigger

URLs are detected in the same paste/drop flow that already handles PGN text:

1. User pastes or drops a string onto the app.
2. The ingress handler (`game_sessions/ingress_handlers.ts`) currently checks
   `isLikelyPgnText()`. Add a prior check: `isUrl(input)`.
3. If it is a URL, dispatch `IMPORT_FROM_URL` action rather than the PGN
   import path.
4. `useWebImport` hook resolves the URL via the rule registry and dispatches
   the result (FEN or PGN) back through the normal import path.

---

## Fetch tiers

Not all sites are equal. Three tiers of extraction, applied in order of
complexity:

### Tier 1 — JSON API (no scraping)
Sites with public, CORS-friendly JSON APIs (Lichess, Chess.com). Uses the
existing browser `fetch()`. Clean and reliable.

### Tier 2 — Native HTTP + HTML parsing
Sites that block browser-User-Agent requests or have no JSON API. The app
routes the request through a **Tauri Rust command** (`native_http_get`) which:
- Makes the request from the OS network stack (no CORS restrictions).
- Sends a realistic browser User-Agent + Accept headers.
- Returns the raw HTML response body to the frontend.
- The frontend parses it using CSS selectors or script-tag regex from the rule.

This bypasses the `403` returned to headless fetchers by sites like
chesspuzzle.net. The site's response is identical to what a browser would get
for a plain `GET` request — no JS execution required.

**Covers**: chesspuzzle.net and most traditional server-rendered chess sites.
Does **not** cover SPAs that render position data entirely in client-side JS
(no FEN in the initial HTML response).

### Tier 3 — In-app browser panel
For sites requiring login, cookie sessions, or full JS rendering. A small
WebView panel opens showing the live site. The user navigates to the puzzle or
game, then clicks **Capture**. The app injects a short JS snippet into the
WebView page that extracts position data from the live DOM and posts it back.

```
┌─────────────────────────────────────────────┐
│  ← →  chesspuzzle.net/Puzzle/904329   [✕]  │
│ ─────────────────────────────────────────── │
│                                             │
│     [live rendered chess puzzle page]       │
│                                             │
│                   [ Capture position ]      │
└─────────────────────────────────────────────┘
```

The capture JS snippet is part of the rule (a short, auditable expression):
```json
"captureScript": "document.querySelector('[data-fen]')?.getAttribute('data-fen')"
```

**Covers**: login-walled sites, fully JS-rendered SPAs, any site whatsoever —
since the user sees the page and can confirm it loaded correctly.

**Tauri feasibility**: Tauri supports multiple WebViews and
`webview.evaluate_script()`. The in-app browser is a real Tauri capability.

### Tier 0 — Clipboard fallback (always available)
If automatic import fails at any tier, a toast prompts: *"Couldn't import
automatically — copy the FEN or PGN from the page and paste it here."*
This requires zero additional code; pasting FEN/PGN already works.

---

## Rule format

Each rule is a plain JSON object. The `strategy` field selects the fetch tier;
additional fields configure extraction within that tier.

```typescript
type WebImportRule = {
  /** Unique identifier (e.g. "lichess-game"). */
  id: string;

  /** Human-readable name shown in the import UI. */
  label: string;

  /** Regex pattern matched against the pasted/dropped URL string. */
  urlPattern: string;

  /**
   * Fetch tier:
   * - "api"         — Tier 1: browser fetch to a JSON/PGN API endpoint
   * - "direct"      — Tier 1: browser fetch, response body is raw PGN/FEN
   * - "native-html" — Tier 2: Tauri native HTTP GET, parse returned HTML
   * - "webview"     — Tier 3: in-app browser panel + capture script
   */
  strategy: "api" | "direct" | "native-html" | "webview";

  /**
   * URL template for the request (Tier 1 + Tier 2).
   * Capture groups from urlPattern available as $1, $2, etc.
   */
  fetchUrl?: string;

  /**
   * How to interpret the response (Tier 1 + Tier 2):
   * - "pgn"          — response body is raw PGN text
   * - "json.pgn"     — JSON response; extract field at dot-path
   * - "json.fen"     — JSON response; extract FEN at dot-path
   * - "json.fen+pgn" — JSON response; prefer PGN, fall back to FEN
   * - "html.extract" — HTML response; use htmlExtract rules below
   */
  responseType?: "pgn" | "json.pgn" | "json.fen" | "json.fen+pgn" | "html.extract";

  /** Dot-path overrides for JSON field locations. */
  fieldPaths?: {
    fen?: string;    // default: "fen"
    pgn?: string;    // default: "pgn"
    title?: string;  // default: "title"
  };

  /** HTTP headers for the fetch request (Tier 1 + Tier 2). */
  requestHeaders?: Record<string, string>;

  /**
   * HTML extraction config (Tier 2, strategy "native-html").
   * Tried in order; first match wins.
   */
  htmlExtract?: Array<
    | { type: "css-attr";     selector: string; attribute: string }
    | { type: "css-text";     selector: string }
    | { type: "script-regex"; pattern: string }
    | { type: "meta";         name: string }
  >;

  /**
   * JS expression evaluated in the WebView page (Tier 3, strategy "webview").
   * Must return a FEN or PGN string, or null.
   * Keep short and auditable — this is shown to the user in the rule editor.
   */
  captureScript?: string;
};
```

---

## Built-in rule registry

Shipped with the app. All rules are pure data — no code per site.

### Lichess game (Tier 1)

```json
{
  "id": "lichess-game",
  "label": "Lichess game",
  "urlPattern": "^https?://lichess\\.org/([a-zA-Z0-9]{8})",
  "strategy": "api",
  "fetchUrl": "https://lichess.org/game/export/$1?evals=false&clocks=false",
  "responseType": "pgn",
  "requestHeaders": { "Accept": "application/x-chess-pgn" }
}
```

### Lichess puzzle (Tier 1)

```json
{
  "id": "lichess-puzzle",
  "label": "Lichess puzzle",
  "urlPattern": "^https?://lichess\\.org/training/([a-zA-Z0-9]+)",
  "strategy": "api",
  "fetchUrl": "https://lichess.org/api/puzzle/$1",
  "responseType": "json.pgn",
  "fieldPaths": { "pgn": "game.pgn" }
}
```

(The Lichess puzzle API returns the full source game PGN. The puzzle starts
partway through; a future enhancement can auto-navigate to `puzzle.initialPly`.)

### Chess.com daily puzzle (Tier 1)

```json
{
  "id": "chessdotcom-daily-puzzle",
  "label": "Chess.com daily puzzle",
  "urlPattern": "^https?://(www\\.)?chess\\.com/(puzzles|daily-chess-puzzle)",
  "strategy": "api",
  "fetchUrl": "https://api.chess.com/pub/puzzle",
  "responseType": "json.fen+pgn",
  "fieldPaths": { "title": "title" }
}
```

### Chess.com game (Tier 1)

```json
{
  "id": "chessdotcom-game",
  "label": "Chess.com live game",
  "urlPattern": "^https?://(www\\.)?chess\\.com/game/(live|daily)/([0-9]+)",
  "strategy": "api",
  "fetchUrl": "https://api.chess.com/pub/game/$3",
  "responseType": "json.pgn",
  "fieldPaths": { "pgn": "pgn" }
}
```

### chesspuzzle.net (Tier 2 — native HTTP + HTML parsing)

```json
{
  "id": "chesspuzzle-net",
  "label": "chesspuzzle.net puzzle",
  "urlPattern": "^https?://chesspuzzle\\.net/Puzzle/([0-9]+)",
  "strategy": "native-html",
  "fetchUrl": "https://chesspuzzle.net/Puzzle/$1",
  "responseType": "html.extract",
  "requestHeaders": {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  },
  "htmlExtract": [
    { "type": "css-attr",     "selector": "[data-fen]",    "attribute": "data-fen" },
    { "type": "script-regex", "pattern": "fen\\s*[=:]\\s*['\"]([^'\"]{10,})['\"]" },
    { "type": "script-regex", "pattern": "\"fen\"\\s*:\\s*\"([^\"]{10,})\"" }
  ]
}
```

(The exact HTML structure of chesspuzzle.net is unconfirmed — the `htmlExtract`
array tries multiple patterns in order, first match wins. Needs validation once
Tier 2 is implemented.)

### Direct PGN URL (Tier 1)

```json
{
  "id": "direct-pgn",
  "label": "Direct PGN file URL",
  "urlPattern": "\\.pgn(\\?.*)?$",
  "strategy": "direct",
  "responseType": "pgn"
}
```

---

## Site coverage summary

| Site | Tier | Method |
|---|---|---|
| Lichess games | 1 | Public PGN export API |
| Lichess puzzles | 1 | Public puzzle API |
| Chess.com daily puzzle | 1 | Public puzzle API |
| Chess.com games | 1 | Public game API |
| Direct `.pgn` URLs | 1 | Direct fetch |
| chesspuzzle.net | 2 | Native HTTP + HTML parsing |
| Chess Tempo | 2 | Native HTTP + HTML parsing (rule TBD) |
| ChessBase | 3 | In-app browser (JS-rendered SPA) |
| chess24 / login-walled sites | 3 | In-app browser (user logs in) |
| Any other site | 0 | Clipboard fallback |

For blocked sites, the fallback is: the user copies the FEN from the site and
pastes it directly (already works via the PGN paste path if the text is a FEN
string or PGN).

---

## User-editable rules

The app ships with a `config/web-import-rules.json` file (empty array by
default). Rules defined there are merged with the built-in registry and take
precedence on `id` collision. This allows:

- Overriding a built-in rule (e.g. to change an API endpoint that moved).
- Adding a new site rule for any site with a simple JSON API.
- No app update required.

The **Settings → Web Import** panel (in the menu or a dedicated settings area)
provides a simple editor for this file, showing current rules and allowing
add/edit/delete.

---

## Module layout

```
frontend/src/
├── resources/
│   └── web_import/
│       ├── web_import_types.ts    # WebImportRule, WebImportResult types
│       ├── rule_registry.ts       # Built-in rules + merging with user rules
│       ├── rule_matcher.ts        # Match a URL → WebImportRule (pure)
│       ├── rule_fetcher.ts        # Execute a matched rule → FEN or PGN text
│       └── built_in_rules.ts     # The built-in rule objects (data, no logic)
└── hooks/
    └── useWebImport.ts            # React hook: detect URL, run rule, dispatch result
```

`rule_matcher.ts` and the rule type definitions are pure-logic (no I/O, no
React). `rule_fetcher.ts` uses `fetch()` as the I/O boundary (same pattern as
`lichess_opening.ts`).

---

## Import result handling

When a rule resolves to PGN text: pass through the existing
`isLikelyPgnText` → import path unchanged.

When a rule resolves to a FEN only: open the New Game dialog pre-filled with
the FEN (same as **New Game → Custom FEN**), so the user can optionally add
headers before importing.

When resolution fails (network error, parse error, no rule match): show an
inline error in a small non-blocking toast with the failure reason. The URL
remains in the clipboard so the user can try another approach.

---

## Phase plan

### Phase W1 — Tier 1: core rule engine + JSON/API import
- Define `WebImportRule`, `WebImportResult` types
- Implement `rule_matcher.ts`: regex matching, capture group extraction (pure)
- Implement `rule_fetcher.ts`: Tier 1 only (browser `fetch()`, JSON + PGN parsing)
- Implement `built_in_rules.ts` with Lichess game, Lichess puzzle, Chess.com
  puzzle, Chess.com game, direct PGN URL
- Implement `rule_registry.ts`: merge built-in + user rules
- Implement `useWebImport.ts` hook
- Modify ingress handler: URL detection → `useWebImport` → FEN or PGN import
- Error → toast with clipboard fallback prompt
- Tests: matcher for all five rules, fetcher with mocked `fetch()`

### Phase W2 — Tier 2: native HTTP + HTML parsing
- Add Tauri Rust command `native_http_get(url, headers)` → raw response body
- Extend `rule_fetcher.ts` to handle `strategy: "native-html"` via Tauri invoke
- Implement HTML extraction engine: CSS-attr, CSS-text, script-regex, meta
  (TypeScript, no external parser — regex + `DOMParser` on the HTML string)
- Add chesspuzzle.net rule; validate against live site
- Tests: HTML extraction with fixture HTML snapshots

### Phase W3 — User-editable rules UI
- Settings section: **Web Import Rules**
- Table: built-in rules (read-only), user rules (editable)
- Add/edit form for all `WebImportRule` fields
- **Test** button: enter any URL, shows resolved FEN/PGN or error inline
- Save to `config/web-import-rules.json`

### Phase W4 — Tier 3: in-app browser panel
- `WebImportBrowserPanel.tsx`: address bar, back/forward, reload, close
- Powered by a Tauri WebView with `webview.evaluate_script()` for capture
- **Capture** button: evaluates rule's `captureScript` in the page context,
  returns string result, imports via normal path
- Panel opened automatically when a URL matches a `strategy: "webview"` rule
- Accessible manually from Web Import settings for any site without a rule

---

## Future: remote rule updates

See plan `ota_updates_8d9e0f1a.plan.md` for the mechanism. The built-in rule
registry can be updated via the same rules-server channel without a full app
update — a rule change (e.g. a site moved its API endpoint) ships as a data
update, not a code update.
