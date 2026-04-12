# `platform`

This package contains runtime and environment adapters. Its job is to isolate desktop/backend/browser transport details from `app`, `core`, and `features`.

Important subdirectories:

- `desktop/`: Tauri-specific adapters and desktop-only storage helpers.

Use this package whenever code would otherwise call platform APIs directly. Features and orchestration should prefer capability interfaces over raw transport details.
