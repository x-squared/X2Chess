# X2Chess Manual Test Checklist

**How to use:**
- Work through sections relevant to the change just made.
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

**Last updated:** 2026-03-29 (eval pills — EvalBadge, show/hide toggle, delete-all)

---

## LAYOUT — Application shell and layout

- [ ] **LAYOUT-1** — App opens without a white flash or console errors.
- [ ] **LAYOUT-2** — Resizing the window below `980×700` shows scrollbars rather than breaking layout.
- [ ] **LAYOUT-3** — Menu trigger button (top-right of board panel) opens the slide-in menu panel.
- [ ] **LAYOUT-4** — Clicking the backdrop or the × button closes the menu panel.
- [ ] **LAYOUT-5** — Drop overlay appears on the app panel when a file is dragged over it, and disappears on drag-leave or drop.

---

## SESSIONS — Game tabs

- [ ] **SESSION-1** — Opening a second game (drop/paste) creates a new tab; the first game is preserved.
- [ ] **SESSION-2** — Clicking a different tab switches to that game and restores its board position and PGN.
- [ ] **SESSION-3** — Clicking × on a tab closes it; adjacent tab becomes active.
- [ ] **SESSION-4** — Closing the last tab creates a fresh empty game automatically.
- [ ] **SESSION-5** — A tab with unsaved changes shows the red "unsaved" styling.
- [ ] **SESSION-6** — The dirty-dot indicator appears on a tab after editing (move entry, comment, header).
- [ ] **SESSION-7** — Clicking a game-link chip in the PGN editor opens the linked game in a new tab without closing the current tab.

---

## OPEN — Opening games

- [ ] **OPEN-1** — Dragging a `.pgn` file onto the app panel opens the game.
- [ ] **OPEN-2** — Pasting PGN text (Cmd/Ctrl+V outside any input) opens the game.
- [ ] **OPEN-3** — Pasting a FEN string opens the position in a new game (SetUp header applied).
- [ ] **OPEN-4** — Using Menu → Open file / Open folder opens the resource picker.
- [ ] **OPEN-5** — Opening a game from a resource row in the Resource Viewer loads it in the editor.

---

## NEWGAME — New Game dialog

- [ ] **NEWGAME-1** — Menu → New Game opens the dialog.
- [ ] **NEWGAME-2** — Tab 1 (Starting position): Standard radio creates a game from the opening position.
- [ ] **NEWGAME-3** — Tab 1 (Starting position): Custom FEN radio enables the FEN input; valid FEN is accepted.
- [ ] **NEWGAME-4** — Tab 1 (Starting position): Invalid FEN shows an inline error and blocks Confirm.
- [ ] **NEWGAME-5** — Tab 1 (Starting position): Chess960 checkbox enables position picker; chosen position is shown on the mini-board.
- [ ] **NEWGAME-6** — Tab 2 (Game info): White, Black, Event, Date, Result fields are editable.
- [ ] **NEWGAME-7** — Confirm creates the game with correct headers; Cancel closes without changes.

---

## GAMEINFO — Game info and metadata headers

- [ ] **GAMEINFO-1** — Clicking a header field in the game-info strip makes it editable.
- [ ] **GAMEINFO-2** — Editing White/Black/Event updates the PGN header and the session tab title.
- [ ] **GAMEINFO-3** — Date field normalises partial input (e.g. "2024" → "2024.??.??").
- [ ] **GAMEINFO-4** — Result field accepts only legal PGN result values (`1-0`, `0-1`, `1/2-1/2`, `*`).

---

## NAV — Board navigation

- [ ] **NAV-1** — ← / → toolbar buttons step one move backward/forward.
- [ ] **NAV-2** — |← / →| toolbar buttons jump to start/end.
- [ ] **NAV-3** — Left/Right arrow keys navigate when the board or editor is focused.
- [ ] **NAV-4** — Clicking a move token in the text editor navigates to that move.
- [ ] **NAV-5** — Clicking a move in a variation navigates into the variation (board preview if off-mainline).

---

## BOARD — Chess board and move entry

