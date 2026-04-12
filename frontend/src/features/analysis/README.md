# `features/analysis`

Analysis feature package for engine analysis, opening explorer, tablebase, and play-vs-engine flows.

Important subdirectories:

- `hooks/`: stateful hooks such as `useEngineAnalysis`, `useOpeningExplorer`, `useTablebaseProbe`, `useVsEngine`, and `useGameAnnotation`.
- `components/`: panels and dialogs rendered in the shell.
- `services/`: framework-free analysis helpers when analysis UI needs shared support code.

Use this package when the code is about engine-backed analysis or exploratory chess tooling. Keep raw desktop transport in `platform/` or shared resource fetch helpers in `resources/`.

Analysis feature package.

Contains the UI and hooks for engine analysis, opening exploration, and tablebase-driven analysis workflows. Shared engine infrastructure may still live elsewhere, but analysis-specific user flows belong here.
