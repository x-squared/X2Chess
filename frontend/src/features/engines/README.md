# engines — UCI engine registry UI

Boundary: React components and helpers for **configured engines** (paths, UCI overrides), wired through `useEngineConfig` and desktop IPC where needed.

## Important modules

| Module | Role |
|--------|------|
| `components/EngineManagerPanel.tsx` | Modal to add/remove/configure engines. |
| `components/EngineConfigDialog.tsx` | Per-engine name + UCI option table (autosave). |
| `engine_option_help.ts` | Static + composed tooltip copy for well-known UCI options (`?` chips). |
| `host_hardware_hints.ts` | Pure heuristics (RAM/CPU → suggested Hash MB / thread count). |
| `load_host_hardware_snapshot.ts` | Loads host snapshot: Tauri `host_hardware_summary` when available, else `navigator`. |
| `resolve_discovered_uci_options.ts` | Maps cached UCI option lists to an engine row (same-path fallback for copies). |

Desktop builds expose **`host_hardware_summary`** (Rust + `sysinfo`) for accurate total RAM; the browser uses `navigator.hardwareConcurrency` and, when present, `navigator.deviceMemory` (coarse GiB steps).

New **`#[tauri::command]`** handlers must be added to **`frontend/src-tauri/permissions/app-commands.toml`** or desktop **`invoke`** calls (browse executable, auto-detect, save registry) fail at runtime under Tauri 2 ACL.

## Ownership

Engine protocol logic stays under `parts/engines/`; this folder is GUI + persistence orchestration only.
