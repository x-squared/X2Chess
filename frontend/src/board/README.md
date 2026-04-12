# `board`

This package contains shared board-domain helpers used by multiple features and shell components.

Important files:

- move/navigation helpers such as `navigation.ts` and `move_lookup.ts`
- shape parsing and rendering support such as `shape_parser.ts`, `board_shapes.ts`, and related board interaction helpers

Use these modules when a concern is about chessboard display, navigation, hover preview, or move-to-position mapping and is shared across editor, shell, and training flows.

Board-domain runtime helpers.

This package owns board navigation, move-position resolution, board preview support, and board integration helpers shared across the app. Keep it framework-free unless a file is explicitly UI-facing and moved into `components/board` or `ui/board`.
