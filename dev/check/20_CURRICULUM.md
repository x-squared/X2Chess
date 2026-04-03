---
section: CURRICULUM
area: Training curriculum plan (.x2plan file)
---

## Key source files
- `dev/plans/training_mode_c9d0e1f2.plan.md` — curriculum plan design (chapters, tasks, .x2plan format)

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **CURRICULUM-1** — Menu → "Training Plan…" closes the menu and opens the curriculum panel on the right side.
- [ ] **CURRICULUM-2** — The plan title is editable inline; the updated title persists after closing and reopening the panel.
- [ ] **CURRICULUM-3** — "Add Chapter" creates a new chapter at the bottom; clicking its title renames it inline.
- [ ] **CURRICULUM-4** — "+ Task" under a chapter adds a new task; clicking the task title opens the edit form.
- [ ] **CURRICULUM-5** — Saving a task with a valid resource path, record id, and method updates the task row and persists the plan.
- [ ] **CURRICULUM-6** — A task with no linked game shows a "Link game" button instead of "Launch".
- [ ] **CURRICULUM-7** — Clicking "Launch" on a linked task navigates to that game and opens the training launcher.
- [ ] **CURRICULUM-8** — A task whose game has training history shows a score badge (e.g. "82%") next to the title.
- [ ] **CURRICULUM-9** — Deleting a task removes it from the list; deleting a chapter removes the chapter and all its tasks.
- [ ] **CURRICULUM-10** — "Export" downloads a `.x2plan` JSON file containing the current plan.
- [ ] **CURRICULUM-11** — "Import" with a valid `.x2plan` file replaces the current plan and persists it.
- [ ] **CURRICULUM-12** — "Import" with an invalid file shows an error alert and leaves the current plan unchanged.
- [ ] **CURRICULUM-13** — "New" replaces the current plan with an empty one titled "Training Plan".
- [ ] **CURRICULUM-14** — Closing and reopening the panel restores the last saved plan from localStorage.
