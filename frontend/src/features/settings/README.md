# `features/settings`

The settings feature owns dialogs and panels for user-adjustable preferences.

Important subdirectories:

- `components/`: settings UI such as editor-style, default-layout, and external-database dialogs/panels.
- `hooks/`: settings-specific React hooks when needed.
- `services/`: framework-free settings helpers.

Persisted preference storage itself usually lives in `runtime/`; this feature package owns the UI that edits those preferences.

Settings feature package.

Owns settings dialogs and settings-focused UI surfaces. Keep app-wide preferences UX here, while the underlying preference storage and contracts live in `core`, `runtime`, or `platform`.
