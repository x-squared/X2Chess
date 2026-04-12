# `training/domain`

Framework-free training domain logic.

Important files:

- `training_protocol.ts`: protocol contracts.
- `training_transcript.ts`: transcript state and merge-selection types.
- `move_acceptance.ts`: move-evaluation policy.
- `train_tag_parser.ts`: training-tag integration surface.

This package is the core of training behavior and should remain independent of React UI.

Training domain logic.

Contains protocol-agnostic training rules and shared training state logic. This package should remain framework-free and focused on training semantics.
