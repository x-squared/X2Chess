# `features/sessions`

The sessions feature owns multi-game session behavior: session tabs, ingress, persistence, guards, and session-local model state.

Important subdirectories:

- `services/`: session store, persistence, ingress handlers, and session state definitions.
- `hooks/`: shell-facing hooks such as game ingress.
- `components/`: session-related feature UI when present.
- `guards/`: guard helpers for close/dirty-state behavior.

If code is about opening, switching, saving, or synchronizing sessions, it belongs here rather than in the shell.

Session management feature package.

Contains session hooks, guards, and session service logic for multi-game workflows. Session state transitions, persistence, and session UI behavior should converge here.
