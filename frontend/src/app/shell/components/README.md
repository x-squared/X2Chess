# `app/shell/components`

This package contains the concrete shell UI components rendered by `AppShell`.

Most important components:

- `AppShell.tsx`: root shell composition.
- `RightPanelStack.tsx`: chooses which right-side feature panel is visible.
- `MenuPanel.tsx`: app menu overlay, settings entrypoints, locale switching, and utility actions.
- `GameTabs.tsx`: session-tab UI.
- `DevDock.tsx`: developer dock and dev-only panels.
- `PlayersPanel.tsx`: player store management and quick search entrypoint.
- `StorageImportDialog.tsx`, `UpdateBanner.tsx`, `ToolbarRow.tsx`: shell support UI.

Most consumers should import these from the shell package rather than from unrelated feature code. Keep these components focused on shell composition, not reusable standalone widgets.

Canonical application shell components.

Contains the main shell UI pieces that compose multiple features into the top-level layout. Keep these components composition-focused and delegate feature behavior downward.
