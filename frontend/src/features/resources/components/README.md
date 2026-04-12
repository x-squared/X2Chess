# `features/resources/components`

UI components for the resource feature.

Most important files:

- `ResourceViewer.tsx`: main resource viewer surface.
- `ResourceTable.tsx`, `ResourceTabBar.tsx`, `ResourceToolbar.tsx`
- `CollectionExplorerPanel.tsx`, `GameSessionsPanel.tsx`
- `WebImportBrowserPanel.tsx`, `WebImportRulesPanel.tsx`

These components should stay focused on feature UI and consume shared parsers/helpers from `features/resources/services` or `resources/web_import`.

Canonical resource feature UI components.

Contains the resource viewer, resource tables, metadata dialogs, and resource-browser panels. Resource-specific UI ownership should converge here.
