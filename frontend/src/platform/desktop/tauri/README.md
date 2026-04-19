# `platform/desktop/tauri`

Canonical direct-Tauri adapter package.

Important files:

- `tauri_gateways.ts`: runtime detection (`isTauriRuntime`), `TauriWindowLike`, and gateway builders such as `buildTauriFsGateway` and `buildTauriDbGateway`. IPC uses `@tauri-apps/api/core` `invoke` (same bridge as `picker_fs_helpers`), not only `window.__TAURI__.core.invoke`, so sidecar/fs/db paths work when the webview exposes `__TAURI_INTERNALS__` without the global `__TAURI__` object.

This is where raw Tauri runtime access belongs. If another package needs a Tauri command or runtime probe, prefer adding a focused adapter here and consuming it indirectly rather than reaching into `window.__TAURI__` from feature code.
