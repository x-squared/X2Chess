# `components/anchors`

Shared anchor UI components used by editor annotation flows.

Important files:

- `AnchorDefDialog.tsx`: create or edit anchor definitions.
- `AnchorPickerDialog.tsx`: choose an existing anchor reference target.
- `AnchorList.tsx`: render discovered anchors.

These components depend on canonical editor/resource models but remain shared UI because they are reused across multiple editor-facing dialogs.

Shared anchor dialog components.

Contains UI for anchor-definition and anchor-reference interaction that is currently reused by the editor feature. If ownership becomes fully editor-specific, move the canonical files into `features/editor`.
