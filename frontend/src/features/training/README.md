# `features/training`

Feature entrypoints for training-specific UI flows.

Important subdirectories:

- `components/`: training-specific dialogs or shell-facing components that are clearly feature-owned.
- `hooks/`: feature UI hooks such as `useTrainingDialogState`.
- `services/`: feature-level helpers for training UI composition.

Deeper protocol and domain logic still lives in the top-level `training/` package. This package owns the training surfaces and shell integration points.

Training feature entrypoints.

Contains feature-level training hooks and UI state that integrates the broader training subsystem into the shell. Deeper training protocols and domain logic may still live under `training/`.
