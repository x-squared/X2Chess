# `features/resources/components`

UI components for the resource feature.

Most important files:

- `ResourceViewer.tsx`: main resource viewer surface.
- `ResourceTable.tsx`, `ResourceTabBar.tsx`, `ResourceToolbar.tsx` (group-by, schema chooser, **Add metadata…**, column header × to remove a metadata column)
- `core/model/ui_ids.ts` (`UI_IDS`): stable `data-ui-id` strings for the Resources right panel and the rest of the app (inspection, E2E hooks).
- `CollectionExplorerPanel.tsx`, `GameSessionsPanel.tsx`
- `WebImportBrowserPanel.tsx`, `WebImportRulesPanel.tsx`

These components should stay focused on feature UI and consume shared parsers/helpers from `features/resources/services` or `resources/web_import`.

Canonical resource feature UI components.

Contains the resource viewer, resource tables, metadata dialogs, and resource-browser panels. Resource-specific UI ownership should converge here.
