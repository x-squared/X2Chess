# `features/analysis/hooks`

Stateful hooks for the analysis feature.

Most important hooks:

- `useEngineAnalysis.ts`: engine lifecycle and live variation state.
- `useOpeningExplorer.ts`: opening lookup integration.
- `useTablebaseProbe.ts`: tablebase probing state.
- `useVsEngine.ts`: play-vs-engine flow.
- `useGameAnnotation.ts`: annotate-game workflow.

These hooks own feature behavior and side effects. They may call shared infrastructure, but analysis UI should depend on them rather than duplicating orchestration logic.

Analysis feature hooks.

Owns analysis-specific hook orchestration such as engine analysis, explorer state, and related integration flows.
