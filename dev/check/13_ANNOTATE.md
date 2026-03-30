---
section: ANNOTATE
area: Auto-annotation (engine-driven NAG insertion)
---

## Key source files
- `frontend/src/components/AnnotateGameDialog.tsx` — annotation dialog
- `dev/plans/engines_integration_e5f6a7b8.plan.md` — engine integration (annotation pass design)

## Checklist

- [ ] **ANNOTATE-1** — Menu → Annotate game runs the engine over all moves.
- [ ] **ANNOTATE-2** — Blunders/mistakes/inaccuracies receive NAG symbols (?! / ? / ??) attached directly to the move node; they render as Unicode glyphs in the editor.
- [ ] **ANNOTATE-3** — Annotation completes and the dirty flag is set (changes need saving).
