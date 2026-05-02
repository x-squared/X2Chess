---
section: RESOURCE
area: Resource viewer (game list, grouping, filtering, search)
---

## Key source files
- `frontend/src/features/resources/components/ResourceViewer.tsx` — resource viewer root component; "New game" button calls `services.openNewGameDialog()` (dialog rendered globally in AppShell)
- `frontend/src/core/services/session_orchestrator.ts` — `newGameInActiveResource` creates a game in the active resource tab or falls back to a floating session
- `frontend/src/features/resources/components/ResourceTable.tsx` — resource table rows, grouping headers, reorder controls, and row open action wiring
- `frontend/src/features/resources/services/game_rendering.ts` — GRP resolution; `buildRenderedGameMap` merges compact + detail for tooltips, filters, and reference cells (same merge as session tabs)
- `frontend/src/features/resources/services/index.ts` — tab state and active-tab refresh capability
- `frontend/src/core/events/resource_domain_events.ts` — resource mutation event hub (`resource.resourceChanged`)
- `frontend/src/features/resources/services/resource_event_matching.ts` — resource identity matching (`kind` + `locator`) used by viewer/search/explorer subscriptions
- `frontend/src/features/resources/services/resource_live_refresh.ts` — shared guard rules for event-driven live refresh
- `frontend/src/features/resources/services/resource_tab_refresh.ts` — computes affected tabs and reload plans from resource mutation events
- `frontend/src/resources/picker_fs_helpers.ts` — `resolveEffectiveGamesDirectory` aligns list path with nested `games/` folder vs tab root locator
- `frontend/src/resources/source_picker_adapter.ts` — directory PGN listing; row `metadata` uses `extractPgnMetadata(..., KNOWN_PGN_METADATA_KEYS)` so `Head` / `XSqrChessStyle` appear in the table
- `parts/resource/src/adapters/file/file_adapter.ts` — multi-game `.pgn` file resource list; same known-key projection for row metadata
- `frontend/src/features/resources/services/viewer_utils.ts` — column prefs, `reconcileColumns`, `rowPrimaryRecordId`, `insertMetadataColumnFromSchema`, `listAddableMetadataFields`
- `frontend/src/features/resources/components/ResourceToolbar.tsx` — schema chooser, Arrange columns, Add metadata dropdown
- `frontend/src/features/resources/components/ResourceColumnOrderDialog.tsx` — modal column reorder (↑/↓)
- `frontend/src/features/resources/resource_column_labels.ts` — shared header labels for table + column-order dialog
- `frontend/src/components/CollectionExplorerPanel.tsx` — collection explorer panel
- `frontend/src/features/resources/search/PositionSearchPanel.tsx` — cross-resource position search panel (manual trigger + live refresh support)
- `frontend/src/features/resources/search/TextSearchPanel.tsx` — cross-resource text search panel (manual trigger + live refresh support)
- `frontend/src/features/resources/search/GameSearchPanel.tsx` — external game search/import panel
- `frontend/src/components/dialogs/GamePickerDialog.tsx` — searchable game picker dialog used by metadata/game-link reference fields
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
- [ ] **RESOURCE-5** — Clicking row `▲/▼` controls reorders games within the resource and the table updates immediately.
- [ ] **RESOURCE-6** — Q/A column shows the annotation badge (✓/✗/?) from the PGN.
- [ ] **RESOURCE-7** — "New game" button on the open-resource tabs row creates a blank game in that resource.
- [ ] **RESOURCE-8** — Cross-resource position search returns matching games from all open resources.
- [ ] **RESOURCE-9** — Cross-resource text search (White/Black/Event) returns matches.
- [ ] **RESOURCE-10** — Resource table headers remain left-to-right aligned with body columns while reordering, resizing, sorting, and filtering.
- [ ] **RESOURCE-29** — **Arrange columns…** opens the column-order dialog; ↑/↓ changes order and **Apply** persists; dragging by the header handle (⠿) dims the source column and highlights the drop target under the cursor.
- [ ] **RESOURCE-11** — Group-by **Clear** button is always visible; it is disabled with no grouping and enabled once a group level is added.
- [ ] **RESOURCE-12** — With no active grouping, the toolbar explicitly shows **none** next to **Group by:**.
- [ ] **RESOURCE-13** — Opening a position-game resource (file or `.x2chess` DB) shows a `Material` column available in the column picker.
- [ ] **RESOURCE-14** — The `Material` value for a position game displays the correct key (e.g. `KQPPPvKRP`) matching the FEN header's piece count.
- [ ] **RESOURCE-15** — A standard full-game resource (no `[SetUp "1"]`) has no `Material` column in the column picker.
- [ ] **RESOURCE-16** — After saving a **new** game into the active directory resource, the resource table refreshes and shows the new file row without reopening the tab (including when games live under a nested `games/` folder vs the library root).
- [ ] **RESOURCE-17** — With more than about **seven** game rows, the list scrolls inside the resource table (sticky header + filter row); the main window still scrolls when the overall layout exceeds the viewport.
- [ ] **RESOURCE-18** — **Add metadata…** lists the full known tag set (standard PGN + X2 fields such as `XSqrChessStyle`, `Material`, `Head`) plus any header keys discovered in loaded games, **sorted alphabetically**; legacy style header names are not offered; appending a column works and persists after reload; **Source** is not in the column picker; with the built-in Standard PGN schema, added columns follow **White, Black, Result; ECO, Opening;** then the rest of the roster (defaults/reset unchanged: players + Date/Event/Result/ECO/Opening).
- [ ] **RESOURCE-19** — Each resource table column header (including **Game ID**) shows an × control; clicking it removes that column from the table (prefs persist). With **Game ID** removed, **Add metadata…** offers **Game ID** at the top to restore it; row **▲/▼** move to the first visible column when reordering is available.
- [ ] **RESOURCE-20** — For a **folder** (or **multi-game .pgn file**) resource, after saving a game whose PGN contains `[Head "..."]`, list refresh shows that value in the `Head` column when the column is turned on (same header text as in the loaded game).
- [ ] **RESOURCE-21** — With **Position Search** results visible, saving/reordering a game in one of the searched resources refreshes the result list automatically (without pressing Search again).
- [ ] **RESOURCE-22** — With **Text Search** results visible for a non-empty query, saving/reordering a game in one of the searched resources refreshes the result list automatically (without pressing Search again).
- [ ] **RESOURCE-23** — Resource table rows show no extra leading disclosure triangle; only row-reorder controls (`▲`/`▼`) appear at the start of the row when reordering is available.
- [ ] **RESOURCE-24** — Clicking **Delete game** in the resource tab-strip row arms an inline confirmation; clicking **Confirm delete** deletes the currently active resource-backed game (DB resources), closes that session tab, and refreshes the affected resource table; clicking **Cancel** aborts without changes.
- [ ] **RESOURCE-25** — In **Game Search**, clicking **Search** with an empty **Player** keeps the request bounded by blocking provider calls and shows a clear validation error that this source requires the player's name.
- [ ] **RESOURCE-26** — In the game picker dialog, single-clicking a row only changes selection highlight; the referenced game is applied only after **Select**, `Enter`, or double-clicking a row; **Cancel** and `Esc` both close the dialog.
- [ ] **RESOURCE-27** — With a schema GRP that defines line 1 on **Table/compact** and line 2 (or a field such as `Head`) only on **Full/detail**, hovering the **Game ID** icon (or the sort header) shows the full id **and** both rendered lines in the tooltip; filter text for that column still includes the merged GRP string for search; click the cell icon copies the id.
- [ ] **RESOURCE-28** — The **Game ID** column shows a **#** icon; sort/group on that key use the id string; click copies id to the clipboard.
- [ ] **RESOURCE-30** — With a custom schema, you can order columns arbitrarily (e.g. **Opening** before **White**); order matches **Arrange columns…** and prefs after reload.
