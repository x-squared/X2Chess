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
