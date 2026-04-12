# `features/editor/model/plan`

Low-level plan builders for the editor’s plain/text/tree rendering modes.

Important files:

- `plain_mode.ts`, `text_mode.ts`, `tree_mode.ts`: mode-specific token/block construction.
- `types.ts`: plan data structures.
- `index.ts`: shared entrypoint.

Read this package when changing how PGN/comment structures are flattened into editor display plans.

Text-plan generation for the PGN editor.

This package builds the structured editor plan used to render PGN in plain, text, and tree layouts. Keep it deterministic and UI-framework-free.
