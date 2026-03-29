---
section: SESSION
area: Game tabs / session lifecycle
---

## Key source files
- `frontend/src/components/GameTabs.tsx` — tab bar rendering
- `frontend/src/components/GameSessionsPanel.tsx` — session panel
- `frontend/src/game_sessions/session_model.ts` — session data model
- `frontend/src/game_sessions/session_store.ts` — session state store
- `frontend/src/state/app_reducer.ts` — reducer actions for tab open/close/switch
- `dev/plans/multi-source_game_refactor_9d9ff012.plan.md` — multi-source game loading design

## Checklist

- [ ] **SESSION-1** — Opening a second game (drop/paste) creates a new tab; the first game is preserved.
- [ ] **SESSION-2** — Clicking a different tab switches to that game and restores its board position and PGN.
- [ ] **SESSION-3** — Clicking × on a tab closes it; adjacent tab becomes active.
- [ ] **SESSION-4** — Closing the last tab creates a fresh empty game automatically.
- [ ] **SESSION-5** — A tab with unsaved changes shows the red "unsaved" styling.
- [ ] **SESSION-6** — The dirty-dot indicator appears on a tab after editing (move entry, comment, header).
- [ ] **SESSION-7** — Clicking a game-link chip in the PGN editor opens the linked game in a new tab without closing the current tab.
