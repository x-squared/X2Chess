# `runtime`

Runtime persistence and bootstrap support helpers.

Important files:

- preference stores: `shape_prefs.ts`, `editor_style_prefs.ts`, `default_layout_prefs.ts`, `shell_prefs_store.ts`, `ext_database_settings_store.ts`
- startup/bootstrap helpers: `bootstrap_prefs.ts`, `bootstrap_shared.ts`
- workspace persistence: `workspace_snapshot_store.ts`, `workspace_persistence.ts`
- update/rules helpers: `app_version.ts`, `remote_rules_store.ts`
- session/editor integration helpers: `pgn_model_update.ts`, `resource_ref_utils.ts`

Use this package for persisted preference logic and startup/runtime utilities. UI components should usually consume these through app services or feature hooks.

Runtime-level shared support for the frontend.

Contains app-wide runtime utilities such as snapshot shapes, preference helpers, and bootstrap-facing helpers that are not specific to a single feature. Keep direct environment calls in `platform/` unless they are truly runtime-neutral.
