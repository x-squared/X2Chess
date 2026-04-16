---
section: DEVTOOLS
area: Developer tools dock
---

## Key source files
- `frontend/src/app/shell/components/DevDock.tsx` — developer tools dock component + tab selector
- `frontend/src/features/editor/components/AstPanel.tsx` — AST tab (PGN model tree)
- `frontend/src/features/editor/components/RawPgnPanel.tsx` — raw PGN editor tab + validation status
- `frontend/src/features/editor/model/pgn_validation.ts` — strict/normalized/fallback PGN diagnostics
- `dev/plans/developer_tools_toggle_7c98bd50.plan.md` — developer-tools toggle design

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **DEVTOOLS-1** — Dev tools dock is hidden by default in production mode.
- [ ] **DEVTOOLS-2** — Enabling dev tools (Menu → Developer tools) shows the dock at the bottom.
- [ ] **DEVTOOLS-3** — AST tab shows the current PGN model tree structure.
- [ ] **DEVTOOLS-4** — Raw PGN tab shows editable PGN text; **Apply to session** replaces the open game in the UI, does not autosave, and clears undo for that session.
- [ ] **DEVTOOLS-5** — Raw PGN tab shows a PGN quality pill status (OK / Warning / Critical) and lists line-based parse issues when relevant.
- [ ] **DEVTOOLS-7** — Raw PGN validation panel can copy diagnostics to clipboard and shows success/failure feedback.
- [ ] **DEVTOOLS-8** — Clicking an issue entry jumps to and highlights the corresponding line in the Raw PGN editor.
- [ ] **DEVTOOLS-9** — Raw PGN panel provides a before/after preview for safe auto-fixes, and can then apply compatibility fixes for headers and missing SetUp/FEN pairing.
- [ ] **DEVTOOLS-6** — Dev tools state persists across page refreshes (localStorage).
