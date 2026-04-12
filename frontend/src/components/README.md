# `components`

This package is the home for genuinely shared UI components that are not owned by one feature package.

Important subdirectories:

- `anchors/`: anchor dialogs, pickers, and lists shared by editor/resource flows.
- `badges/`: annotation badges such as QA, todo, eval, train, link, and anchor badges.
- `board/`: shared board UI like `ChessBoard`, hover preview, and move dialogs.
- `dialogs/`: reusable dialogs such as game picker, new game, annotate game, and edit-start-position.

If a component is only meaningful for one feature, it should live in that feature package instead. This package is for reusable UI building blocks that are consumed by multiple parts of the app shell.

This package now contains the genuinely shared React UI that is reused across feature boundaries: badges, board UI, anchor dialogs, and general-purpose dialogs. Feature-owned panels and shells have moved out; new code should only live here when it is truly cross-feature presentation.
