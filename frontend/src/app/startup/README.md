# `app/startup`

This package contains the startup lifecycle that bridges stored preferences, app services, session state, and shell wiring.

Important files:

- `useAppStartup.ts`: constructs the app services bundle, preloads persisted state, wires startup callbacks, and returns the stable service surface consumed by `AppShell`.

Read this package when you want to understand how the app boots, how services are initialized, or where startup-time persistence is restored. Keep long-lived orchestration here, not in presentational components.

Application startup lifecycle.

Owns initialization hooks and startup wiring that construct services, synchronize state, and prepare the app before the shell renders. Keep one-time boot orchestration here rather than scattering it across features.
