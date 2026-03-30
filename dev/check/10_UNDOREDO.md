---
section: UNDOREDO
area: Undo / Redo
---

## Key source files
- `frontend/src/state/app_reducer.ts` — undo/redo stack management
- `frontend/src/state/actions.ts` — `UNDO` / `REDO` actions
- `frontend/src/editor/history.ts` — editor history helpers
- `frontend/src/components/ToolbarRow.tsx` — undo/redo toolbar buttons

## Checklist

- [ ] **UNDOREDO-1** — Cmd/Ctrl+Z undoes the last model change (move, comment, header edit).
- [ ] **UNDOREDO-2** — Cmd/Ctrl+Shift+Z (or Cmd+Y) redoes after undo.
- [ ] **UNDOREDO-3** — Making a new edit after undo clears the redo stack.
- [ ] **UNDOREDO-4** — Undo/Redo buttons in the toolbar reflect the available stack depth (disabled when empty).
