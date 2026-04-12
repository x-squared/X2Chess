# `components/board`

Shared board UI components and supporting styles.

Important files:

- `ChessBoard.tsx`: the main board component used by shell, training, and analysis surfaces.
- hover preview and move-dialog support files, plus related CSS such as `HoverPreview.css` and `move_dialogs.css`.

This package should stay focused on reusable board presentation and interaction. Feature workflows should consume these components rather than reimplementing board UI.

Board UI components.

Contains React components tied to board rendering and board interaction. Shared board state calculation should remain in `board/`, while this package focuses on presentation and input handling.
