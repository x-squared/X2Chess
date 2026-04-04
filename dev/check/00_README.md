# X2Chess Manual Test Checklist

## What it is
- The manual checklist is a file where the AI lists items of works it has completed.
- The user will verify these items and comment on the items.
- The user may then ask the AI to revisit the items and effect any improvement suggested by the user.
- The AI will uopdate the items as it processes the user's instructions.

## Structure of check-file
- Header. This has the form
  ```
  ---
  section: SESSION
  area: Game tabs / session lifecycle
  ---
  ```
- Link to the rules. This has the fixed form:
  ```
  ## Edit rules
  See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.
  ```
- List of key source files. This has the form:
  ```
  ## Key source files
  - Relative path to a source file
  - Relative path to another source file
  ```
- Checklist of items, using the header "## Checklist". The format of items is described below.
- Completed section. The heading is "## ---------- Completed -----------------------------------------". The completed section contains items are no longer read by the agent. The user may refer back to them and bring them up again by copying them to the area above the line.

## Format if items
- An item has the general form
  ```
  - [ ] **SESSION-1** — Dropping or pasting a PGN opens it in a new tab; the previously active game is preserved.
  ```
- The box will be either of `[ ]`, `[!]`, `[?]`, or `[x]`

## Phases
The following phases are distinguished:
- Report-Phase: This is where the AI first reports on items, or extends the list of items.
- Check-Phase: This is where the user verifies tha items and reports on findings.
- Rework-Phase: This is where the AI reads the checked items and handles any findings.
- After the rework-phase, we return to the check-phase.
- The process is complete once all items are moved to the completed-section.

## Report-Phase
- The agent creates the file, or updates the file. This happens when at the end of work changes need to be communicated to the user for the user to check.
- The agent also updates the section indesx below.

## Check-Phase
The check-phase is done by the user.

### Reporting on accepted items
- Change `[ ]` to `[x]`.

### Reporting on findings
- Change `[ ]` to `[!]` and add an indented `> ` line describing what you observed:
  ```
  - [!] **BOARD-3** — Pawn promotion: a picker appears; selecting a piece completes the promotion.
    > The picker never appears — pawn auto-promotes to queen.
  ```
- The user may add new items if he wishes to report aspects that are not listed as items but should have been listed.

### Starting the Rework-Phase
- Start a prompt pointing at the check-file, and write something like  "fix checklist issues" to have the AI investigate and fix all `[!]` items.

## Rework-Phase
The rework-phase is done by the agent.

### Ignoring completed items
- Items that are in the completed section are never read by the agent.

### Ignoring unhandled items
- Items that are still marked `[ ]` are not handled while fixing.

### Removing completed items
- Items that are marked as done by `[x]` are moved to the completed section, including all comments. Comments are never deleted.

### Fixing an issue
- The agent will handle all items marked with `[!]`. It will use the instructions given to execute fixes.
- After fixing, the AI changes `[!]` to `[?]` (fixed, awaiting your recheck).
- The agent will not remove the comments made to report the bug.
- The agent will add information on its own explaining why the bug should be considered fixed. Comment lines are indented `>> ` lines. 
- 
### Updating the resource list
- The agent will update the key source list to reflect the relevant resources.

## Status symbols
| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not yet tested |
| `[x]` | Verified passing |
| `[!]` | Bug found — needs fixing |
| `[?]` | Fix applied — awaiting recheck |

---

## Section index

| # | File | Section | Area |
|---|---|---|---|
| 01 | [01_LAYOUT.md](01_LAYOUT.md) | LAYOUT | Application shell and layout |
| 02 | [02_SESSION.md](02_SESSION.md) | SESSION | Game tabs / session lifecycle |
| 03 | [03_OPEN.md](03_OPEN.md) | OPEN | Opening games (file drop, paste, resource viewer) |
| 04 | [04_NEWGAME.md](04_NEWGAME.md) | NEWGAME | New Game dialog |
| 05 | [05_GAMEINFO.md](05_GAMEINFO.md) | GAMEINFO | Game info and metadata headers |
| 06 | [06_NAV.md](06_NAV.md) | NAV | Board navigation |
| 07 | [07_BOARD.md](07_BOARD.md) | BOARD | Chess board and move entry |
| 08 | [08_PGNEDIT.md](08_PGNEDIT.md) | PGNEDIT | PGN text editor (plain/text/tree, NAGs, eval pills, TODO, links) |
| 09 | [09_SAVE.md](09_SAVE.md) | SAVE | Saving games |
| 10 | [10_UNDOREDO.md](10_UNDOREDO.md) | UNDOREDO | Undo / Redo |
| 11 | [11_ENGINE.md](11_ENGINE.md) | ENGINE | Engine analysis panel |
| 12 | [12_VSENGINE.md](12_VSENGINE.md) | VSENGINE | Play vs engine |
| 13 | [13_ANNOTATE.md](13_ANNOTATE.md) | ANNOTATE | Auto-annotation |
| 14 | [14_OPENING.md](14_OPENING.md) | OPENING | Opening explorer |
| 15 | [15_TB.md](15_TB.md) | TB | Endgame tablebase |
| 16 | [16_RESOURCE.md](16_RESOURCE.md) | RESOURCE | Resource viewer |
| 17 | [17_DB.md](17_DB.md) | DB | SQLite .x2chess database |
| 18 | [18_STUDY.md](18_STUDY.md) | STUDY | Study mode |
| 19 | [19_TRAINING.md](19_TRAINING.md) | TRAINING | Training mode |
| 20 | [20_CURRICULUM.md](20_CURRICULUM.md) | CURRICULUM | Training curriculum plan (.x2plan) |
| 21 | [21_WEBIMPORT.md](21_WEBIMPORT.md) | WEBIMPORT | Web import (URL paste/drop) |
| 22 | [22_OTA.md](22_OTA.md) | OTA | In-app update notifications (Tauri desktop only) |
| 23 | [23_IMPORT.md](23_IMPORT.md) | IMPORT | Format importers (EPD, ChessBase) |
| 24 | [24_DEVTOOLS.md](24_DEVTOOLS.md) | DEVTOOLS | Developer tools dock |
| 25 | [25_KB.md](25_KB.md) | KB | Keyboard shortcuts |
| 26 | [26_PREFS.md](26_PREFS.md) | PREFS | Startup preferences — defaults vs. user-saved |
| 27 | [27_EDITORSTYLE.md](27_EDITORSTYLE.md) | EDITORSTYLE | Editor style dialog — font, sidebar, colours, per-mode controls, preview |
| 28 | [28_DEFAULTLAYOUT.md](28_DEFAULTLAYOUT.md) | DEFAULTLAYOUT | Default Layout — toolbar button, apply behaviour, configuration dialog |
