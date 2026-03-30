---
section: DEVTOOLS
area: Developer tools dock
---

## Key source files
- `frontend/src/components/DevDock.tsx` — developer tools dock component
- `frontend/src/components/AstPanel.tsx` — AST tab (PGN model tree)
- `dev/plans/developer_tools_toggle_7c98bd50.plan.md` — developer-tools toggle design

## Checklist

- [ ] **DEVTOOLS-1** — Dev tools dock is hidden by default in production mode.
- [ ] **DEVTOOLS-2** — Enabling dev tools (Menu → Developer tools) shows the dock at the bottom.
- [ ] **DEVTOOLS-3** — AST tab shows the current PGN model tree structure.
- [ ] **DEVTOOLS-4** — DOM tab shows the rendered PGN HTML.
- [ ] **DEVTOOLS-5** — PGN tab shows the serialised PGN text output.
- [ ] **DEVTOOLS-6** — Dev tools state persists across page refreshes (localStorage).
