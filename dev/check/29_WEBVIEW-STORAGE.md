---
section: STORAGE
area: Webview storage export and import
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src-tauri/src/main.rs` — `pick_storage_export_file`, `pick_storage_import_file` Tauri commands; `X2CHESS_WEBVIEW_DATA` canonicalization fix
- `frontend/src/hooks/session_orchestrator.ts` — `exportWebviewStorage`, `importWebviewStorage` implementations
- `frontend/src/components/shell/StorageImportDialog.tsx` — selective-import modal dialog
- `frontend/src/components/shell/MenuPanel.tsx` — Export Storage / Import Storage buttons
- `frontend/src/app_shell/menu_definition.ts` — Help menu with `help.export-storage` and `help.import-storage` actions
- `frontend/src/hooks/useTauriMenu.ts` — wires the two new menu action ids to service callbacks
- `frontend/src/state/actions.ts` — `set_storage_import_pending` action
- `frontend/src/state/app_reducer.ts` — `storageImportPending` field
- `package.json` (`frontend/`) — `desktop:dev:isolated` script uses `X2CHESS_WEBVIEW_DATA`
- `doc/diy-manual.qmd` — §3 documents isolated-mode startup and `run/DEV/webview-data/`

## Checklist

- [ ] **STORAGE-1** — After launching with `npm run desktop:dev:isolated`, the directory `run/DEV/webview-data/` is no longer empty; it contains WebKit storage subdirectories (e.g. `LocalStorage/`, `IndexedDB/`) after the app has been used.

- [ ] **STORAGE-2** — In isolated mode, changing a preference (e.g. language) and restarting the app restores that preference, confirming that storage is actually being read from `run/DEV/webview-data/` and not from the OS default path.

- [ ] **STORAGE-3** — The desktop menubar contains a **Help** menu with two items: **Export Webview Storage…** and **Import Webview Storage…**.

- [ ] **STORAGE-4** — Clicking **Export Webview Storage…** (Help menu or side menu button) opens a native save dialog defaulting to `x2chess-storage.json`. After confirming, a valid JSON file is written containing all current `localStorage` key/value pairs.

- [ ] **STORAGE-5** — The exported JSON file is human-readable (pretty-printed with 2-space indentation) and contains only string values; no binary or non-string entries appear.

- [ ] **STORAGE-6** — Clicking **Import Webview Storage…** (Help menu or side menu button) opens a native open-file dialog. Cancelling the dialog does nothing (no dialog appears, no storage is changed).

- [ ] **STORAGE-7** — After selecting a valid storage JSON file, the **Import Storage Entries** dialog appears showing a checkbox list of all keys found in the file, all pre-selected.

- [ ] **STORAGE-8** — The import dialog shows a **Select all** checkbox that (a) selects all when unchecked, (b) deselects all when checked, and (c) shows an indeterminate state when some but not all keys are selected.

- [ ] **STORAGE-9** — The count label next to **Select all** updates live to reflect how many keys are currently selected (e.g. "3 / 7").

- [ ] **STORAGE-10** — Individual keys can be toggled; unchecked keys are excluded from the import.

- [ ] **STORAGE-11** — Clicking **Import Selected** writes only the checked keys to `localStorage` and closes the dialog.

- [ ] **STORAGE-12** — Clicking **Cancel** (× button or Cancel button) closes the dialog without modifying `localStorage`.

- [ ] **STORAGE-13** — The **Import Selected** button is disabled when no keys are checked.

- [ ] **STORAGE-14** — A round-trip (export → clear a known key manually in DevTools → import the exported file → re-select that key) restores the value correctly.

- [ ] **STORAGE-15** — In the browser (non-Tauri) runtime, both **Export Storage…** and **Import Storage…** buttons are visible in the side menu but are silent no-ops (no error thrown, no dialog appears).

## ---------- Completed -----------------------------------------
