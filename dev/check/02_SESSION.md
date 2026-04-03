---
section: SESSION
area: Game tabs / session lifecycle
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src/components/GameTabs.tsx` — tab bar rendering
- `frontend/src/components/GameSessionsPanel.tsx` — session panel
- `frontend/src/game_sessions/session_model.ts` — session data model
- `frontend/src/game_sessions/session_store.ts` — session state store
- `frontend/src/state/app_reducer.ts` — reducer actions for tab open/close/switch
- `dev/plans/multi-source_game_refactor_9d9ff012.plan.md` — multi-source game loading design

## Checklist

- [?] **SESSION-1** — Dropping or pasting a PGN opens it in a new tab; the previously active game is preserved.
  > Fixed: tab labels now use actual PGN headers (filters out "White"/"Black"/"?" placeholders) and `preferredTitle`/`sourceRef` are forwarded from the drop handler so tabs have correct file-based titles and source association. Preservation logic unchanged — please re-verify that the prior session stays in its tab when a second file is dropped.
- [x] **SESSION-2** — Clicking a different tab switches to that game and restores its board position and PGN.
- [?] **SESSION-3** — Clicking × on a tab with unsaved changes shows a confirmation dialog; confirming closes the tab and activates the adjacent one; cancelling leaves the tab open.
  > The confirmation dialog only fires when `dirtyState === "dirty"` (i.e. after at least one edit). A freshly-dropped game that has not been edited closes without confirmation — this is intentional. The "cannot edit" report may be resolved now that `sourceRef` is forwarded on drop; please re-verify.
- [x] **SESSION-4** — Closing the last tab creates a fresh empty game (no sample moves or headers) automatically.
- [x] **SESSION-8** — A dirty (unsaved) tab shows a red pill colour and a dirty dot only — no save icon button.
- [?] **SESSION-9** — When a game is opened, the {ui-id: editor.pane} should not increase in size. Its lower border is always aligned with the lower border of the {ui-id: board.chess-board}.
  > Added `max-height: var(--board-column-width)` and `overflow: hidden` to `.board-editor-pane` in `editor/styles.css`. Please re-verify with a long game.

## ---------- Completed -----------------------------------------

- [x] **SESSION-5** — A tab with unsaved changes shows the red "unsaved" styling.
- [x] **SESSION-6** — The dirty-dot indicator appears on a tab after editing (move entry, comment, header).