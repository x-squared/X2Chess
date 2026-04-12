# `app/shell`

This package contains the top-level shell that composes the application’s major panels, docks, dialogs, and layout behaviors.

Important files and subdirectories:

- `components/AppShell.tsx`: the main shell component that coordinates the board/editor/resource/training surfaces.
- `components/`: shell UI such as `MenuPanel`, `RightPanelStack`, `GameTabs`, `DevDock`, and toolbar components.
- `hooks/useBoardColumnResize.ts`: shell-specific layout behavior for the board/editor splitter.
- `menu_definition.ts`: declarative desktop menu structure used by `hooks/useTauriMenu.ts`.
- `model/app_state.ts`: shell-wide constants such as default panel sizes and `PlayerRecord`.
- `fen_at_ply.ts`: shell helper for replaying positions at a selected ply.

This package is canonical for shell composition. Keep feature-specific UI out of here unless it is only meaningful as a shell integration point.

Application shell composition package.

Contains the main shell layout, shell-scoped hooks, and shell components that stitch multiple features together. Feature-specific logic should be delegated downward instead of expanding the shell package.
