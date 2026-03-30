---
section: DB
area: SQLite .x2chess database
---

## Key source files
- `resource/database/` — DB schema and migration runner
- `resource/adapters/` — DB adapter (create, read, write records)
- `resource/domain/metadata_schema.ts` — metadata field types (text, number, date, select, flag, game_link)
- `resource/io/` — DbGateway, FsGateway, path_utils
- `frontend/src/components/MetadataSchemaEditor.tsx` — schema editor dialog
- `frontend/src/components/MetadataFieldInput.tsx` — per-field input in game-info strip
- `frontend/src/components/GamePickerDialog.tsx` — game picker for `game_link` fields
- `frontend/src/components/ResourceMetadataDialog.tsx` — resource metadata dialog
- `dev/plans/database_resource_2e8f4c91.plan.md` — SQLite `.x2chess` resource (Phase 1+5)
- `dev/plans/metadata_definition_system_d1e2f3a4.plan.md` — metadata types, dialog, export/import

## Checklist

- [ ] **DB-1** — Menu → New database creates a `.x2chess` file and opens it in the viewer.
- [ ] **DB-2** — Menu → Open database opens an existing `.x2chess` file.
- [ ] **DB-3** — Saving a game into a DB resource creates or updates the record.
- [ ] **DB-4** — Schema editor in the resource viewer allows adding/removing metadata fields.
- [ ] **DB-5** — Custom metadata fields (text, number, date, select, flag, game_link) appear in the game-info strip.
- [ ] **DB-6** — Conflict on save (stale revision token) shows a clear error rather than silently failing.
- [ ] **DB-7** — Importing a position game (PGN with `[SetUp "1"]` and `[FEN "..."]`) into a `.x2chess` DB creates a `Material` row in the metadata; the value is visible in the resource viewer.
- [ ] **DB-8** — Adding a field in the schema editor with type `game_link` saves successfully and the type is preserved when reopening the editor.
- [ ] **DB-9** — A `game_link` field in the game-info strip shows "None" and a "Pick…" button when empty; clicking "Pick…" opens the Game Picker dialog populated with games from the same resource.
- [ ] **DB-10** — Selecting a game in the picker closes the dialog and displays the game's label (White vs Black, or the record ID if headers are absent) as a chip; the dirty flag is set.
- [ ] **DB-11** — With a value set, the "Pick…" button reads "Change…"; clicking it re-opens the picker and replacing the selection updates the chip.
- [ ] **DB-12** — Clicking the × button on a `game_link` chip clears the value; the chip disappears and the dirty flag is set.
