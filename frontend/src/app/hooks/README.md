# `app/hooks`

This package contains hooks that are app-wide rather than feature-specific.

Important files:

- `useTranslator.ts`: builds the `t(key, fallback?)` helper used across shell and feature UI.
- `useUpdateCheck.ts`: app-level update availability state used by the shell banner and menu.

Use these hooks from app shell components or shared UI that truly depends on app-wide context. Do not add feature-owned hooks here; those belong under the relevant `features/*/hooks` package.

App-scoped hooks.

Contains hooks that are global to application startup or app-wide behavior rather than feature-specific workflows. If a hook is owned by one feature, move it into that feature package instead.
