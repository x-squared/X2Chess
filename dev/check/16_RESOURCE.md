---
section: RESOURCE
area: Resource viewer (game list, grouping, filtering, search)
---

## Key source files
- `frontend/src/features/resources/components/ResourceViewer.tsx` — resource viewer root component
- `frontend/src/features/resources/services/index.ts` — tab state, `refreshActiveTabRows` after save
- `frontend/src/resources/picker_fs_helpers.ts` — `resolveEffectiveGamesDirectory` aligns list path with nested `games/` folder vs tab root locator
- `frontend/src/resources/source_picker_adapter.ts` — directory PGN listing; row `metadata` uses `extractPgnMetadata(..., KNOWN_PGN_METADATA_KEYS)` so `XSqrHead` / `XSqrChessStyle` appear in the table
- `parts/resource/src/adapters/file/file_adapter.ts` — multi-game `.pgn` file resource list; same known-key projection for row metadata
- `frontend/src/features/resources/services/viewer_utils.ts` — column prefs, `insertMetadataColumnFromSchema`, reconcile
- `frontend/src/features/resources/components/ResourceToolbar.tsx` — schema chooser, Add metadata dropdown
- `frontend/src/components/CollectionExplorerPanel.tsx` — collection explorer panel
- `frontend/src/components/PositionSearchPanel.tsx` — cross-resource position search
- `frontend/src/components/GameSearchPanel.tsx` — cross-resource text search
- `frontend/src/components/ExtractPositionDialog.tsx` — position extraction dialog
- `frontend/src/components/QaBadge.tsx` — Q/A annotation badge in resource rows
- `resource/client/api.ts` — canonical resource client used to list/query records
- `parts/resource/src/domain/metadata_schema.ts` — built-in Standard PGN schema (`BUILT_IN_SCHEMA`), tag parsing
- `dev/plans/resource_viewer_ux_c2d3e4f5.plan.md` — DnD fix, filter/group, position extraction, game kind, Q/A annotations
- `dev/plans/pgn-resource-library-refactor_c8b17631.plan.md` — resource library extraction
- `dev/plans/material_key_b5c6d7e8.plan.md` — Material column for position games

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **RESOURCE-1** — Resource viewer tab/panel opens and lists games from a PGN file or `.x2chess` DB.
- [ ] **RESOURCE-2** — Clicking a game row loads it in the editor.
- [ ] **RESOURCE-3** — Group-by selector (Event, White, Black, Result, Date) regroups the list.
- [ ] **RESOURCE-4** — Filter input narrows results by the selected group-by field.
- [ ] **RESOURCE-5** — Dragging a row reorders games within the resource.
- [ ] **RESOURCE-6** — Q/A column shows the annotation badge (✓/✗/?) from the PGN.
- [ ] **RESOURCE-7** — "New game" button on the open-resource tabs row creates a blank game in that resource.
- [ ] **RESOURCE-8** — Cross-resource position search returns matching games from all open resources.
- [ ] **RESOURCE-9** — Cross-resource text search (White/Black/Event) returns matches.
- [ ] **RESOURCE-10** — Resource table headers remain left-to-right aligned with body columns while reordering, resizing, sorting, and filtering.
- [ ] **RESOURCE-11** — Group-by **Clear** button is always visible; it is disabled with no grouping and enabled once a group level is added.
- [ ] **RESOURCE-12** — With no active grouping, the toolbar explicitly shows **none** next to **Group by:**.
- [ ] **RESOURCE-13** — Opening a position-game resource (file or `.x2chess` DB) shows a `Material` column available in the column picker.
- [ ] **RESOURCE-14** — The `Material` value for a position game displays the correct key (e.g. `KQPPPvKRP`) matching the FEN header's piece count.
- [ ] **RESOURCE-15** — A standard full-game resource (no `[SetUp "1"]`) has no `Material` column in the column picker.
- [ ] **RESOURCE-16** — After saving a **new** game into the active directory resource, the resource table refreshes and shows the new file row without reopening the tab (including when games live under a nested `games/` folder vs the library root).
- [ ] **RESOURCE-17** — With more than about **seven** game rows, the list scrolls inside the resource table (sticky header + filter row); the main window still scrolls when the overall layout exceeds the viewport.
- [ ] **RESOURCE-18** — **Add metadata…** lists the full known tag set (standard PGN + X2 fields such as `XSqrChessStyle`, `Material`, `XSqrHead`) plus any header keys discovered in loaded games, **sorted alphabetically**; legacy style header names are not offered; appending a column works and persists after reload; **Source** is not in the column picker; with the built-in Standard PGN schema, added columns follow **White, Black, Result; ECO, Opening;** then the rest of the roster (defaults/reset unchanged: players + Date/Event/Result/ECO/Opening).
- [ ] **RESOURCE-19** — Each resource table column header except **Game** shows an × control; clicking it removes that column from the table (prefs persist); **Game** has no ×.
- [ ] **RESOURCE-20** — For a **folder** (or **multi-game .pgn file**) resource, after saving a game whose PGN contains `[XSqrHead "..."]`, list refresh shows that value in the `XSqrHead` column when the column is turned on (same header text as in the loaded game).
