# `features/resources`

The resources feature owns the resource viewer, metadata editing UI, resource search panels, and the user-facing web-import workflow.

Important subdirectories:

- `components/`: resource viewer, tab bar, toolbar, web-import panels, game session list, and dialogs.
- `hooks/`: collection explorer, web-import, position search, rules refresh, and external DB settings hooks.
- `services/`: parser and viewer support logic used by resource/editor UI.
- `metadata/`: metadata schema editor UI and styles.
- `search/`: game, position, and text search panels.
- `web_import/`: feature-owned web-import UI pieces.

Use `features/resources` for user-facing resource workflows. Shared lower-level resource infrastructure still lives in the top-level `resources/` package.

Resource browsing and import feature package.

Owns resource viewer UI, resource search, metadata tools, and resource-facing hooks and services. Infrastructure shared across unrelated packages should stay in `resources/`, `storage/`, or `platform/`.
