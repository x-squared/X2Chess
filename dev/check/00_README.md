# X2Chess Manual Test Checklist

**How to use:**
- Open the section file for the area you changed and work through its items.
- Mark items `[x]` as you verify them.
- Reset `[x]` back to `[ ]` whenever the item is re-opened by a later change.

**Reporting a bug:**
- Change `[ ]` to `[!]` and add an indented `> ` line describing what you observed:
  ```
  - [!] **BOARD-3** — Pawn promotion: a picker appears; selecting a piece completes the promotion.
    > The picker never appears — pawn auto-promotes to queen.
  ```
- Say "fix checklist issues" to have Claude investigate and fix all `[!]` items.
- After fixing, Claude changes `[!]` to `[~]` (fixed, awaiting your recheck).
- Once you have verified the fix, change `[~]` to `[x]`.

**Status symbols:**
| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not yet tested |
| `[x]` | Verified passing |
| `[!]` | Bug found — needs fixing |
| `[~]` | Fix applied — awaiting recheck |

---

## Section index

| File | Section | Area |
|---|---|---|
| [LAYOUT.md](LAYOUT.md) | LAYOUT | Application shell and layout |
| [SESSION.md](SESSION.md) | SESSION | Game tabs / session lifecycle |
| [OPEN.md](OPEN.md) | OPEN | Opening games (file drop, paste, resource viewer) |
| [NEWGAME.md](NEWGAME.md) | NEWGAME | New Game dialog |
| [GAMEINFO.md](GAMEINFO.md) | GAMEINFO | Game info and metadata headers |
| [NAV.md](NAV.md) | NAV | Board navigation |
| [BOARD.md](BOARD.md) | BOARD | Chess board and move entry |
| [PGNEDIT.md](PGNEDIT.md) | PGNEDIT | PGN text editor (plain/text/tree, NAGs, eval pills, TODO, links) |
| [SAVE.md](SAVE.md) | SAVE | Saving games |
| [UNDOREDO.md](UNDOREDO.md) | UNDOREDO | Undo / Redo |
| [ENGINE.md](ENGINE.md) | ENGINE | Engine analysis panel |
| [VSENGINE.md](VSENGINE.md) | VSENGINE | Play vs engine |
| [ANNOTATE.md](ANNOTATE.md) | ANNOTATE | Auto-annotation |
| [OPENING.md](OPENING.md) | OPENING | Opening explorer |
| [TB.md](TB.md) | TB | Endgame tablebase |
| [RESOURCE.md](RESOURCE.md) | RESOURCE | Resource viewer |
| [DB.md](DB.md) | DB | SQLite .x2chess database |
| [STUDY.md](STUDY.md) | STUDY | Study mode |
| [TRAINING.md](TRAINING.md) | TRAINING | Training mode |
| [CURRICULUM.md](CURRICULUM.md) | CURRICULUM | Training curriculum plan (.x2plan) |
| [WEBIMPORT.md](WEBIMPORT.md) | WEBIMPORT | Web import (URL paste/drop) |
| [OTA.md](OTA.md) | OTA | In-app update notifications (Tauri desktop only) |
| [IMPORT.md](IMPORT.md) | IMPORT | Format importers (EPD, ChessBase) |
| [DEVTOOLS.md](DEVTOOLS.md) | DEVTOOLS | Developer tools dock |
| [KB.md](KB.md) | KB | Keyboard shortcuts |
