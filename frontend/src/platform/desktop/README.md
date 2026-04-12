# `platform/desktop`

Desktop runtime adapters for the Tauri application.

Important subdirectories:

- `tauri/`: direct Tauri IPC/runtime wrappers.
- `storage/`: desktop-only storage helpers such as webview-storage import/export support.

When a module needs Tauri IPC, native file access, or other desktop-only behavior, it should usually enter through this package rather than importing `@tauri-apps/*` from a feature or service.
