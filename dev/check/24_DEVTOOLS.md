---
section: DEVTOOLS
area: Developer tools dock
---

## Key source files
- `frontend/src/components/shell/DevDock.tsx` — developer tools dock component + tab selector
- `frontend/src/components/game_editor/AstPanel.tsx` — AST tab (PGN model tree)
- `frontend/src/components/game_editor/RawPgnPanel.tsx` — raw PGN serialization tab
- `dev/plans/developer_tools_toggle_7c98bd50.plan.md` — developer-tools toggle design

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **DEVTOOLS-1** — Dev tools dock is hidden by default in production mode.
- [ ] **DEVTOOLS-2** — Enabling dev tools (Menu → Developer tools) shows the dock at the bottom.
- [ ] **DEVTOOLS-3** — AST tab shows the current PGN model tree structure.
- [ ] **DEVTOOLS-4** — Raw PGN tab shows editable PGN text; **Apply to session** replaces the open game in the UI, does not autosave, and clears undo for that session.
- [ ] **DEVTOOLS-6** — Dev tools state persists across page refreshes (localStorage).
