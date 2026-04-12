# `platform/desktop/storage`

Desktop-only storage helpers.

Important files:

- `webview_storage_gateway.ts`: import/export bridge for desktop webview storage snapshots used by app startup and session orchestration.

Keep desktop-specific storage transport here. Higher-level storage flows should depend on this through `core` services or gateway contracts.

Desktop storage adapters.

Contains desktop-specific storage gateways, such as Tauri-backed webview storage import and export helpers.
