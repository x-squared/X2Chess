# `model`

Shared chess/PGN model helpers that are broader than a single feature.

Important files include general PGN header helpers, study-item derivation, and other model utilities reused by editor, shell, and training code.

- **`fen_sanitization.ts`** — canonical `sanitizeSetupFen` / `sanitizeEnginePositionForUci` for New Game setup, engine analysis, and any code that must not persist impossible `KQkq` castling tokens relative to the board.

Use this package for framework-free model logic that is not specifically editor-owned.

Shared domain-facing helpers for the frontend.

Use this package for framework-free logic that is reused across features but still belongs to the frontend app layer rather than `parts/`. Modules here should stay free of React and DOM dependencies.
