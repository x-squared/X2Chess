# `platform/desktop`

Desktop runtime adapters for the Tauri application.

Important subdirectories:

- `tauri/`: direct Tauri IPC/runtime wrappers (FS/DB gateways, devtools helper).
- `storage/`: desktop-only storage helpers such as webview-storage import/export support.

- `tauri_ipc_bridge.ts`: minimal `tauriInvoke` / `isTauri` for features that must stay isolated from `@tauri-apps/*` imports (uses the same `invoke` resolution as `tauri/tauri_gateways.ts`).
- `tauri_engine_adapter.ts`: Tauri-backed `EngineProcess` for UCI engines (`spawn_engine` / stdout events); keeps `parts/engines` free of Tauri.

When a module needs Tauri IPC, native file access, or other desktop-only behavior, it should usually enter through this package rather than importing `@tauri-apps/*` from a feature or service.

Governance: **`dev/rules/tauri-ipc-bridge.mdc`** — application code uses `tauri_ipc_bridge.ts` (and gateways here), not raw `@tauri-apps/api/core` invoke in features.
