---
section: ENGINE
area: Engine analysis panel
---

## Key source files
- `frontend/src/components/AnalysisPanel.tsx` — analysis panel UI
- `frontend/src/components/HoverPositionPopup.tsx` — PV-move hover mini-board popup
- `dev/plans/engines_integration_e5f6a7b8.plan.md` — UCI engine integration design

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
