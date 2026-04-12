# `features/editor`

The editor feature owns PGN editing, move text rendering, game-info editing, anchor/comment workflows, and editor-specific model logic.

Important subdirectories:

- `components/`: editor UI such as `PgnTextEditor`, `MovesPanel`, `GameInfoEditor`, and `PgnEditorPreview`.
- `hooks/`: dialog and interaction hooks such as `useMoveEntry`, `useQaDialog`, `useTodoDialog`, and anchor/link/train helpers.
- `model/`: editor-owned model helpers such as FEN utilities, game-info normalization, runtime capabilities, history, anchor resolution, and text/tree plan generation.
- `styles.css`: shared editor styling imported by the app root.

This is the canonical home for editor behavior. New editor code should go here, not in the removed top-level `editor/` facade.

Editor feature package.

Owns PGN editing UI, editor hooks, editor models, and editor-specific services. Keep text editing behavior, move editing flows, and annotation tooling centered here.
