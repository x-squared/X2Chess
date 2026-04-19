---
section: SESSION
area: Game tabs / session lifecycle
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src/components/shell/GameTabs.tsx` — tab bar rendering
- `frontend/src/components/resource_viewer/GameSessionsPanel.tsx` — session panel (wires select/close to services)
- `frontend/src/components/shell/AppShell.tsx` — close-guard `beforeunload` handler (M9)
- `frontend/src/hooks/useNavigateGuard.ts` — dirty-state guard wrapping switchSession/closeSession
- `frontend/src/hooks/useAppStartup.ts` — workspace restore on mount
- `frontend/src/game_sessions/session_model.ts` — session data model
- `frontend/src/game_sessions/session_store.ts` — session state store
- `frontend/src/state/app_reducer.ts` — reducer actions for tab open/close/switch
- `frontend/src/runtime/workspace_snapshot_store.ts` — versioned workspace snapshot store
- `frontend/src/runtime/workspace_persistence.ts` — snapshot builder + unsaved-sessions check
- `dev/plans/multi-source_game_refactor_9d9ff012.plan.md` — multi-source game loading design

## Checklist

## ---------- Completed -----------------------------------------

- [x] **SESSION-1** — Dropping or pasting a PGN opens it in a new tab; the previously active game is preserved.
  >> Fixed: tab labels now use actual PGN headers (filters out "White"/"Black"/"?" placeholders) and `preferredTitle`/`sourceRef` are forwarded from the drop handler so tabs have correct file-based titles and source association. Preservation logic unchanged — please re-verify that the prior session stays in its tab when a second file is dropped.
- [x] **SESSION-4** — Closing the last tab creates a fresh empty game (no sample moves or headers) automatically.
- [x] **SESSION-8** — A dirty (unsaved) tab shows a red pill colour and a dirty dot only — no save icon button.
- [x] **SESSION-9** — When a game is opened, the {ui-id: editor.pane} should not increase in size. Its lower border is always aligned with the lower border of the {ui-id: board.chess-board}.
  > Added `max-height: var(--board-column-width)` and `overflow: hidden` to `.board-editor-pane` in `editor/styles.css`. Please re-verify with a long game.
- [x] **SESSION-5** — A tab with unsaved changes shows the red "unsaved" styling.
- [x] **SESSION-6** — The dirty-dot indicator appears on a tab after editing (move entry, comment, header).
- [x] **SESSION-10** — On app close (browser tab close or Tauri window close), if any session has unsaved edits (`dirtyState === "dirty"`), the platform's "unsaved changes — leave anyway?" dialog appears. Confirming closes; cancelling returns to the app.
- [x] **SESSION-11** — On next launch after a clean close, all sessions that were open are restored: their PGN content (including unsaved edits), titles, source references, layout modes, active ply, and save modes are correct. The session that was active when the app was closed is active again.
- [x] **SESSION-15** — Opening the same source game twice should focus the existing session tab instead of creating a duplicate tab.
- [x] **SESSION-2** — Clicking a different tab switches to that game and restores its board position and PGN.
- [x] **SESSION-3** — Clicking × on a tab with unsaved changes shows a confirmation dialog; confirming closes the tab and activates the adjacent one; cancelling leaves the tab open.
- [x] **SESSION-12** — On next launch, all resource viewer tabs that were open are restored (kind + locator), and the tab that was active is selected.
  >> Fixed: `handleTabSelect` and `handleTabClose` in `ResourceViewer.tsx` now call `services.selectResourceTab` / `services.closeResourceTab` so the service closure (`bundle.resourceViewer`) stays in sync with the UI. The workspace snapshot now captures the correct `activeResourceTabId` rather than always the most recently opened tab.
- [x] **SESSION-13** — On first launch (no snapshot), a single blank default session is opened. No leftover resource viewer tabs appear.
- [x] **SESSION-14** — Editing the active game's `Date` header updates the date shown in its session pill immediately.