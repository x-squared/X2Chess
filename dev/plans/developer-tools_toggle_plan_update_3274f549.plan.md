---
name: Developer-Tools Toggle Plan Update
overview: Refine the runtime-mode plan so the toggle is explicitly named Developer-Tools, and it gates advanced runtime panels (AST, DOM, Raw PGN input/load area).
todos:
  - id: rename-toggle
    content: Rename Introspection toggle to Developer-Tools in state, UI, i18n, and docs
    status: pending
  - id: gate-advanced-panels
    content: Gate AST panel, DOM panel, and raw PGN input/load area behind Developer-Tools
    status: pending
  - id: mode-defaults
    content: Set Developer-Tools default ON in DEV and OFF in PROD
    status: pending
  - id: prod-opt-in
    content: Keep toggle available in PROD menu so users can enable advanced tools
    status: pending
  - id: persist-pref
    content: Persist Developer-Tools preference in localStorage
    status: pending
  - id: docs-sync
    content: Update architecture, DIY, and user manuals to match new toggle behavior
    status: pending
isProject: false
---

# Developer-Tools Toggle Plan Update

## Required Change

Rename the previous introspection control to **Developer-Tools** and make it the single gate for advanced runtime panels.

## Behavior

- `Developer-Tools = ON` -> show advanced tooling panels
- `Developer-Tools = OFF` -> hide advanced tooling panels
- In `DEV` mode: default ON
- In `PROD` mode: default OFF, user may enable in menu

## Panels Gated By Developer-Tools

- AST panel
- DOM panel
- Raw PGN textarea + input/load area

## Architecture Notes

```mermaid
graph LR
  AppMode[AppMode]
  DevTools[DeveloperToolsToggle]
  AdvancedPanels[AdvancedPanels]
  AppMode -->|DEV default ON| DevTools
  AppMode -->|PROD default OFF| DevTools
  DevTools -->|ON| AdvancedPanels
```

Advanced panels are controlled by a unified capability check:
- `isDeveloperToolsEnabled = (state.appMode === "DEV") || state.isDeveloperToolsEnabled`

This allows:
- predictable defaults by mode
- explicit user opt-in in PROD
- one switch controlling all advanced runtime insight features

## Planned File Touch Points

- [frontend/src/app_shell/layout.js](frontend/src/app_shell/layout.js)
  - rename menu label/control to Developer-Tools
  - gate AST/DOM/PGN raw section visibility on `isDeveloperToolsEnabled`

- [frontend/src/app_shell/index.js](frontend/src/app_shell/index.js)
  - bind Developer-Tools toggle event
  - persist user preference in localStorage

- [frontend/src/app_shell/app_state.js](frontend/src/app_shell/app_state.js)
  - add/rename state flag to `isDeveloperToolsEnabled`
  - initialize defaults by app mode

- [frontend/src/app_shell/runtime_config.js](frontend/src/app_shell/runtime_config.js)
  - ensure runtime visibility updates honor Developer-Tools gate

- [frontend/data/i18n/en.json](frontend/data/i18n/en.json)
- [frontend/data/i18n/de.json](frontend/data/i18n/de.json)
- [frontend/data/i18n/fr.json](frontend/data/i18n/fr.json)
- [frontend/data/i18n/it.json](frontend/data/i18n/it.json)
- [frontend/data/i18n/es.json](frontend/data/i18n/es.json)
  - replace old introspection labels with Developer-Tools wording

- [doc/architecture-manual.qmd](doc/architecture-manual.qmd)
- [doc/diy-manual.qmd](doc/diy-manual.qmd)
- [doc/user-manual.qmd](doc/user-manual.qmd)
  - reflect Developer-Tools behavior and defaults
