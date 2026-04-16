# `features/editor/model`

Framework-free editor model helpers.

Important files:

- `game_info.ts`: PGN header normalization, player-name helpers, and game-info field definitions.
- `fen_utils.ts`: FEN validation and related utilities.
- `pgn_validation.ts`: strict/normalized/fallback PGN diagnostics for Developer Dock quality reporting.
- `history.ts` and `pgn_runtime.ts`: editor/runtime capabilities and history integration.
- `resolveAnchors.ts`: anchor discovery from editor comments.
- `text_editor_plan.ts` and `plan/`: plain/text/tree editor plan generation.
- `tree_numbering.ts`, `comment_url_utils.ts`: supporting editor utilities.

Use this package when you need editor behavior without React. It is the right place for reusable PGN-editing logic that does not belong in global model code.

Editor feature model logic.

Contains framework-free editor logic such as PGN runtime helpers, history, anchor resolution, and text-plan generation. Modules here should remain React-free.
