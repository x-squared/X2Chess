# `resources`

This package contains shared resource infrastructure that is broader than the user-facing resource feature UI.

Important files and subdirectories:

- `source_gateway.ts`: high-level source/resource gateway used by app services.
- `source_picker_adapter.ts`: desktop/browser picker logic and resource target creation.
- `source_types.ts`: source adapter contracts used across resource flows.
- `picker_fs_helpers.ts`: filesystem and picker compatibility helpers.
- `position_indexer.ts`: position indexing helpers used by resource search.
- `player_store_service.ts`, `runtime_config_service.ts`, `open_url.ts`
- `ext_databases/`: adapters and types for lichess/chess.com openings, tablebases, and game search.
- `web_import/`: lower-level web-import matching, fetching, extraction, and persistence helpers.

Feature-facing resource UI belongs in `features/resources`. This package is for infrastructure and shared integrations.
