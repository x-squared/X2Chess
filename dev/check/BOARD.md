---
section: BOARD
area: Chess board rendering and move entry
---

## Key source files
- `frontend/src/components/ChessBoard.tsx` — board component
- `frontend/src/board/move_lookup.ts` — legal move calculation and highlighting
- `frontend/src/board/move_position.ts` — position state management
- `frontend/src/board/move_hints.ts` — destination dot hints
- `frontend/src/board/board_shapes.ts` — `[%csl]`/`[%cal]` overlay shapes
- `frontend/src/components/PromotionPicker.tsx` — pawn promotion dialog
- `frontend/src/components/DisambiguationDialog.tsx` — ambiguous move dialog
- `dev/plans/move_entry_game_editing_b3c4d5e6.plan.md` — move entry, variation forks, truncation, dirty flag
- `dev/plans/board_shapes_3f4a5b6c.plan.md` — square highlights and arrows
- `dev/plans/move_hints_hover_d4e5f6a7.plan.md` — hover legal-move dots

## Checklist

- [ ] **BOARD-1** — Clicking a piece highlights it and shows legal move targets.
- [ ] **BOARD-2** — Clicking a legal target plays the move and updates the PGN.
- [ ] **BOARD-3** — Pawn promotion: a picker appears; selecting a piece completes the promotion.
- [ ] **BOARD-4** — Ambiguous move (two pieces can reach same square): a disambiguation dialog appears.
- [ ] **BOARD-5** — Entering a move in a position that already has a next move: a dialog asks New variation / Replace / Cancel.
- [ ] **BOARD-6** — Flip board button (↕) mirrors the board orientation.
- [ ] **BOARD-7** — Hint button highlights the next move on the board.
- [ ] **BOARD-8** — Illegal move attempt: piece snaps back; no move is added.
- [ ] **BOARD-9** — Last move is highlighted with a subtle tint after navigation.
