# `state`

This package contains the reducer-based React app store and the legacy import surface that still backs many parts of the frontend.

Important files:

- `app_reducer.ts`: defines `AppStoreState`, reducer snapshot types, and `initialAppStoreState`.
- `actions.ts`: the `AppAction` discriminated union dispatched into the reducer.
- `selectors.ts`: typed selectors used by shell components, services, and tests.
- `app_context.tsx`: context accessors for reducer state.
- `ServiceContext.tsx`: compatibility export surface for app services.

How it is used:

- `app/providers/AppStateProvider.tsx` installs the reducer store.
- shell components read state through `useAppContext()` and selectors.
- `core/services/session_orchestrator.ts` and `hooks/session_state_sync.ts` mirror active-session state into reducer actions.

This package is still canonical for the reducer implementation, but higher-level code should usually import through `core/state` where practical.
