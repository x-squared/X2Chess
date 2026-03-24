# X2Chess Manual Test Checklist

**How to use:**
- Work through sections relevant to the change just made.
- Mark items `[x]` as you verify them.
- To report a failure, reference the item ID (e.g. "BOARD-3 doesn't work — knight promotion menu doesn't appear").
- Reset `[x]` back to `[ ]` whenever the item is re-opened by a later change.

**Last updated:** 2026-03-24

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

---

## VSENGINE — Play vs engine

- [ ] **VSENGINE-1** — Menu → Play vs engine opens the setup dialog (colour, depth).
- [ ] **VSENGINE-2** — After confirm, engine replies automatically after the human's move.
- [ ] **VSENGINE-3** — Resign / Offer draw / Exit buttons work correctly.

---

## ANNOTATE — Auto-annotation

- [ ] **ANNOTATE-1** — Menu → Annotate game runs the engine over all moves.
- [ ] **ANNOTATE-2** — Blunders/mistakes/inaccuracies are marked with `?!` / `?` / `??` comments in the PGN.
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

---

## DB — SQLite .x2chess database

- [ ] **DB-1** — Menu → New database creates a `.x2chess` file and opens it in the viewer.
- [ ] **DB-2** — Menu → Open database opens an existing `.x2chess` file.
- [ ] **DB-3** — Saving a game into a DB resource creates or updates the record.
- [ ] **DB-4** — Schema editor in the resource viewer allows adding/removing metadata fields.
- [ ] **DB-5** — Custom metadata fields (text, number, date, select) appear in the game-info strip.
- [ ] **DB-6** — Conflict on save (stale revision token) shows a clear error rather than silently failing.

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
