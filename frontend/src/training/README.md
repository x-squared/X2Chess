# `training`

This package still contains the deeper training subsystem shared across the shell, training feature entrypoints, and resource badges.

Important files and subdirectories:

- `components/`: major training UI components such as `TrainingLauncher`, `TrainingOverlay`, `TrainingResult`, and history/curriculum panels.
- `hooks/useTrainingSession.ts`: main training session state machine used by the shell.
- `domain/`: training transcript, protocol, acceptance, and tag-parsing domain logic.
- `protocols/`: replay/opening training protocols.
- `curriculum/`: curriculum plan parsing and persistence.
- `merge_transcript.ts`, `transcript_storage.ts`, `styles.css`

This package is still canonical for training domain/protocol code. `features/training` is the lighter entry layer for training UI integration.
