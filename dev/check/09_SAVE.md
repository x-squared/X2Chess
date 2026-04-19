---
section: SAVE
area: Saving games
---

## Key source files
- `resource/client/api.ts` — canonical resource client (save/update record)
- `resource/adapters/` — file, directory, and DB adapters
- `frontend/src/core/services/createAppServices.ts` — `ensureSourceForActiveSession`, save wiring
- `frontend/src/features/sessions/services/session_persistence.ts` — persist / first-save → create record
- `frontend/src/resources/source_picker_adapter.ts` — directory path + `save_game_file` invoke
- `frontend/src/state/actions.ts` — `SAVE_GAME` action
- `dev/plans/database_resource_2e8f4c91.plan.md` — DB save path and conflict handling

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **SAVE-1** — Cmd/Ctrl+S saves the active game to its source (file or DB record).
- [ ] **SAVE-2** — Save button in the toolbar saves and clears the dirty flag.
- [ ] **SAVE-3** — Auto-save mode: a change is persisted automatically after a short delay.
- [ ] **SAVE-4** — Manual mode: no auto-save; dirty flag persists until explicit save.
- [ ] **SAVE-5** — Saving a game that has no source yet creates a record in the **active resource tab** (folder/DB opens in the Resource viewer); there is no separate save-as folder dialog.
- [ ] **SAVE-6** — Each **new** game tab saved into a directory gets its own `.pgn` filename (derived from headers and session id), not a single repeated `imported-game.pgn` overwrite.
