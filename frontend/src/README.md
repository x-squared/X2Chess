# `frontend/src`

This is the frontend application root for X2Chess. A new developer should orient themselves around four canonical packages first:

- `app/`: React entrypoints, providers, startup wiring, and shell composition.
- `core/`: shared contracts, orchestration services, and state-facing adapters that coordinate features.
- `platform/`: runtime-specific adapters, currently mostly Tauri desktop integrations.
- `features/`: user-facing feature packages such as editor, resources, sessions, training, and settings.

Important remaining top-level support packages:

- `components/`: genuinely shared UI building blocks such as badges, dialogs, anchors, and board widgets.
- `resources/`: lower-level resource infrastructure and web-import helpers consumed by resource features and some analysis code.
- `training/`: deeper training domain/protocol implementation that is still shared across multiple UI surfaces.
- `runtime/`, `storage/`, `state/`, `services/`: persistence, app-store, and migration-era support packages.

When adding new code, start by deciding whether it belongs in a feature package, in the app shell, or in a platform adapter. Avoid adding new top-level buckets unless the code is clearly cross-feature and not runtime-specific.
