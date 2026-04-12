# `resources/ext_databases`

External chess database and service adapters shared by analysis and resource search features.

Important files:

- `lichess_opening.ts`, `lichess_tb.ts`, `lichess_games.ts`
- `chessdotcom_games.ts`
- supporting result/type files such as `opening_types.ts`, `endgame_types.ts`, and `game_db_types.ts`

These modules provide typed adapters and result shapes; UI should consume them indirectly through feature hooks and panels.

External chess database integration types and helpers.

Use this package for integrations with external opening, endgame, or related databases that are shared across the frontend. Feature-specific UI for these integrations belongs in `features/analysis` or `features/resources`.
