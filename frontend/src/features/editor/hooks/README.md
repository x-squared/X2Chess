# `features/editor/hooks`

Hooks for editor-specific interaction flows and inline annotation dialogs.

Important files:

- `useMoveEntry.ts`: board-to-editor move entry behavior.
- `useQaDialog.ts`, `useTodoDialog.ts`, `useLinkDialog.ts`, `useTrainDialog.ts`
- `useAnchorDefDialog.ts`, `useAnchorRefDialog.ts`

These hooks are canonical for editor interaction state. Keep them here when they are editor-owned, even if they depend on shared parsers from `features/resources/services`.

Editor feature hooks.

Owns editor-specific interaction hooks such as move entry and annotation-dialog state. Keep editor interaction logic here rather than scattering it through components.
