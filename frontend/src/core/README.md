# `core`

`core/` is the coordination layer between app composition and feature/runtime code. It should explain how the frontend hangs together without becoming the place where raw platform APIs leak upward.

Important subdirectories:

- `contracts/`: service contracts and shared capability types such as `AppStartupServices`.
- `model/`: cross-cutting registries such as `ui_ids.ts` (`UI_IDS` for every `data-ui-id` in the tree).
- `services/`: orchestration and service factories such as `createAppServices.ts` and `session_orchestrator.ts`.
- `state/`: canonical re-export surface for store contracts/selectors used by app and services.

Use this package for cross-feature orchestration, app-facing service surfaces, and capability contracts. Keep direct Tauri calls in `platform/`, and keep feature-specific logic in `features/`.
