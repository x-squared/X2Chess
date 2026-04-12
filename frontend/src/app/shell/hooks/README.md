# `app/shell/hooks`

This package contains hooks that are specific to shell layout and interaction, not to a user-facing feature.

Important files:

- `useBoardColumnResize.ts`: manages dragging of the board/editor splitter and writes the `--board-column-width` CSS variable.

Only add hooks here when they are truly shell-specific. If a hook belongs to editor, sessions, resources, or training behavior, keep it in the feature package instead.

Shell-scoped hooks.

Use this package for hooks that are specific to shell layout and shell interaction concerns, such as panel sizing or shell-only UI behavior.
