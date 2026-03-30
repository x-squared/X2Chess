---
section: SAVE
area: Saving games
---

## Key source files
- `resource/client/api.ts` — canonical resource client (save/update record)
- `resource/adapters/` — file, directory, and DB adapters
- `frontend/src/state/actions.ts` — `SAVE_GAME` action
- `frontend/src/hooks/createAppServices.ts` — save service wiring
- `dev/plans/database_resource_2e8f4c91.plan.md` — DB save path and conflict handling

## Checklist

- [ ] **SAVE-1** — Cmd/Ctrl+S saves the active game to its source (file or DB record).
- [ ] **SAVE-2** — Save button in the toolbar saves and clears the dirty flag.
- [ ] **SAVE-3** — Auto-save mode: a change is persisted automatically after a short delay.
- [ ] **SAVE-4** — Manual mode: no auto-save; dirty flag persists until explicit save.
- [ ] **SAVE-5** — Saving a game that has no source yet prompts for a location.
