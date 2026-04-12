# `platform/desktop/tauri`

Canonical direct-Tauri adapter package.

Important files:

- `tauri_gateways.ts`: runtime detection (`isTauriRuntime`), `TauriWindowLike`, and gateway builders such as `buildTauriFsGateway` and `buildTauriDbGateway`.

This is where raw Tauri runtime access belongs. If another package needs a Tauri command or runtime probe, prefer adding a focused adapter here and consuming it indirectly rather than reaching into `window.__TAURI__` from feature code.
