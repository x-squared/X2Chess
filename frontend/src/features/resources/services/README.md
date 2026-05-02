# `features/resources/services`

Framework-free support code for the resource feature and for editor/resource annotation parsing.

Important files:

- parser modules: `anchor_parser.ts`, `eval_parser.ts`, `link_parser.ts`, `qa_parser.ts`, `todo_parser.ts`, `train_tag_parser.ts`
- `schema_storage.ts`: localStorage persistence and import/export validation for metadata schemas
- `viewer_utils.ts`: shared types and helper functions used by the resource viewer UI
- `game_rendering.ts`: game rendering profile (GRP) — `resolveDisplay`, `renderSessionTabGrpText`, `buildRenderedGameMap` (compact+detail merge for table Game column and tabs); pass schema `fields` so select-type rule conditions match case-insensitively (PGN vs saved rule values)
- `resource_event_matching.ts`: shared resource-identity matching helpers used by viewer/hooks after mutation events
- `resource_live_refresh.ts`: shared guard logic for event-driven live refresh in explorer/search flows
- `resource_tab_refresh.ts`: helper that computes affected resource tab IDs for mutation events
- `resource_metadata_prefs.ts`: resource metadata preference helpers
- `index.ts`: feature-level resource viewer capability exports

These files are used by both resource UI and editor annotation flows. Keep them framework-free and parser-oriented; feature UI state belongs in hooks/components.
