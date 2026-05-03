---
section: NEWGAME
area: New Game dialog
---

## Key source files
- `frontend/src/model/fen_sanitization.ts` — `sanitizeSetupFen` applied when custom/Chess960 position is confirmed or edited (valid FEN)
- `frontend/src/components/dialogs/NewGameDialog.tsx` — dialog implementation (standard / custom FEN, metadata tabs)
- `frontend/src/components/dialogs/PositionSetupBoard.tsx` — board + palette for custom positions
- `frontend/src/app/shell/components/AppShellOverlays.tsx` — renders NewGameDialog at top level; wired via `showNewGameDialog` / `onNewGameCreate` / `onCloseNewGameDialog` props
- `frontend/src/app/shell/components/MenuPanel.tsx` — global file-menu group containing the New Game entry
- `frontend/src/core/services/session_orchestrator.ts` — `newGameInActiveResource` creates the game in the active resource tab or falls back to a floating session; `openNewGameDialog` stub overridden by AppShell
- `dev/plans/new_game_setup_e5f6a7b8.plan.md` — New Game dialog design (standard / custom FEN, castling, Chess960)

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [?] **NEWGAME-5** — Tab 1 (Starting position): Chess960 radio enables position picker; chosen position is shown on the mini-board.
  > There is no choice to select a Chess960 position. Add such a radio button.
  >> Added a third "Chess960" radio button in the position-type toggle. Selecting it shows an SP picker (← / SP n / → / Random) and a read-only 8×8 mini-board reflecting the selected starting position. SP 518 is the standard RNBQKBNR arrangement. The chess960Fen() generator is verified against the standard algorithm (SP 0 → BBQNNRKR, SP 518 → RNBQKBNR). PGN is emitted with SetUp/FEN/Variant=Chess960 headers when confirmed.
- [ ] **NEWGAME-8** — Tab 1 (Starting position): Next to the FEN input, the info button opens FEN notation help on hover (short delay) or click; Close dismisses it.
- [ ] **NEWGAME-9** — Global hamburger menu: a "New game…" button appears at the top of the menu in its own group separated by a divider; clicking it closes the menu and opens the New Game dialog.
- [ ] **NEWGAME-10** — When a resource tab is active and the New Game dialog is confirmed, the game is created inside that resource and immediately opened in the editor (not just a floating unsaved session).
- [ ] **NEWGAME-11** — When no resource tab is open and the New Game dialog is confirmed, the game opens as a floating (unsaved) editor session.
- [ ] **NEWGAME-12** — Tab 1 (Custom position): enter a FEN with an impossible castling flag (e.g. White `K` without a rook on `h1`); after the field validates, the castling segment normalizes (impossible rights removed) and Confirm writes a `[FEN]` header matching the normalized line.

## ---------- Completed -----------------------------------------

- [x] **NEWGAME-1** — Menu → New Game opens the dialog.
- [x] **NEWGAME-2** — Tab 1 (Starting position): Standard radio creates a game from the opening position.
- [x] **NEWGAME-3** — Tab 1 (Starting position): Custom FEN radio enables the FEN input; valid FEN is accepted.
- [x] **NEWGAME-4** — Tab 1 (Starting position): Invalid FEN shows an inline error and blocks Confirm.
- [x] **NEWGAME-6** — Tab 2 (Game info): White, Black, Event, Date, Result fields are editable.
- [x] **NEWGAME-7** — Confirm creates the game with correct headers; Cancel closes without changes.
