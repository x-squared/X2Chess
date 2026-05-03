---
section: LAYOUT
area: Application shell and layout
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src/components/AppShell.tsx` — root shell component
- `frontend/src/components/MenuPanel.tsx` — slide-in menu panel
- `frontend/src/app_shell/app_state.ts` — mutable app-level state
- `frontend/src/hooks/useAppStartup.ts` — startup sequence

## Checklist

- [ ] **LAYOUT-6** — With a short window (e.g. height under 700 px), scroll the main page until the resources tab content is in view: the right strip `panel.right-tabs` (Resources / Metadata / Analysis / …) stays visible at the top of the viewport instead of scrolling away.

## ---------- Completed -----------------------------------------

- [x] **LAYOUT-1** — App opens without a white flash or console errors.
- [x] **LAYOUT-2** — Resizing the window below `980×700` shows scrollbars rather than breaking layout.
- [x] **LAYOUT-3** — Menu trigger button (top-right of board panel) opens the slide-in menu panel.
- [x] **LAYOUT-4** — Clicking the backdrop or the × button closes the menu panel.
- [x] **LAYOUT-5** — Drop overlay appears on the app panel when a file is dragged over it, and disappears on drag-leave or drop.
