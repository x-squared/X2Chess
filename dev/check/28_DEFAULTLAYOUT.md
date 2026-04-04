---
section: DEFAULTLAYOUT
area: Default Layout — toolbar button, apply behaviour, configuration dialog
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src/components/game_editor/TextEditorSidebar.tsx` — Default Layout button and ⚙ configure button
- `frontend/src/components/settings/DefaultLayoutDialog.tsx` — configuration dialog component
- `frontend/src/components/settings/DefaultLayoutDialog.css` — dialog styles
- `frontend/src/runtime/default_layout_prefs.ts` — `DefaultLayoutPrefs` type, defaults, localStorage store
- `frontend/src/model/pgn_commands.ts` — `applyDefaultLayout` pure function

## Checklist

### Toolbar button state

- [ ] **DEFAULTLAYOUT-1** — The "Default Layout" button appears in the editor sidebar between the layout-mode group and the eval-pill toggle.
- [ ] **DEFAULTLAYOUT-2** — In plain mode the button is enabled and clickable.
- [ ] **DEFAULTLAYOUT-3** — In text mode the button is enabled and clickable.
- [ ] **DEFAULTLAYOUT-4** — In tree mode the button is disabled; it cannot be clicked and its tooltip reads "unavailable in tree mode".
- [ ] **DEFAULTLAYOUT-5** — A small ⚙ button next to "Default Layout" is always enabled and opens the configuration dialog.

### Apply behaviour — intro comment

- [ ] **DEFAULTLAYOUT-6** — Clicking "Default Layout" on a game that has no leading comment inserts a comment reading "Introduction goes here…" before the first move.
- [ ] **DEFAULTLAYOUT-7** — Clicking "Default Layout" on a game that already has a leading comment does not insert a second intro comment.
- [ ] **DEFAULTLAYOUT-8** — The inserted intro comment receives intro styling (intro block) in text and tree mode.
- [ ] **DEFAULTLAYOUT-9** — With "Add intro if missing" disabled in the configuration, clicking the button never inserts an intro comment.

### Apply behaviour — [[br]] on main-line comments

- [ ] **DEFAULTLAYOUT-10** — Clicking "Default Layout" prepends `[[br]]` to every comment in the main line (root variation), except the intro comment.
- [ ] **DEFAULTLAYOUT-11** — Comments inside variations (RAVs) are not modified; they do not receive `[[br]]`.
- [ ] **DEFAULTLAYOUT-12** — A comment that already starts with `[[br]]` is not modified (no double `[[br]]`).
- [ ] **DEFAULTLAYOUT-13** — With "Add line break" disabled in the configuration, clicking the button does not prepend `[[br]]` to any comment.

### Apply behaviour — undo

- [ ] **DEFAULTLAYOUT-14** — The Default Layout action is undoable via the Undo button / keyboard shortcut.

### Configuration dialog — opening and closing

- [ ] **DEFAULTLAYOUT-15** — Clicking the ⚙ button in the sidebar opens the Default Layout configuration dialog.
- [ ] **DEFAULTLAYOUT-16** — Choosing "Default Layout…" from the main menu opens the same configuration dialog.
- [ ] **DEFAULTLAYOUT-17** — Clicking the × button closes the dialog without saving.
- [ ] **DEFAULTLAYOUT-18** — Clicking Cancel closes the dialog without saving.
- [ ] **DEFAULTLAYOUT-19** — Clicking the backdrop (outside the dialog panel) closes the dialog without saving.
- [ ] **DEFAULTLAYOUT-20** — Clicking inside the dialog panel does not close the dialog.

### Configuration dialog — controls

- [ ] **DEFAULTLAYOUT-21** — The "Add if missing" checkbox reflects the current stored preference when the dialog opens.
- [ ] **DEFAULTLAYOUT-22** — Unchecking "Add if missing" hides the intro text input field.
- [ ] **DEFAULTLAYOUT-23** — Checking "Add if missing" shows the intro text input field.
- [ ] **DEFAULTLAYOUT-24** — Editing the intro text input updates the live preview immediately (the preview game's auto-inserted intro reflects the new text).
- [ ] **DEFAULTLAYOUT-25** — The "Add line break" checkbox reflects the current stored preference when the dialog opens.
- [ ] **DEFAULTLAYOUT-26** — Toggling "Add line break" updates the live preview immediately.

### Configuration dialog — preview game

- [ ] **DEFAULTLAYOUT-27** — The preview pane renders the built-in default game (a well-annotated game with nested variations) on first open.
- [ ] **DEFAULTLAYOUT-28** — Clicking Plain / Text / Tree in the mode switcher updates the live preview mode immediately.
- [ ] **DEFAULTLAYOUT-29** — The preview reflects the current control settings in real time as settings change.
- [ ] **DEFAULTLAYOUT-30** — Editing the PGN textarea with valid PGN updates the preview pane immediately.
- [ ] **DEFAULTLAYOUT-31** — Entering invalid PGN in the textarea shows an error message below the textarea and leaves the preview unchanged.

### Configuration dialog — Reset, Cancel, Apply

- [ ] **DEFAULTLAYOUT-32** — Clicking Reset reverts all controls and the preview PGN to the factory defaults without closing the dialog.
- [ ] **DEFAULTLAYOUT-33** — After Reset, the preview immediately reflects the factory-default settings.
- [ ] **DEFAULTLAYOUT-34** — Clicking Apply saves the preferences and closes the dialog; subsequent clicks of "Default Layout" use the new settings.
- [ ] **DEFAULTLAYOUT-35** — Clicking Cancel after making changes closes the dialog; the stored preferences are unchanged.
- [ ] **DEFAULTLAYOUT-36** — Re-opening the dialog after Cancel shows the previously saved preferences, not the discarded changes.
- [ ] **DEFAULTLAYOUT-37** — Re-opening the dialog after Apply shows the settings that were just saved.

### Persistence

- [ ] **DEFAULTLAYOUT-38** — Preferences saved via Apply survive a page reload and are applied the next time "Default Layout" is clicked.
- [ ] **DEFAULTLAYOUT-39** — The custom preview PGN entered by the user is also persisted and visible the next time the dialog is opened.

## ---------- Completed -----------------------------------------
