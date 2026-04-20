---
section: NAV
area: Board navigation
---

## Key source files
- `frontend/src/board/navigation.ts` — step/jump navigation logic
- `frontend/src/board/index.ts` — board module public API
- `frontend/src/components/ToolbarRow.tsx` — nav toolbar buttons (←, →, |←, →|)
- `frontend/src/state/app_reducer.ts` — `NAVIGATE` actions
- `parts/pgnparser/src/pgn_headers.ts` — PGN normalization for chess.js navigation replay
- `dev/plans/move_entry_game_editing_b3c4d5e6.plan.md` — navigation and variation fork design

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

## ---------- Completed -----------------------------------------

- [x] **NAV-1** — ← / → toolbar buttons step one move backward/forward.
- [x] **NAV-2** — |← / →| toolbar buttons jump to start/end.
- [x] **NAV-3** — Left/Right arrow keys navigate when the board or editor is focused.
- [x] **NAV-4** — Clicking a move token in the text editor navigates to that move.
- [x] **NAV-5** — Clicking a move in a variation navigates into the variation (board preview if off-mainline).
- [x] **NAV-6** — PGNs with `XSqrChessStyle` / `XSqrChessBoardOrientation` headers (and transitional `XTwoChessStyle` / `XTwoChessBoardOrientation`, legacy `X2Style` / `X2BoardOrientation`) still allow move-click navigation and board updates.
