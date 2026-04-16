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

- [!] **SESSION-5** — A tab with unsaved changes shows the red "unsaved" styling.
  > In save mode = manual: That is not the case, the game remains in the original blue.
- [x] **SESSION-6** — The dirty-dot indicator appears on a tab after editing (move entry, comment, header).
  > In save mode = manual: That is not the case: The dot apears, but after a few seconds it disappears again.
- [!] **SESSION-10** — On app close (browser tab close or Tauri window close), if any session has unsaved edits (`dirtyState === "dirty"`), the platform's "unsaved changes — leave anyway?" dialog appears. Confirming closes; cancelling returns to the app.
  > I have edited the empty game, and it clearly had dirty state, and yet the dialog you describe did not appear on closing.
- [!] **SESSION-11** — On next launch after a clean close, all sessions that were open are restored: their PGN content (including unsaved edits), titles, source references, layout modes, active ply, and save modes are correct. The session that was active when the app was closed is active again.
  Restoring the sedssion seems to work well. Almost too well: You slaos seem to restore unsaved edits. This is uncommon behaviour. Argue why we should keep this behaviour. Do not change yet.
- [ ] **SESSION-12** — On next launch, all resource viewer tabs that were open are restored (kind + locator), and the tab that was active is selected.
- [ ] **SESSION-13** — On first launch (no snapshot), a single blank default session is opened. No leftover resource viewer tabs appear.
- [?] **SESSION-14** — Editing the active game's `Date` header updates the date shown in its session pill immediately.
  > The active game shows a date in game info, but the session pill still shows `?`.
  >> Fixed: session-pill projection now refreshes on PGN model changes (`onPgnChange`) in addition to session-meta updates, so header edits are reflected immediately.
- [?] **SESSION-15** — Opening the same source game twice should focus the existing session tab instead of creating a duplicate tab.
  > I can open the same game twice.
  >> Fixed: session identity dedupe now uses `kind|locator|recordId` in both `openGameFromRef` and `session_store.openSession`, so repeated open requests activate the existing session.

- [?] **SESSION-2** — Clicking a different tab switches to that game and restores its board position and PGN.
  > That does not happen as a rule, it may happen, but after changing once, I could not change again.
  >> When the active session is dirty and the user clicks another tab, `navigateGuard.switchSession` calls `setPendingNavigate` and renders a confirmation dialog. The dialog was rendered with `<dialog open>` (no `showModal()`) so it appeared invisible — the switch silently failed. Fixed: dialog now uses a `ref` + `useEffect` to call `showModal()`, making it a proper visible modal overlay.
- [?] **SESSION-3** — Clicking × on a tab with unsaved changes shows a confirmation dialog; confirming closes the tab and activates the adjacent one; cancelling leaves the tab open.
  > A freshly dropped and then editied game cannot be closed, and no confirmation dialog appears. Only games that are droppen but not editied can be closed.
  >> Two bugs fixed: (1) `GameSessionsPanel.handleClose` was calling `globalThis.confirm()` for dirty sessions before calling `services.closeSession`; in Tauri `globalThis.confirm` returns `undefined` (falsy) causing a silent early return with no dialog. Removed the redundant check — dirty-state confirmation is now handled entirely by `navigateGuard.closeSession` in AppShell. (2) The AppShell confirm dialog used `<dialog open>` without `showModal()`, so it was not visible as a modal overlay; fixed alongside SESSION-2.


## ---------- Completed -----------------------------------------

- [x] **SESSION-1** — Dropping or pasting a PGN opens it in a new tab; the previously active game is preserved.
  >> Fixed: tab labels now use actual PGN headers (filters out "White"/"Black"/"?" placeholders) and `preferredTitle`/`sourceRef` are forwarded from the drop handler so tabs have correct file-based titles and source association. Preservation logic unchanged — please re-verify that the prior session stays in its tab when a second file is dropped.
- [x] **SESSION-4** — Closing the last tab creates a fresh empty game (no sample moves or headers) automatically.
- [x] **SESSION-8** — A dirty (unsaved) tab shows a red pill colour and a dirty dot only — no save icon button.
- [x] **SESSION-9** — When a game is opened, the {ui-id: editor.pane} should not increase in size. Its lower border is always aligned with the lower border of the {ui-id: board.chess-board}.
  > Added `max-height: var(--board-column-width)` and `overflow: hidden` to `.board-editor-pane` in `editor/styles.css`. Please re-verify with a long game.