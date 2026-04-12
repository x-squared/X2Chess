# `app/providers`

This package contains the React context providers that make app state and services available to the tree.

Important files:

- `AppStateProvider.tsx`: defines `AppProvider` and `useAppContext()` around the reducer-based app store.
- `ServiceProvider.tsx`: defines `ServiceContextProvider` and `useServiceContext()` for startup services.

Use these providers near the root of the app. New contexts should only be added here when they are genuinely app-wide; feature-local state should stay inside the feature tree.

Top-level React providers.

This package owns provider components that establish app-wide context such as app state and service access. Keep provider setup close to the composition root and avoid feature logic here.
