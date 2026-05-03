---
section: ENGINE
area: Engine analysis panel
---

## Key source files
- `frontend/src/features/analysis/components/AnalysisPanel.tsx` — analysis panel UI
- `frontend/src/features/analysis/pv_move_tokens.ts` — PGN-style numbering for PV lines
- `frontend/src/components/board/HoverPositionPopup.tsx` — PV-move hover mini-board popup
- `frontend/src/features/engines/components/EngineManagerPanel.tsx` — manage configured engines (toolbar, list, add/configure area)
- `frontend/src-tauri/src/main.rs` — `detect_engines` / `host_hardware_summary` (desktop IPC)
- `frontend/src/features/engines/components/EngineConfigDialog.tsx` — per-engine UCI options (embedded fills pane below list, or modal)
- `frontend/src/features/engines/resolve_discovered_uci_options.ts` — same-path UCI option cache fallback (copied engines)
- `dev/plans/engines_integration_e5f6a7b8.plan.md` — UCI engine integration design

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **ENGINE-1** — Menu → Engine: selecting an engine executable starts analysis.
- [ ] **ENGINE-2** — Analysis panel shows top variations updating in real time.
- [ ] **ENGINE-3** — Stop button halts analysis; panel retains the last result.
- [ ] **ENGINE-4** — Navigating to a different move restarts analysis for the new position.
- [ ] **ENGINE-5** — "Find best move" mode plays the engine's top suggestion on the board.
- [ ] **ENGINE-6** — Hovering over an individual move within a PV line shows a floating mini-board with the position after that PV move.
- [ ] **ENGINE-7** — The PV hover popup reflects the correct position computed by replaying the PV from the current board position.
- [ ] **ENGINE-8** — Moving the pointer off a PV move token dismisses the popup.
- [ ] **ENGINE-9** — With "Position preview on hover" toggled off in the menu, hovering over PV moves shows no popup.
- [ ] **ENGINE-10** — Menu → Manage engines: toolbar above the list; on open, the default analysis engine is selected and the configure panel is shown (else first engine); add form / summary appears when not configuring; selecting another engine opens its configure panel; **Configure** in the toolbar targets the current selection.
- [ ] **ENGINE-11** — Manage engines → Configure: Hash (MB), NNUE paths, and Syzygy/tablebase options appear as normal rows in the UCI table (listed near the top when the engine exposes them); edits autosave to the registry like other options—there is no separate “use default hash” toggle and no OK/Cancel row at the bottom.
- [ ] **ENGINE-12** — Analysis panel PV lines show readable spacing and correct move numbering (`1. e4 e5 2. …`, or `1…` only when Black is to move); move text does not run into the next full-move number.
- [ ] **ENGINE-13** — Desktop: Manage engines → Add → **Auto-detect** finds Stockfish when installed via Homebrew/MacPorts/PATH (typical macOS locations); at least one candidate appears when `stockfish` is on disk.
- [ ] **ENGINE-14** — Manage engines: after removing the **last** configured engine, the list shows “No engines configured”, and no Stockfish/configure strip or embedded **Configure engine** panel remains (sidecar state clears with the registry).
- [ ] **ENGINE-15** — Manage engines: **Copy** an engine that shares a path with an entry already probed (e.g. default engine after analysis): select the copy and confirm the **Configure engine** panel lists UCI options (Hash, Threads, …), not only “Displayed name” and the “start analysis once” hint—unless no engine at that path was ever probed yet.
