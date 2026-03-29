---
section: NEWGAME
area: New Game dialog
---

## Key source files
- `frontend/src/components/NewGameDialog.tsx` — dialog implementation
- `frontend/src/components/EditStartPositionDialog.tsx` — custom FEN / Chess960 picker
- `frontend/src/components/MiniBoard.tsx` — position preview inside dialog
- `dev/plans/new_game_setup_e5f6a7b8.plan.md` — New Game dialog design (standard / custom FEN, castling, Chess960)

## Checklist

- [ ] **NEWGAME-1** — Menu → New Game opens the dialog.
- [ ] **NEWGAME-2** — Tab 1 (Starting position): Standard radio creates a game from the opening position.
- [ ] **NEWGAME-3** — Tab 1 (Starting position): Custom FEN radio enables the FEN input; valid FEN is accepted.
- [ ] **NEWGAME-4** — Tab 1 (Starting position): Invalid FEN shows an inline error and blocks Confirm.
- [ ] **NEWGAME-5** — Tab 1 (Starting position): Chess960 checkbox enables position picker; chosen position is shown on the mini-board.
- [ ] **NEWGAME-6** — Tab 2 (Game info): White, Black, Event, Date, Result fields are editable.
- [ ] **NEWGAME-7** — Confirm creates the game with correct headers; Cancel closes without changes.
