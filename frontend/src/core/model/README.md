# core/model

Pure domain-adjacent shared types and registries that are not React-specific.

## `ui_ids.ts`

Exports `UI_IDS`: the single canonical registry of `data-ui-id` string values used across the shell, editor, resources viewer, dialogs, and dev tools. The UI inspector (`GuideInspector`) resolves the nearest DOM ancestor with `data-ui-id`. Import `UI_IDS` (never inline ID strings) when attaching `data-ui-id` to markup.
