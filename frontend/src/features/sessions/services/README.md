# `features/sessions/services`

Framework-free session feature services and state definitions.

Important files:

- `game_session_state.ts`: the canonical session state shape used by orchestration and tests.
- `session_store.ts`: open-session collection and active-session tracking.
- `session_persistence.ts`: persistence policy and save/autosave behavior.
- `session_model.ts`: session-facing model helpers.
- `ingress_handlers.ts`: incoming game open/import handling.

This package is the canonical home for session logic. Shell code should consume these services instead of reimplementing session behavior.

Canonical session service logic.

Contains per-session state models, persistence helpers, and session-store logic for multi-game workflows.
