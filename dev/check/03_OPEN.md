---
section: OPEN
area: Opening games (file drop, paste, resource viewer)
---

## Key source files
- `frontend/src/features/sessions/services/ingress_handlers.ts` — drop/paste/open entry points
- `frontend/src/runtime/bootstrap_shared.ts` — `isLikelyPgnText`, `isLikelyFenText`, `fenToPgn`
- `frontend/src/resources/source_gateway.ts` — I/O gateway (file open, Tauri invoke)
- `frontend/src/app/startup/useAppStartup.ts` — wires ingress handlers on startup
- `frontend/src/features/resources/components/ResourceViewer.tsx` — "open from resource row" path
- `frontend/src/core/services/session_orchestrator.ts` — opens games into sessions/tabs
- `resource/client/api.ts` — canonical resource client used to load PGN records

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [x] **OPEN-3** — Pasting a FEN string opens the position in a new game (SetUp header applied).
  > No. I tried the following string and there was no reaction: 1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
  >> Fixed. `handlePaste` (and `handleDrop` for text) only called `openGameFromIncomingText` when `isLikelyPgnText` returned true; FEN strings fail that check and were silently dropped. Added `isLikelyFenText` and `fenToPgn` to `bootstrap_shared.ts`, and updated both `handlePaste` and `handleDrop` in `ingress_handlers.ts` to detect FEN, wrap it in a minimal PGN with `SetUp "1"` / `FEN` headers, and open it. The local `fenToPgn` copy in `useWebImport.ts` was removed in favour of the shared one.
- [x] **OPEN-5** — Opening a game from a resource row creates a new session tab and keeps the previously active tab as inactive (not removed).

## ---------- Completed -----------------------------------------

- [x] **OPEN-1** — Dragging a `.pgn` file onto the app panel opens the game.
- [x] **OPEN-2** — Pasting PGN text (Cmd/Ctrl+V outside any input) opens the game.
- [x] **OPEN-4** — Using Menu → Open file / Open folder opens the resource picker.
- [x] **OPEN-6** — When a game is shown in the editor, the {ui-id: editor.pane} does not increase in length even for a long game. Instead scrolling is shown in the {ui-id: editor.pane}.
