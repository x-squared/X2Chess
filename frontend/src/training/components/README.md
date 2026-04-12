# `training/components`

Training UI components shared by the shell and training feature.

Important files:

- `TrainingLauncher.tsx`, `TrainingOverlay.tsx`, `TrainingResult.tsx`
- `TrainingHistoryPanel.tsx`, `TrainingHistoryStrip.tsx`
- `CurriculumPanel.tsx`, `MoveOutcomeHint.tsx`

These components sit on top of the lower-level training session controls and transcript/domain logic.

Training-specific UI components.

Contains reusable UI pieces for the training subsystem, such as overlays, launchers, and result display. Feature-level shell integration should stay in `features/training`.
