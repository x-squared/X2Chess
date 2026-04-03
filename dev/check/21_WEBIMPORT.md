---
section: WEBIMPORT
area: Web import (paste or drop a URL to fetch a game/position)
---

## Key source files
- `frontend/src/components/WebImportBrowserPanel.tsx` — web import browser panel
- `frontend/src/components/WebImportRulesPanel.tsx` — OTA rules management dialog
- `frontend/src/game_sessions/ingress_handlers.ts` — URL paste/drop entry point
- `dev/plans/web_import_5f6a7b8c.plan.md` — rule-based URL adapter design
- `dev/plans/ota_updates_8d9e0f1a.plan.md` — OTA rules server (data-only update channel)

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **WEBIMPORT-1** — Paste `https://lichess.org/<8-char-id>` opens the full game PGN.
- [ ] **WEBIMPORT-2** — Paste `https://lichess.org/training/<puzzleId>` opens the puzzle game PGN.
- [ ] **WEBIMPORT-3** — Paste `https://www.chess.com/puzzles` opens today's Chess.com daily puzzle.
- [ ] **WEBIMPORT-4** — Paste `https://www.chess.com/game/live/<id>` opens the game PGN.
- [ ] **WEBIMPORT-5** — Paste a direct `.pgn` URL fetches and opens the file.
- [ ] **WEBIMPORT-6** — Paste `https://chesspuzzle.net/Puzzle/<id>` extracts and opens the FEN (Tauri/desktop only).
- [ ] **WEBIMPORT-7** — Pasting an unrecognised URL shows an error message with a clipboard fallback hint.
- [ ] **WEBIMPORT-8** — Dropping a URL string (text/plain drag) onto the app panel triggers the same import flow.
- [ ] **WEBIMPORT-9** — Pasting a URL into a text input field (PGN editor, comment) does NOT trigger import.
- [ ] **WEBIMPORT-10** — After pasting a URL, the remote rules manifest is fetched at startup and cached in `localStorage` under `x2chess.webImportRules.v1`.
- [ ] **WEBIMPORT-11** — If the remote rules version is higher than cached, the updated rule file is fetched and replaces the cache.
- [ ] **WEBIMPORT-12** — Rules fetched from the server take effect for URL matching without a page reload.
- [ ] **WEBIMPORT-13** — Menu → "Web Import Rules…" opens the rules dialog.
- [ ] **WEBIMPORT-14** — Built-in rules are shown read-only at the bottom of the dialog.
- [ ] **WEBIMPORT-15** — "+ Add rule" opens a JSON editor; saving a valid rule appends it to the user rules list.
- [ ] **WEBIMPORT-16** — Edit (✎) button opens the JSON editor pre-filled; saving updates the rule.
- [ ] **WEBIMPORT-17** — Delete (×) removes a user rule from the list and from localStorage.
- [ ] **WEBIMPORT-18** — ↑/↓ buttons reorder user rules; order is reflected in URL matching.
- [ ] **WEBIMPORT-19** — "Test URL" input + button: known URL shows extracted PGN/FEN preview; unknown URL shows "No rule matches".
- [ ] **WEBIMPORT-20** — User rules take precedence over built-ins when IDs collide (tested via Test URL).
