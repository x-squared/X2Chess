# `core/services`

This package contains the central service factories and orchestration modules that coordinate sessions, resources, and feature behavior.

Important files:

- `createAppServices.ts`: constructs the main service bundle used at startup.
- `session_orchestrator.ts`: coordinates session updates, persistence, navigation sync, and app-state dispatch.

These modules are high-value architecture files. They should depend on contracts and canonical feature/platform modules, not on legacy bridges or raw Tauri imports.

Core orchestration services.

Contains the service factories and orchestrators that connect state, features, and platform capabilities. These modules should coordinate behavior without directly owning runtime transport details.