- [ ] **BOARD-1** — Clicking a piece highlights it and shows legal move targets.
- [ ] **BOARD-2** — Clicking a legal target plays the move and updates the PGN.
- [ ] **BOARD-3** — Pawn promotion: a picker appears; selecting a piece completes the promotion.
- [ ] **BOARD-4** — Ambiguous move (two pieces can reach same square): a disambiguation dialog appears.
- [ ] **BOARD-5** — Entering a move in a position that already has a next move: a dialog asks New variation / Replace / Cancel.
- [ ] **BOARD-6** — Flip board button (↕) mirrors the board orientation.
- [ ] **BOARD-7** — Hint button highlights the next move on the board.
- [ ] **BOARD-8** — Illegal move attempt: piece snaps back; no move is added.
- [ ] **BOARD-9** — Last move is highlighted with a subtle tint after navigation.

---

## PGNEDIT — PGN text editor

- [ ] **PGNEDIT-1** — Plain mode shows the raw PGN as a single text block.
- [ ] **PGNEDIT-2** — Text mode shows `[[br]]`-formatted paragraphs with indented variations.
- [ ] **PGNEDIT-3** — Tree mode shows one block per variation branch, labelled A / B / A.1 etc.
- [ ] **PGNEDIT-4** — Layout mode toggle (Plain / Text / Tree) switches without data loss.
- [ ] **PGNEDIT-5** — Clicking "Add comment before/after" inserts a comment node; the field is focused.
- [ ] **PGNEDIT-6** — Editing a comment and clicking away saves the text into the PGN model.
- [ ] **PGNEDIT-7** — Q/A badge (? or ! annotation) can be set on a move; it appears in the PGN.
- [ ] **PGNEDIT-8** — `[[br]]` directive in a comment text creates a new paragraph in text/tree mode.
- [ ] **PGNEDIT-9** — `[[indent]]` directive indents a comment block in text/tree mode.
- [ ] **PGNEDIT-10** — Truncation menu (⋯) on a move offers "Truncate here"; removes subsequent moves.
- [ ] **PGNEDIT-11** — Clicking a half-move shows the move-action popup (left/?/right) above nearby move tokens and comment text in both Text and Tree modes.
- [ ] **PGNEDIT-12** — In Tree mode, the first comment of each variation branch is rendered with intro styling before the branch moves.
- [ ] **PGNEDIT-13** — In Tree mode, black connector lines render as vertical trunks with horizontal branches linking branch pills to deeper levels.
- [ ] **PGNEDIT-14** — Clicking a comment focuses it for editing without leaving a persistent highlighted background after focus moves elsewhere.
- [ ] **PGNEDIT-15** — Clicking the "T" button in the move action bar opens the TODO insert dialog; saving creates a `[%todo text="..."]` tag in the adjacent comment.
- [ ] **PGNEDIT-16** — An amber "T" badge appears next to a comment that contains a `[%todo ...]` annotation; clicking it opens a popover showing the TODO text.
- [ ] **PGNEDIT-17** — The TODO popover has Edit and Delete buttons; Edit re-opens the insert dialog pre-filled; Delete removes the annotation and the badge disappears.
- [ ] **PGNEDIT-18** — When multiple TODO annotations exist on the same comment, the badge shows "TN" and the popover has prev/next navigation arrows.
- [ ] **PGNEDIT-19** — The TODO panel appears below the editor when at least one TODO exists; it lists each TODO with its nearest preceding move as a label.
- [ ] **PGNEDIT-20** — The TODO panel's Edit and Delete buttons work; after deleting the last TODO the panel disappears.
- [ ] **PGNEDIT-21** — Clicking the "▼ TODO (N)" header in the panel collapses/expands the list.
- [ ] **PGNEDIT-22** — TODO badge and "T" button do not appear in plain mode; they appear in text and tree modes.
- [ ] **PGNEDIT-23** — Clicking the "⇢" button in the move action bar (text/tree mode) opens the Game Picker dialog with a searchable list of games from the current resource.
- [ ] **PGNEDIT-24** — Typing in the Game Picker search box filters the list by player name or event; results update live.
- [ ] **PGNEDIT-25** — Selecting a game in the picker (click or Enter) inserts a `[%link recordId="..."]` annotation into the adjacent comment and closes the dialog.
- [ ] **PGNEDIT-26** — A `[%link ...]` annotation renders as an "⇢ (link)" chip next to the comment in text/tree mode.
- [ ] **PGNEDIT-27** — When the annotation has a label (e.g. `label="Nimzo trap"`), the chip displays that label instead of "(link)".
- [ ] **PGNEDIT-28** — Clicking a link chip opens the linked game in a **new session tab**; the current tab is preserved.
- [ ] **PGNEDIT-29** — Hovering over a link chip fetches and shows a tooltip: "White vs Black — Result, Date".
- [ ] **PGNEDIT-30** — Hovering over a chip whose linked game no longer exists shows the chip greyed/disabled with a "(broken link)" tooltip; clicking it does nothing.
- [ ] **PGNEDIT-31** — The edit (✎) button on a link chip re-opens the Game Picker pre-filled; selecting a different game updates the annotation.
- [ ] **PGNEDIT-32** — The delete (×) button on a link chip removes the `[%link ...]` annotation; the chip disappears immediately.
- [ ] **PGNEDIT-33** — Link chips and the "⇢" action bar button do not appear in plain mode.
- [ ] **PGNEDIT-34** — Hovering over any half-move token in plain/text/tree mode shows a floating mini-board popup with the position after that move, with the last move highlighted.
- [ ] **PGNEDIT-35** — Hovering over a variation move shows the correct variation position (not the mainline position at that ply).
- [ ] **PGNEDIT-36** — Moving the pointer off a half-move dismisses the popup immediately.
- [ ] **PGNEDIT-37** — With "Position preview on hover" toggled off in the menu, hovering over half-moves shows no popup.
- [ ] **PGNEDIT-38** — With "Position preview on hover" re-enabled, the popup reappears on hover.
- [ ] **PGNEDIT-39** — The popup does not affect the main board position; board navigation state is unchanged.
- [ ] **PGNEDIT-40** — Near the bottom or right viewport edge, the popup flips/clamps so it stays fully visible.
- [ ] **PGNEDIT-41** — Clicking a half-move shows the NAG picker toolbar above the editor content; clicking elsewhere deselects the move and hides the picker.
- [ ] **PGNEDIT-42** — NAG picker shows three rows: move quality (!  ?  !!  ??  !?  ?!), evaluation (= ∞ ⩲ ⩱ ± ∓ +- -+), and positional symbols.
- [ ] **PGNEDIT-43** — Clicking a move-quality button (e.g. ?) attaches the NAG to the move; the symbol appears immediately after the SAN in the editor.
- [ ] **PGNEDIT-44** — NAG codes render as Unicode glyphs in all editor modes (plain/text/tree), not as raw `$1` / `$2` codes.
- [ ] **PGNEDIT-45** — Clicking the same active symbol again removes it (toggle off); the symbol disappears from the editor.
- [ ] **PGNEDIT-46** — Selecting a different symbol in the same group replaces the previous one (e.g. clicking `?` when `!` is active: `!` disappears, `?` appears).
- [ ] **PGNEDIT-47** — Evaluation symbols (±, ∓, +-, etc.) follow the same toggle/replace behaviour within their group independently of move-quality symbols.
- [ ] **PGNEDIT-48** — Positional symbols (→ initiative, ↑ attack, ⇆ counterplay, ⊠ zugzwang, □ weak point, △ with the idea, ⊞ better was, N novelty, =/∞ compensation) can be toggled independently.
- [ ] **PGNEDIT-49** — The → (initiative), ↑ (attack), and ⇆ (counterplay) buttons apply the colour-correct NAG code: White's move → `$32`/`$36`/`$40`; Black's move → `$33`/`$37`/`$41`.
- [ ] **PGNEDIT-50** — NAG changes are undoable via Cmd/Ctrl+Z.
- [ ] **PGNEDIT-51** — After saving, the PGN file contains the correct `$N` codes for the applied symbols.
- [ ] **PGNEDIT-52** — A `[%eval N.NN]` annotation in a PGN comment renders as a score pill (e.g. `+0.17`) in text and tree modes; the pill does not appear in plain mode.
- [ ] **PGNEDIT-53** — Positive scores (e.g. `+0.17`) show in green; negative scores (e.g. `-1.23`) in red; zero (`0.00`) in neutral; mate-for-mover (`#5`) in solid green; being-mated (`#-3`) in solid red.
- [ ] **PGNEDIT-54** — Clicking an eval pill opens a small popover showing the formatted evaluation value.
- [ ] **PGNEDIT-55** — The popover has a **Delete** button; clicking it removes only that `[%eval]` annotation from the comment and closes the popover.
- [ ] **PGNEDIT-56** — The popover has a **Delete all** button; clicking it removes every `[%eval]` annotation from every comment in the game.
- [ ] **PGNEDIT-57** — When a comment contains multiple `[%eval]` annotations, the pill label shows `eval N`; the popover has prev/next navigation to browse them individually.
- [ ] **PGNEDIT-58** — The `±` toggle button in the text-editor sidebar shows/hides all eval pills in text and tree modes; the button appears active (highlighted) when pills are visible.
- [ ] **PGNEDIT-59** — The `±` toggle button is disabled in plain mode.
- [ ] **PGNEDIT-60** — When eval pills are hidden via the toggle, `[%eval]` markup is still stripped from the comment display text (raw marker text is never shown to the user).

