---
section: STUDY
area: Study mode (guided move-by-move replay with blanked board)
---

## Key source files
- `frontend/src/components/StudyOverlay.tsx` — study mode overlay component

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Checklist

- [ ] **STUDY-1** — Study mode is entered when the active game meets the requirements (has variations, comments).
- [ ] **STUDY-2** — Board is blanked until the user enters the expected move.
- [ ] **STUDY-3** — Correct move advances; incorrect move shows a hint or rejection.
- [ ] **STUDY-4** — Completing the study shows a summary screen.
