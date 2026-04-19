---
section: GAMEINFO
area: Game info and metadata headers
---

## Key source files
- `frontend/src/features/editor/components/GameInfoEditor.tsx` — fold-down header editor (includes readonly XSqr head)
- `frontend/src/features/editor/model/game_info.ts` — header field defs and normalization
- `frontend/src/features/editor/model/game_info_ui_ids.ts` — stable `data-ui-id` values for game-info tooling
- `frontend/src/core/services/createAppServices.ts` — save path merges `[XSqrHead]` via `getPgnText`
- `parts/pgnparser/src/pgn_serialize.ts` — `serializeXsqrHeadMovetext`, full PGN serialization
- `parts/resource/src/domain/metadata_schema.ts` — canonical metadata field schema
- `dev/plans/metadata_definition_system_d1e2f3a4.plan.md` — metadata types, dialog, export/import design

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **GAMEINFO-5** — Open the game-info editor (▼): **XSqr head** shows readonly mainline **moves only** (selectable); after save, the saved PGN contains `[XSqrHead "..."]` matching that prefix (through the first variation or end of main line).

## ---------- Completed -----------------------------------------

- [x] **GAMEINFO-1** — Clicking a header field in the game-info strip makes it editable.
- [x] **GAMEINFO-2** — Editing White/Black/Event updates the PGN header and the session tab title.
- [x] **GAMEINFO-3** — Date field normalises partial input (e.g. "2024" → "2024.??.??").
- [x] **GAMEINFO-4** — Result field accepts only legal PGN result values (`1-0`, `0-1`, `1/2-1/2`, `*`).
