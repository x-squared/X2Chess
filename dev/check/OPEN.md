---
section: OPEN
area: Opening games (file drop, paste, resource viewer)
---

## Key source files
- `frontend/src/game_sessions/ingress_handlers.ts` — drop/paste/open entry points
- `frontend/src/resources/source_gateway.ts` — I/O gateway (file open, Tauri invoke)
- `frontend/src/hooks/useAppStartup.ts` — wires ingress handlers on startup
- `frontend/src/components/ResourceViewer.tsx` — "open from resource row" path
- `resource/client/api.ts` — canonical resource client used to load PGN records

## Checklist

- [ ] **OPEN-1** — Dragging a `.pgn` file onto the app panel opens the game.
- [ ] **OPEN-2** — Pasting PGN text (Cmd/Ctrl+V outside any input) opens the game.
- [ ] **OPEN-3** — Pasting a FEN string opens the position in a new game (SetUp header applied).
- [ ] **OPEN-4** — Using Menu → Open file / Open folder opens the resource picker.
- [ ] **OPEN-5** — Opening a game from a resource row in the Resource Viewer loads it in the editor.