---

## SAVE — Saving games

- [ ] **SAVE-1** — Cmd/Ctrl+S saves the active game to its source (file or DB record).
- [ ] **SAVE-2** — Save button in the toolbar saves and clears the dirty flag.
- [ ] **SAVE-3** — Auto-save mode: a change is persisted automatically after a short delay.
- [ ] **SAVE-4** — Manual mode: no auto-save; dirty flag persists until explicit save.
- [ ] **SAVE-5** — Saving a game that has no source yet prompts for a location.

---

## UNDOREDO — Undo / Redo

- [ ] **UNDOREDO-1** — Cmd/Ctrl+Z undoes the last model change (move, comment, header edit).
- [ ] **UNDOREDO-2** — Cmd/Ctrl+Shift+Z (or Cmd+Y) redoes after undo.
- [ ] **UNDOREDO-3** — Making a new edit after undo clears the redo stack.
- [ ] **UNDOREDO-4** — Undo/Redo buttons in the toolbar reflect the available stack depth (disabled when empty).

---

## ENGINE — Engine analysis

- [ ] **ENGINE-1** — Menu → Engine: selecting an engine executable starts analysis.
- [ ] **ENGINE-2** — Analysis panel shows top variations updating in real time.
- [ ] **ENGINE-3** — Stop button halts analysis; panel retains the last result.
- [ ] **ENGINE-4** — Navigating to a different move restarts analysis for the new position.
- [ ] **ENGINE-5** — "Find best move" mode plays the engine's top suggestion on the board.
- [ ] **ENGINE-6** — Hovering over an individual move within a PV line shows a floating mini-board with the position after that PV move.
- [ ] **ENGINE-7** — The PV hover popup reflects the correct position computed by replaying the PV from the current board position.
- [ ] **ENGINE-8** — Moving the pointer off a PV move token dismisses the popup.
- [ ] **ENGINE-9** — With "Position preview on hover" toggled off in the menu, hovering over PV moves shows no popup.

