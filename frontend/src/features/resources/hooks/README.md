# `features/resources/hooks`

Hooks for resource-feature behavior and side effects.

Important files:

- `useWebImport.ts`: end-to-end web-import workflow state.
- `useCollectionExplorer.ts`: collection explorer state.
- `usePositionSearch.ts`: position search orchestration.
- `useRulesRefresh.ts`: remote rule refresh state.
- `useExtDatabaseSettings.ts`: persisted settings for external database integrations.

Keep resource feature state machines here instead of in the shell.

Resource feature hooks.

Owns resource browsing, web import, search, and external database settings hooks used by the resource experience.
