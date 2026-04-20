---
section: NEWGAME
area: New Game dialog
---

## Key source files
- `frontend/src/components/dialogs/NewGameDialog.tsx` — dialog implementation (standard / custom FEN, metadata tabs)
- `frontend/src/components/dialogs/PositionSetupBoard.tsx` — board + palette for custom positions
- `dev/plans/new_game_setup_e5f6a7b8.plan.md` — New Game dialog design (standard / custom FEN, castling, Chess960)

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [?] **NEWGAME-5** — Tab 1 (Starting position): Chess960 radio enables position picker; chosen position is shown on the mini-board.
  > There is no choice to select a Chess960 position. Add such a radio button.
  >> Added a third "Chess960" radio button in the position-type toggle. Selecting it shows an SP picker (← / SP n / → / Random) and a read-only 8×8 mini-board reflecting the selected starting position. SP 518 is the standard RNBQKBNR arrangement. The chess960Fen() generator is verified against the standard algorithm (SP 0 → BBQNNRKR, SP 518 → RNBQKBNR). PGN is emitted with SetUp/FEN/Variant=Chess960 headers when confirmed.
- [ ] **NEWGAME-8** — Tab 1 (Starting position): Next to the FEN input, the info button opens FEN notation help on hover (short delay) or click; Close dismisses it.

## ---------- Completed -----------------------------------------

- [x] **NEWGAME-1** — Menu → New Game opens the dialog.
- [x] **NEWGAME-2** — Tab 1 (Starting position): Standard radio creates a game from the opening position.
- [x] **NEWGAME-3** — Tab 1 (Starting position): Custom FEN radio enables the FEN input; valid FEN is accepted.
- [x] **NEWGAME-4** — Tab 1 (Starting position): Invalid FEN shows an inline error and blocks Confirm.
- [x] **NEWGAME-6** — Tab 2 (Game info): White, Black, Event, Date, Result fields are editable.
- [x] **NEWGAME-7** — Confirm creates the game with correct headers; Cancel closes without changes.
