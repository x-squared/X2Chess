# `training/curriculum`

Curriculum plan parsing and persistence for training.

Important files:

- `curriculum_plan.ts`: curriculum data structures.
- `curriculum_io.ts`: parse/serialize support.
- `curriculum_storage.ts`: persistence helpers.

Use this package when changing structured training curricula rather than per-session behavior.

Curriculum serialization and curriculum-plan support.

Use this package for curriculum import/export, parsing, and curriculum data helpers that support the training subsystem. Keep UI concerns out of this directory.
