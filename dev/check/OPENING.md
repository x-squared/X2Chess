---
section: OPENING
area: Opening explorer
---

## Key source files
- `frontend/src/components/OpeningExplorerPanel.tsx` — opening explorer panel
- `dev/plans/resource_ext_databases_a1b2c3d4.plan.md` — external game/opening/endgame database integration

## Checklist

- [ ] **OPENING-1** — Toggle in the board panel shows/hides the opening explorer.
- [ ] **OPENING-2** — Explorer fetches data for the current position from Lichess (or Masters).
- [ ] **OPENING-3** — Clicking a move in the explorer plays it on the board.
- [ ] **OPENING-4** — Source toggle (Lichess / Masters) switches the data source.
- [ ] **OPENING-5** — Explorer shows "no data" gracefully for positions outside the book.
