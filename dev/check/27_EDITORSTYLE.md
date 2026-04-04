---
section: EDITORSTYLE
area: Editor style dialog — font, sidebar, colours, per-mode controls, preview
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src/components/settings/EditorStyleDialog.tsx` — dialog component
- `frontend/src/components/settings/EditorStyleDialog.css` — dialog styles
- `frontend/src/components/game_editor/PgnEditorPreview.tsx` — live-preview pane
- `frontend/src/runtime/editor_style_prefs.ts` — `EditorStylePrefs`, `editorStyleToCssVars`, defaults
- `frontend/src/editor/styles.css` — CSS variables consumed by the preview/editor

## Checklist

### Opening and closing

- [ ] **EDITORSTYLE-1** — An "Editor style" button (or equivalent trigger) in the PGN editor toolbar opens the dialog.
- [ ] **EDITORSTYLE-2** — Clicking the × button in the dialog header closes the dialog without saving changes.
- [ ] **EDITORSTYLE-3** — Clicking the Cancel button closes the dialog without saving changes.
- [ ] **EDITORSTYLE-4** — Clicking the backdrop (outside the dialog panel) closes the dialog without saving changes.
- [ ] **EDITORSTYLE-5** — Clicking inside the dialog panel does not close the dialog.

### Preview mode switcher

- [ ] **EDITORSTYLE-6** — The dialog opens with the preview mode matching the current editor layout mode (plain / text / tree).
- [ ] **EDITORSTYLE-7** — Clicking Plain / Text / Tree in the mode switcher updates the live preview immediately.
- [ ] **EDITORSTYLE-8** — Switching preview mode shows or hides the mode-specific control sections (Intro section hidden in plain; Text/Tree controls shown only for their respective mode).

### Global font controls

- [ ] **EDITORSTYLE-9** — Changing the Font family select (System default / Sans-serif / Serif / Monospace) updates the preview font immediately.
- [ ] **EDITORSTYLE-10** — Dragging the Font size slider (10–22 px) updates the preview font size immediately; the badge next to the slider reflects the current value.
- [ ] **EDITORSTYLE-11** — Dragging the Line spacing slider (1.10–2.20) updates the preview line height immediately; the badge shows the value to two decimal places.

### Intro section (text and tree modes)

- [ ] **EDITORSTYLE-12** — In text or tree mode, the "Intro section" control group is visible.
- [ ] **EDITORSTYLE-13** — Enabling the "Left sidebar" checkbox in the Intro section shows the Thickness slider and Colour picker; disabling hides them.
- [ ] **EDITORSTYLE-14** — Adjusting the sidebar Thickness slider (1–6 px) updates the sidebar width in the preview; the badge shows the pixel value.
- [ ] **EDITORSTYLE-15** — Changing the sidebar Colour picker updates the sidebar colour in the preview immediately.
- [ ] **EDITORSTYLE-16** — Enabling the "Background colour" checkbox in the Intro section reveals a colour picker seeded with the default colour; disabling removes the background.
- [ ] **EDITORSTYLE-17** — Changing the background colour picker updates the intro background in the preview immediately.
- [ ] **EDITORSTYLE-18** — Dragging the "Gap below intro" slider (0–1.5 rem) updates the spacing between the intro block and the first move in the preview; the badge shows the value to two decimal places.
- [ ] **EDITORSTYLE-19** — Toggling "Bold main-line moves" makes move tokens in the intro section bold / normal in the preview.

### Text mode controls

- [ ] **EDITORSTYLE-20** — In text mode, the "Text mode" control group is visible.
- [ ] **EDITORSTYLE-21** — Dragging the "Indent width per level" slider (0.4–2.0 rem) changes the horizontal indentation of nested variations in the preview; the badge shows the value to one decimal place.
- [ ] **EDITORSTYLE-22** — Clicking the Level 1 / Level 2 / Level 3+ tabs switches the per-level style controls without affecting other levels.
- [ ] **EDITORSTYLE-23** — Changing the Font size select for a level (85%–110%) updates the font size of tokens at that nesting depth in the preview.
- [ ] **EDITORSTYLE-24** — The Left sidebar and Background colour sub-controls within each level tab work the same as the Intro section equivalents (EDITORSTYLE-13 through EDITORSTYLE-17), scoped to that level.
- [ ] **EDITORSTYLE-25** — Changes to Level 1, 2, and 3+ are independent; adjusting one does not alter the others.

### Tree mode controls

- [ ] **EDITORSTYLE-26** — In tree mode, the "Tree mode" control group is visible.
- [ ] **EDITORSTYLE-27** — Dragging the "Indent width per level" slider (0.6–2.5 em) changes the horizontal indentation per variation depth in the preview; the badge shows the value to one decimal place.
- [ ] **EDITORSTYLE-28** — Changing the pill Background colour picker updates variation-label pill backgrounds in the preview immediately.
- [ ] **EDITORSTYLE-29** — Changing the pill Border colour picker updates pill border colours in the preview immediately.
- [ ] **EDITORSTYLE-30** — Changing the pill Text colour picker updates pill label text colour in the preview immediately.

### Live preview pane

- [ ] **EDITORSTYLE-31** — The preview pane renders the current game (read-only) and reflects all style changes in real time without a reload or save.
- [ ] **EDITORSTYLE-32** — When no game is loaded, the preview pane shows a meaningful empty state rather than an error.

### Reset, Cancel, and Apply

- [ ] **EDITORSTYLE-33** — Clicking Reset reverts all controls to the last saved preferences (the values passed in via the `prefs` prop) without closing the dialog.
- [ ] **EDITORSTYLE-34** — After Reset, the preview immediately reflects the reverted settings.
- [ ] **EDITORSTYLE-35** — Clicking Apply persists the current local preferences and closes the dialog; the main PGN editor immediately reflects the new style.
- [ ] **EDITORSTYLE-36** — Clicking Cancel after making changes closes the dialog; the main PGN editor is unchanged (no partial save).
- [ ] **EDITORSTYLE-37** — Re-opening the dialog after Cancel shows the previously saved preferences, not the discarded changes.
- [ ] **EDITORSTYLE-38** — Re-opening the dialog after Apply shows the settings that were just saved.

## ---------- Completed -----------------------------------------
