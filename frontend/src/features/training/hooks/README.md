# `features/training/hooks`

Hooks for training UI orchestration.

Important files:

- `useTrainingDialogState.ts`: review/merge dialog state layered on top of the lower-level training session controls.

Keep training shell/UI state here; core protocol behavior remains in `training/`.

Training feature hooks.

Owns feature-level training state hooks that wire the shell and dialogs into the broader training subsystem.
