# `features/editor/components`

UI components for PGN editing and editor support surfaces.

Most important components:

- `PgnTextEditor.tsx`: main rich editor surface.
- `GameInfoEditor.tsx`: PGN header editing UI.
- `MovesPanel.tsx`, `TextEditorSidebar.tsx`, `RawPgnPanel.tsx`, `AstPanel.tsx`
- `PgnEditorPreview.tsx`: read-only preview surface reused by settings dialogs.

These components should consume hooks/model helpers from the editor feature and avoid duplicating parsing or annotation logic inline.

Canonical editor UI components.

Contains the PGN editor, game-info editor, move panels, and other editor-facing React components. Editor composition should live here instead of the legacy `components/game_editor` bridge.
