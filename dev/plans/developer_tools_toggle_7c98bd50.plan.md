---
name: Developer Tools Toggle
overview: Revise runtime-mode plan so a single Developer-Tools toggle governs access to introspection and advanced editing surfaces, including AST, DOM, and raw PGN input/load.
todos:
  - id: state-flag
    content: Introduce isDeveloperToolsEnabled state with DEV/PROD default and persistence
    status: pending
  - id: menu-toggle-ui
    content: Add Developer Tools toggle in menu layout and localized label
    status: pending
  - id: toggle-wiring
    content: Wire toggle event and state update in app shell runtime
    status: pending
  - id: feature-gates
    content: Gate AST, DOM, and raw PGN input/load area by Developer Tools flag
    status: pending
  - id: i18n
    content: Add controls.developerTools key to all locale bundles
    status: pending
  - id: docs
    content: Update architecture, diy, and user manuals for Developer Tools behavior
    status: pending
isProject: false
---

# Developer-Tools Toggle Plan

## Updated Direction

Replace the previous "Introspection" concept with a **Developer-Tools toggle**.

- Label in UI: `Developer Tools`
- Behavior: when ON, additional runtime features are enabled
- Default:
  - DEV build: ON by default
  - PROD build: OFF by default, user can enable

## Feature Gating (Requested Change)

When `Developer Tools` is ON, show:
- AST panel
- DOM panel
- Raw PGN textarea + Load action area

When OFF, hide all three.

## Mode Interaction

- Build mode (`DEV` / `PROD`) still exists for defaults and policy.
- Runtime toggle (`Developer Tools`) controls availability of advanced tools in both modes.
- DEV-specific extras (for example sample games auto-preload) remain DEV-only policy unless explicitly changed.

## Implementation Steps

1. Add runtime flag `state.isDeveloperToolsEnabled` and initialize by mode:
   - DEV -> `true`
   - PROD -> `false`
   - persist in `localStorage` (`x2chess.developerTools`)
2. Add menu toggle control in shell layout (`Developer Tools` checkbox).
3. Wire toggle events in app shell and trigger re-render on change.
4. Update runtime UI application to gate these blocks by `isDeveloperToolsEnabled`:
   - AST wrapper
n   - DOM wrapper
   - PGN raw input/load wrapper
5. Ensure i18n keys exist in all locale bundles (`controls.developerTools`).
6. Update manuals (`architecture`, `diy`, `user`) with the new toggle semantics.

## Files to Touch

- [frontend/src/app_shell/layout.js](frontend/src/app_shell/layout.js)
- [frontend/src/app_shell/index.js](frontend/src/app_shell/index.js)
- [frontend/src/app_shell/runtime_config.js](frontend/src/app_shell/runtime_config.js)
- [frontend/src/app_shell/app_state.js](frontend/src/app_shell/app_state.js)
- [frontend/src/main.js](frontend/src/main.js)
- [frontend/data/i18n/en.json](frontend/data/i18n/en.json) (+ DE/FR/IT/ES peers)
- [doc/architecture-manual.qmd](doc/architecture-manual.qmd)
- [doc/diy-manual.qmd](doc/diy-manual.qmd)
- [doc/user-manual.qmd](doc/user-manual.qmd)
