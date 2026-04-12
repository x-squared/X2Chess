# `core/state`

This package is the canonical import surface for app-store contracts used outside the reducer package.

Important files:

- `app_reducer.ts`: re-exports `AppStoreState`, `initialAppStoreState`, and reducer-owned snapshot types.
- `actions.ts`: re-exports the `AppAction` union.
- `selectors.ts`: re-exports the typed selector functions used by shell, services, and tests.

Use `core/state` when higher-level code needs the app-store surface without depending on the historical `state/` package layout directly.
