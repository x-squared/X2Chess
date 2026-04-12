# `features/sessions/hooks`

Hooks for session-owned workflows.

Important files:

- `useGameIngress.ts`: incoming PGN/URL/file ingress flow used by the shell.

Keep session-specific side effects here instead of embedding them in `AppShell`.

Session feature hooks.

Contains hooks for session ingress and other session-specific interaction flows exposed to the shell or feature UI.