---

## VSENGINE — Play vs engine

- [ ] **VSENGINE-1** — Menu → Play vs engine opens the setup dialog (colour, depth).
- [ ] **VSENGINE-2** — After confirm, engine replies automatically after the human's move.
- [ ] **VSENGINE-3** — Resign / Offer draw / Exit buttons work correctly.

---

## ANNOTATE — Auto-annotation

- [ ] **ANNOTATE-1** — Menu → Annotate game runs the engine over all moves.
- [ ] **ANNOTATE-2** — Blunders/mistakes/inaccuracies receive NAG symbols (?! / ? / ??) attached directly to the move node; they render as Unicode glyphs in the editor.
- [ ] **ANNOTATE-3** — Annotation completes and the dirty flag is set (changes need saving).

---

## OPENING — Opening explorer

- [ ] **OPENING-1** — Toggle in the board panel shows/hides the opening explorer.
- [ ] **OPENING-2** — Explorer fetches data for the current position from Lichess (or Masters).
- [ ] **OPENING-3** — Clicking a move in the explorer plays it on the board.
- [ ] **OPENING-4** — Source toggle (Lichess / Masters) switches the data source.
- [ ] **OPENING-5** — Explorer shows "no data" gracefully for positions outside the book.

---

## TABLEBASE — Endgame tablebase

- [ ] **TB-1** — Toggle shows/hides the tablebase panel.
- [ ] **TB-2** — For a supported endgame position, DTZ and WDL results are displayed.
- [ ] **TB-3** — Moves are ranked by DTZ (shortest win / longest resistance).
- [ ] **TB-4** — Panel shows "position not in tablebase" for unsupported material.

---

## RESOURCE — Resource viewer

