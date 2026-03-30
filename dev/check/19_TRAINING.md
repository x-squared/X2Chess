---
section: TRAINING
area: Training mode (Replay protocol, session scoring, [%train] tags)
---

## Key source files
- `frontend/src/components/TrainBadge.tsx` — `[%train]` badge and popover in the editor
- `frontend/src/editor/useTrainDialog.ts` — training tag dialog logic
- `dev/plans/training_mode_c9d0e1f2.plan.md` — Replay protocol, transcript/merge infrastructure
- `dev/plans/training_move_acceptance_3e4f5a6b.plan.md` — move acceptance algorithm (NAG/RAV/eval/[%train] signals, MoveEvalResult)

## Checklist

- [ ] **TRAINING-1** — Launching training from a resource row opens the training launcher.
- [ ] **TRAINING-2** — Replay protocol plays through the game move-by-move; progress is shown.
- [ ] **TRAINING-3** — Training badge (score chip) appears on the resource row after a session.
- [ ] **TRAINING-4** — Training history strip in the text editor shows past session scores.
- [ ] **TRAINING-5** — Aborting training mid-session records a partial result.
- [ ] **TRAINING-6** — Right-clicking a move in the PGN editor shows "Add training tag" in the context menu.
- [ ] **TRAINING-7** — Clicking "Add training tag" opens the training tag dialog; entering accept moves and saving inserts a `[%train accept="..."]` comment before the move and shows a "T" badge in the editor.
- [ ] **TRAINING-8** — Clicking the "T" badge opens a popover showing accept, reject, and hint values; clicking Edit reopens the dialog with pre-filled values.
- [ ] **TRAINING-9** — Editing a `[%train]` tag via the badge popover updates the existing tag in the PGN comment (not a duplicate).
- [ ] **TRAINING-10** — Clicking Delete in the "T" badge popover removes the `[%train]` tag from the comment; the badge disappears.
- [ ] **TRAINING-11** — A `[%train]` tag with only a hint and no accept/reject shows the hint in the popover and "No overrides set." is not shown.
- [ ] **TRAINING-12** — During a Replay training session, a move matching a `[%train accept]` list is accepted as correct even if it is not the game move.
- [ ] **TRAINING-13** — During a Replay training session, a move listed in `[%train reject]` is rejected even if it is the mainline game move.
- [ ] **TRAINING-14** — A `[%train hint]` value is shown when the user requests a hint during training at that position.
