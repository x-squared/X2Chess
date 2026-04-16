---
section: OPEN
area: Opening games (file drop, paste, resource viewer)
---

## Key source files
- `frontend/src/features/sessions/services/ingress_handlers.ts` — drop/paste/open entry points
- `frontend/src/resources/source_gateway.ts` — I/O gateway (file open, Tauri invoke)
- `frontend/src/app/startup/useAppStartup.ts` — wires ingress handlers on startup
- `frontend/src/features/resources/components/ResourceViewer.tsx` — "open from resource row" path
- `frontend/src/core/services/session_orchestrator.ts` — opens games into sessions/tabs
- `resource/client/api.ts` — canonical resource client used to load PGN records

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [x] **OPEN-1** — Dragging a `.pgn` file onto the app panel opens the game.
- [!] **OPEN-2** — Pasting PGN text (Cmd/Ctrl+V outside any input) opens the game.
  > No, there is no recognizable reaction.
- [!] **OPEN-3** — Pasting a FEN string opens the position in a new game (SetUp header applied).
  > No. I tried the followeing string and there was no reaction: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
- [!] **OPEN-4** — Using Menu → Open file / Open folder opens the resource picker.
  > There is no such menu-item, and we do not need it. Opening happens only through the {ui-id: panel.resources} viewer.
- [ ] **OPEN-5** — Opening a game from a resource row creates a new session tab and keeps the previously active tab as inactive (not removed).
- [!] **OPEN-6** — When a game is shown in the editor, the {ui-id: editor.pane} does not increase in length even for a long game. Instead scrolling is shown in the {ui-id: editor.pane}.
  > A long game will cause a very tall {ui-id: editor.pane}, pushing everything below towards the bottom border of the window..