- [ ] **RESOURCE-1** — Resource viewer tab/panel opens and lists games from a PGN file or `.x2chess` DB.
- [ ] **RESOURCE-2** — Clicking a game row loads it in the editor.
- [ ] **RESOURCE-3** — Group-by selector (Event, White, Black, Result, Date) regroups the list.
- [ ] **RESOURCE-4** — Filter input narrows results by the selected group-by field.
- [ ] **RESOURCE-5** — Dragging a row reorders games within the resource.
- [ ] **RESOURCE-6** — Q/A column shows the annotation badge (✓/✗/?) from the PGN.
- [ ] **RESOURCE-7** — "New game" button on the open-resource tabs row creates a blank game in that resource.
- [ ] **RESOURCE-8** — Cross-resource position search returns matching games from all open resources.
- [ ] **RESOURCE-9** — Cross-resource text search (White/Black/Event) returns matches.
- [ ] **RESOURCE-10** — Resource table headers remain left-to-right aligned with body columns while reordering, resizing, sorting, and filtering.
- [ ] **RESOURCE-11** — Group-by **Clear** button is always visible; it is disabled with no grouping and enabled once a group level is added.
- [ ] **RESOURCE-12** — With no active grouping, the toolbar explicitly shows **none** next to **Group by:**.
- [ ] **RESOURCE-13** — Opening a position-game resource (file or `.x2chess` DB) shows a `Material` column available in the column picker.
- [ ] **RESOURCE-14** — The `Material` value for a position game displays the correct key (e.g. `KQPPPvKRP`) matching the FEN header's piece count.
- [ ] **RESOURCE-15** — A standard full-game resource (no `[SetUp "1"]`) has no `Material` column in the column picker.

---

## DB — SQLite .x2chess database

- [ ] **DB-1** — Menu → New database creates a `.x2chess` file and opens it in the viewer.
- [ ] **DB-2** — Menu → Open database opens an existing `.x2chess` file.
- [ ] **DB-3** — Saving a game into a DB resource creates or updates the record.
- [ ] **DB-4** — Schema editor in the resource viewer allows adding/removing metadata fields.
- [ ] **DB-5** — Custom metadata fields (text, number, date, select, flag, game_link) appear in the game-info strip.
- [ ] **DB-6** — Conflict on save (stale revision token) shows a clear error rather than silently failing.
- [ ] **DB-7** — Importing a position game (PGN with `[SetUp "1"]` and `[FEN "..."]`) into a `.x2chess` DB creates a `Material` row in the metadata; the value is visible in the resource viewer.
- [ ] **DB-8** — Adding a field in the schema editor with type `game_link` saves successfully and the type is preserved when reopening the editor.
- [ ] **DB-9** — A `game_link` field in the game-info strip shows "None" and a "Pick…" button when empty; clicking "Pick…" opens the Game Picker dialog populated with games from the same resource.
- [ ] **DB-10** — Selecting a game in the picker closes the dialog and displays the game's label (White vs Black, or the record ID if headers are absent) as a chip; the dirty flag is set.
- [ ] **DB-11** — With a value set, the "Pick…" button reads "Change…"; clicking it re-opens the picker and replacing the selection updates the chip.
- [ ] **DB-12** — Clicking the × button on a `game_link` chip clears the value; the chip disappears and the dirty flag is set.

---

## STUDY — Study mode

- [ ] **STUDY-1** — Study mode is entered when the active game meets the requirements (has variations, comments).
- [ ] **STUDY-2** — Board is blanked until the user enters the expected move.
- [ ] **STUDY-3** — Correct move advances; incorrect move shows a hint or rejection.
- [ ] **STUDY-4** — Completing the study shows a summary screen.

---

## TRAINING — Training mode

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

---

## CURRICULUM — Training curriculum plan (.x2plan)

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

---

## WEBIMPORT — Web import (paste/drop URL)

