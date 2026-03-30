---
section: TB
area: Endgame tablebase
---

## Key source files
- `frontend/src/components/TablebasePanel.tsx` — tablebase panel
- `dev/plans/resource_ext_databases_a1b2c3d4.plan.md` — external game/opening/endgame database integration

## Checklist

- [ ] **TB-1** — Toggle shows/hides the tablebase panel.
- [ ] **TB-2** — For a supported endgame position, DTZ and WDL results are displayed.
- [ ] **TB-3** — Moves are ranked by DTZ (shortest win / longest resistance).
- [ ] **TB-4** — Panel shows "position not in tablebase" for unsupported material.
