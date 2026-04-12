# `training/hooks`

Training subsystem hooks.

Important files:

- `useTrainingSession.ts`: the primary training session controller used by the shell and training dialogs.

This package remains canonical for deep training-session state, even though `features/training/hooks` owns feature-level dialog orchestration.

Training subsystem hooks.

Owns hooks that are specific to the training subsystem but still shared across multiple training UI surfaces. Feature entry hooks that only wire training into the shell can live in `features/training`.