- [ ] **WEBIMPORT-1** — Paste `https://lichess.org/<8-char-id>` opens the full game PGN.
- [ ] **WEBIMPORT-2** — Paste `https://lichess.org/training/<puzzleId>` opens the puzzle game PGN.
- [ ] **WEBIMPORT-3** — Paste `https://www.chess.com/puzzles` opens today's Chess.com daily puzzle.
- [ ] **WEBIMPORT-4** — Paste `https://www.chess.com/game/live/<id>` opens the game PGN.
- [ ] **WEBIMPORT-5** — Paste a direct `.pgn` URL fetches and opens the file.
- [ ] **WEBIMPORT-6** — Paste `https://chesspuzzle.net/Puzzle/<id>` extracts and opens the FEN (Tauri/desktop only).
- [ ] **WEBIMPORT-7** — Pasting an unrecognised URL shows an error message with a clipboard fallback hint.
- [ ] **WEBIMPORT-8** — Dropping a URL string (text/plain drag) onto the app panel triggers the same import flow.
- [ ] **WEBIMPORT-9** — Pasting a URL into a text input field (PGN editor, comment) does NOT trigger import.
- [ ] **WEBIMPORT-13** — Menu → "Web Import Rules…" opens the rules dialog.
- [ ] **WEBIMPORT-14** — Built-in rules are shown read-only at the bottom of the dialog.
- [ ] **WEBIMPORT-15** — "+ Add rule" opens a JSON editor; saving a valid rule appends it to the user rules list.
- [ ] **WEBIMPORT-16** — Edit (✎) button opens the JSON editor pre-filled; saving updates the rule.
- [ ] **WEBIMPORT-17** — Delete (×) removes a user rule from the list and from localStorage.
- [ ] **WEBIMPORT-18** — ↑/↓ buttons reorder user rules; order is reflected in URL matching.
- [ ] **WEBIMPORT-19** — "Test URL" input + button: known URL shows extracted PGN/FEN preview; unknown URL shows "No rule matches".
- [ ] **WEBIMPORT-20** — User rules take precedence over built-ins when IDs collide (tested via Test URL).

- [ ] **WEBIMPORT-10** — After pasting a URL, the remote rules manifest is fetched at startup and cached in `localStorage` under `x2chess.webImportRules.v1`.
- [ ] **WEBIMPORT-11** — If the remote rules version is higher than cached, the updated rule file is fetched and replaces the cache.
- [ ] **WEBIMPORT-12** — Rules fetched from the server take effect for URL matching without a page reload.

---

## OTA — In-app update notifications (Tauri desktop only)

- [ ] **OTA-1** — On startup the app silently checks for a new version; no visible UI appears if already up to date.
- [ ] **OTA-2** — When a newer version is found, the Menu panel shows an update banner with the version number.
- [ ] **OTA-3** — Clicking "Update & restart" starts the download; the banner shows a progress bar.
- [ ] **OTA-4** — After download completes the app relaunches automatically.
- [ ] **OTA-5** — Clicking "Later" dismisses the banner for the current session; it does not reappear until the next startup.
- [ ] **OTA-6** — If the update download fails, the banner shows an error message (not a crash).
- [ ] **OTA-7** — The update check is skipped entirely in the browser (non-Tauri) build.

---

## IMPORT — Format importers (EPD, ChessBase)

- [ ] **IMPORT-1** — Importing an `.epd` file produces one PGN game per non-blank line; each game has `[SetUp "1"]` and a valid 6-field `[FEN]` header.
- [ ] **IMPORT-2** — An EPD `id` opcode sets the `[Event]` header of the resulting PGN game.
- [ ] **IMPORT-3** — An EPD `bm` opcode sets the `[Annotator]` header (e.g. `bm: Nf6`).
- [ ] **IMPORT-4** — EPD `c0`–`c9` comments and `ce` evaluations appear as a comment block in the PGN body.
- [ ] **IMPORT-5** — Blank lines and `#`-prefixed comment lines in an `.epd` file are silently skipped.
- [ ] **IMPORT-6** — A `.cbh` or `.cbv` file triggers the `import_chessbase_file` Tauri command; on success games are imported into the active `.x2chess` database. (Requires Rust backend implementation — stub only until then.)

---

## DEVTOOLS — Developer tools

- [ ] **DEVTOOLS-1** — Dev tools dock is hidden by default in production mode.
- [ ] **DEVTOOLS-2** — Enabling dev tools (Menu → Developer tools) shows the dock at the bottom.
- [ ] **DEVTOOLS-3** — AST tab shows the current PGN model tree structure.
- [ ] **DEVTOOLS-4** — DOM tab shows the rendered PGN HTML.
- [ ] **DEVTOOLS-5** — PGN tab shows the serialised PGN text output.
- [ ] **DEVTOOLS-6** — Dev tools state persists across page refreshes (localStorage).

---

## SHORTCUTS — Keyboard shortcuts

- [ ] **KB-1** — `←` / `→` navigate moves (when not in an input field).
- [ ] **KB-6** — With a move selected, `↓` enters the first variation and `←` at variation start returns to the parent move.
- [ ] **KB-2** — `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` undo/redo.
- [ ] **KB-3** — `Cmd/Ctrl+S` saves the active game.
- [ ] **KB-4** — `F` flips the board.
- [ ] **KB-5** — `Escape` closes modal dialogs (new game, disambiguation, promotion).
