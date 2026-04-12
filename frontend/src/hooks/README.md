# `hooks`

This is a small shared-hook package that exists only for cross-cutting hooks that are still used outside a single feature.

Important files:

- `session_state_sync.ts`: translates `GameSessionState` into reducer actions so startup and orchestration code can mirror the active session into React state.
- `useTauriMenu.ts`: installs the native desktop menu from `app/shell/menu_definition.ts` and wires menu actions to `AppStartupServices`.

This package is transitional-but-intentional: it is small on purpose. New hooks should not land here unless they are genuinely cross-feature and not better owned by `app/` or a feature package.
