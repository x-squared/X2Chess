---
section: GAMEINFO
area: Game info and metadata headers
---

## Key source files
- `frontend/src/components/GameInfoEditor.tsx` — editable header strip
- `frontend/src/app_shell/game_info.ts` — game-info helper functions
- `frontend/src/components/MetadataFieldInput.tsx` — individual metadata field inputs
- `resource/domain/metadata_schema.ts` — canonical metadata field schema
- `dev/plans/metadata_definition_system_d1e2f3a4.plan.md` — metadata types, dialog, export/import design

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **GAMEINFO-1** — Clicking a header field in the game-info strip makes it editable.
- [ ] **GAMEINFO-2** — Editing White/Black/Event updates the PGN header and the session tab title.
- [ ] **GAMEINFO-3** — Date field normalises partial input (e.g. "2024" → "2024.??.??").
- [ ] **GAMEINFO-4** — Result field accepts only legal PGN result values (`1-0`, `0-1`, `1/2-1/2`, `*`).
