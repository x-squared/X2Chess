# Resource Viewer UX Design Notes

**File:** `resource_viewer_ux_c2d3e4f5.plan.md`
**Status:** Draft — design decisions needed.

---

## 1. DnD conflict: column header rearrangement vs file drop

### Problem

The resource viewer supports two distinct drag-and-drop operations:
1. **Game row reordering**: drag a game row up/down to change its order.
2. **File drop**: drag a PGN file from the OS file manager onto the viewer
   to import it.

These two operations conflict: when the user starts dragging a column
header to rearrange columns, the browser's native drag machinery also
triggers the file-drop zone, which steals events and blocks the header drag.

### Solution: restrict the file drop zone

The file-drop overlay should **not cover the table header row**. Only the
table body (`<tbody>`) is a drop target for files. The column header
rearrangement drag lives entirely in the `<thead>`.

Implementation:
- Remove `dragover` / `drop` listeners from the root viewer container.
- Attach file-drop listeners to the `<tbody>` element only (or an explicit
  drop zone overlay that appears on top of `<tbody>` during a file drag).
- Detect file vs row drag: `event.dataTransfer.types` includes `"Files"` for
  OS file drags; row drag uses a custom MIME type (e.g.
  `application/x-x2chess-row`). Use this to suppress the drop overlay when
  the drag is not a file.
- Column header drag does not set any `dataTransfer` type at all — it uses
  only `mousedown`/`mousemove`/`mouseup` if implemented as a pointer-based
  drag to avoid the browser default DnD machinery entirely. This is the
  recommended approach: use **CSS `cursor: col-resize`** + pointer events
  rather than the HTML5 drag API for header reordering.

---

## 2. Filter and group by metadata in the resource viewer

### 2a. Column filters (already in progress)

A filter row under the column headers (per-column text inputs) is already
designed (see `ResourceTable` plan). This handles free-text substring
filtering per column.

Enhancements needed:
- **Type-aware filtering** when a metadata schema is active:
  - `date` columns: filter by partial date (year only, or mm.yyyy).
  - `select` columns: filter input changes to a dropdown of valid values
    (multi-select checkboxes in a popover, like a spreadsheet filter).
  - `number` columns: support `>`, `<`, `=` prefix operators (e.g. `>2200`).
- **Clear all filters** button in the filter row (appears when any filter
  is active).

### 2b. Grouping (multi-level)

Grouping collapses the game list into a hierarchy of nested groups, each
level determined by a metadata field. The user selects one or more fields
in a specific order; that order defines the grouping levels.

**Example**: Group by `[Event, Round]` produces:

```
▼ Bundesliga 2025/26
    ▼ Round 11
        Bluebaum — Indjic   1-0
        Müller — Schmidt     ½-½
    ▶ Round 10   (4 games)   [collapsed]
▶ Bundesliga 2024/25  (12 games)   [collapsed]
```

**Example**: Group by `[Event]` only (single level):

```
▼ Bundesliga 2025/26  (8 games)
   Game-1  Bluebaum — Indjic   1-0
▶ Bundesliga 2024/25  (12 games)   [collapsed]
```

#### Group-by configuration UI

A `Group by:` builder in the resource viewer toolbar (opens as a popover):

```
┌─ Group by ──────────────────────────────┐
│  1. Event    [×]  ↑↓                    │
│  2. Round    [×]  ↑↓                    │
│  [ + Add level ]                        │
│              [ Clear all ]   [ Apply ]  │
└─────────────────────────────────────────┘
```

- `+Add level` shows a dropdown of available metadata fields.
- `↑↓` reorders the levels (changes hierarchy depth).
- `[×]` removes a level.
- Changes are applied immediately on "Apply" (or on each interaction if
  the list is small enough).

#### Persistence

Group-by configuration is saved to `localStorage` keyed by resource path
(or DB path). Format:

```json
{ "groupBy": ["Event", "Round"], "collapsedGroups": ["Bundesliga 2024/25"] }
```

This is restored when the resource tab is re-opened after a restart. The
key is `x2chess.groupby.<resourcePath>`.

#### Implementation notes

- Grouping is entirely client-side (applied to already-loaded `rows`).
- Within each group at the leaf level, rows keep their `order_index` order.
- Groups at each level sort by the group key value (alphabetically) by
  default; secondary sort by the first row's `order_index`.
- Collapse state is per-group-key and per-level. All groups start expanded
  unless the persisted state says otherwise.
- State: `groupByFields: string[]`, `collapsedGroupKeys: Set<string>`
  (encoded as `"level:value"` to handle multi-level keys).

### 2c. Sort by column

Click a column header to sort ascending; click again for descending; click
again to restore default order. Sort interacts with group-by: within each
group, sort applies; groups themselves sort by the group key.

Sort is client-side (does not re-query the DB). For very large resources
(10,000+ games), client-side sort may need to be replaced by a DB query.
This is a deferred concern.

---

## 3. Position extraction

### Goal

From any position in an open game, the user can extract that position as a
new game or position entry in a resource. "Extract" means:
- Truncate the game at the selected ply (all moves before the selected ply
  become the new game's preamble, or the game starts at the selected
  position with `[SetUp]`+`[FEN]` headers).
- Copy the relevant metadata from the source game.
- Offer the user a target resource and a metadata confirmation dialog.

### Extraction dialog

```
┌─ Extract Position ──────────────────────────────────────────────────┐
│                                                                       │
│  Position after:  12…Rf8  (move 12, Black)                           │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  (Small board preview showing the selected position)        │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Target resource:  [My Study Collection     ▾]  [ + New resource ]   │
│                                                                       │
│  How to extract:                                                      │
│    ● Position only (FEN start — no preceding moves)                  │
│    ○ Include preceding moves                                          │
│                                                                       │
│  Intro comment:  [Position from Bluebaum–Indjic, Bundesliga 2026]    │
│                  (becomes the first comment of the extracted game)    │
│                                                                       │
│  Metadata (carried over from source, edit as needed):                │
│    White:   [Bluebaum, Matthias     ]  WhiteElo: [2679]              │
│    Black:   [Indjic, Aleksandar     ]  BlackElo: [2635]              │
│    Event:   [Bundesliga 2025/26     ]                                │
│    Date:    [10.01.2026]  Round: [11.1]                              │
│    (+ any extra fields the target resource schema requires)           │
│                                                                       │
│  [ Cancel ]                              [ Extract ]                  │
└───────────────────────────────────────────────────────────────────────┘
```

### What happens on extract

1. The source game's PGN is processed up to the selected ply.
2. Depending on the extraction mode:
   - **Position only**: a new PGN is created with `[SetUp "1"]` + `[FEN "..."]`
     and no moves. The intro comment and metadata are applied as headers.
   - **Include preceding moves**: the PGN is truncated at the selected ply
     (all moves from 1 to ply N inclusive). The intro comment is prepended.
3. The new game is added to the target resource (appended at the end).
4. The extracted game is immediately opened in the editor.

### Trigger

- Right-click on a move in the editor → "Extract position here…"
- Toolbar button (appears when the editor is open): "Extract current position"

---

## 4. Game vs Position distinction

### Definition

| Kind | Definition |
|---|---|
| **Full game** | Starts from the standard starting position (or a Chess960 variant start). Typically ends with a result. |
| **Position** | Starts from a custom FEN (`[SetUp "1"]`). May be a mid-game position, a study position, or a puzzle. |

The distinction is already implicit in the PGN standard (`[SetUp]` / `[FEN]`
headers). X2Chess makes it explicit in the resource viewer.

### Storage

The `games` table gains a `kind` column in schema version 3:

```sql
ALTER TABLE games ADD COLUMN kind TEXT NOT NULL DEFAULT 'game';
-- Values: 'game' | 'position'
```

For directory resources, `kind` is stored in `.x2chess-meta.json` per game
entry.

For detection at import time:
- If `[SetUp "1"]` is present → `kind = 'position'`.
- Otherwise → `kind = 'game'`.

### UI

A small icon badge on each row in the resource viewer indicates kind:
- ♟ (pawn) for full games.
- ⊞ (position marker) for positions.

The `kind` is also a filterable/groupable column.

---

## 5. Q/A annotation system

### Problem

Training formats (tactics, guess-the-move, study) benefit from having a
question and expected answer attached to a game or a specific position
within a game.

Simply using metadata fields (`Question` / `Answer` keys) is fragile:
- Easy to accidentally delete.
- Not associated with a specific ply (game-level only).
- No enforcement of the pair relationship.

### Proposal: QA annotations as a first-class PGN extension

#### Option A — Custom PGN command annotations (recommended)

Embed Q/A as structured PGN comments using a reserved prefix:

```
{ [%qa question="What is the strongest move here?" answer="Nd5!
The knight centralization wins material by force." hint="Look for
a fork targeting the queen and the rook."] }
```

The `[%...]` syntax is the standard PGN extension format for command
annotations (already used by Chessbase, Lichess, etc. for `%cal`, `%csl`,
`%clk`, `%eval`). A `%qa` command is easy to parse, survives round-trip
through any PGN tool that doesn't strip unknown commands, and is ply-local
(attached to the specific move it follows).

#### Format spec

```
[%qa question="..." answer="..." hint="..."]
```

- `question`: required. The question to pose to the user.
- `answer`: required. The expected answer / explanation.
- `hint`: optional. An intermediate hint shown before revealing the answer.
- All fields are double-quoted; backslash-escaping for `"` inside.

Multiple Q/A pairs at the same ply are allowed (separate `[%qa ...]`
commands).

#### Inserting a Q/A annotation

From any move in any editor mode:

- **Right-click a move token** → context menu includes "Add Q/A here…"
- **Keyboard shortcut** (when a move is selected): `Ctrl/Cmd+Shift+Q`

This opens a small inline popover anchored to the move:

```
┌─ Add Q/A ──────────────────────────────────────────┐
│  Question:                                          │
│  ┌─────────────────────────────────────────────┐   │
│  │ What is White's plan from this position?    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Answer:                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ 13.Nd5 centralises with a fork threat,      │   │
│  │ winning material.                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Hint (optional):                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Look for a knight fork on d5.               │   │
│  └─────────────────────────────────────────────┘   │
│                                [ Cancel ]  [ Save ] │
└─────────────────────────────────────────────────────┘
```

On save, the `[%qa ...]` command is embedded in the PGN comment following
that move. The game becomes dirty (requires explicit save).

Editing an existing Q/A: clicking the visual indicator (see below) opens
the same popover pre-filled with the existing values. A "Delete" button
removes the annotation.

#### Visual indicator on moves with Q/A

In text and tree modes, every move that carries a `[%qa]` annotation
displays a small **`?`** badge to its right (styled as a pill or circle):

```
12…Rf8  ?   13 Nd5  ?   13…Qf8
```

Clicking the `?` badge opens a compact read-only display anchored to the
badge:

```
┌─────────────────────────────────────────────────┐
│  ? What is White's plan from this position?     │
│                                                 │
│  [ Show hint ]        [ Show answer ]           │
└─────────────────────────────────────────────────┘
```

- "Show hint" progressively reveals the hint text (replaces button with
  the hint text).
- "Show answer" reveals the full answer.
- Clicking outside the popover closes it.
- An "Edit" link in the popover corner opens the edit form.

Multiple Q/A at the same ply: the badge shows the count (`?2`) and cycling
through them is possible with prev/next arrows inside the popover.

#### Modes

| Mode | Q/A rendering |
|---|---|
| **text** | `?` badge after the move token; popover on click |
| **tree** | `?` badge after the move token in each variation block |
| **plain** | The raw `{ [%qa question="..." answer="..."] }` text is shown literally in the comment stream (no special rendering) |

In plain mode the raw text is intentionally visible — plain mode is the
"see everything as-is" mode. Users editing PGN directly in plain mode can
write `[%qa ...]` commands manually.

#### Inline Q/A in a game (the "study book" concept)

Q/A annotations can appear at any ply in a game, not just at the start.
This enables a "study book" format where the user reads through a game and
encounters embedded questions at key moments — pause, think, then reveal
the answer.

This creates a "study mode" distinct from "replay mode":
- **Replay**: reproduce the game's moves.
- **Study**: navigate the game and respond to embedded Q/A prompts.

#### Game-level Q/A (for the whole game / position)

A `[%qa ...]` in the very first comment (before move 1) is a game-level
question. Displayed in the resource viewer as a `?` badge on the game row.
In the text view it appears in the intro area above the move flow.

#### Storage

For `.x2chess` DB: `[%qa ...]` is stored inside `pgn_text`. A SQLite
generated column or a `pgn_text LIKE '%[%qa%'` index can flag games that
contain Q/A annotations.

For export: the `[%qa ...]` commands survive PGN export. Tools that don't
recognise `%qa` display the raw text inside the comment brackets —
acceptable and human-readable.

#### Robustness vs metadata approach

| Property | `[%qa]` annotation | Metadata key |
|---|---|---|
| Ply-local | ✓ | ✗ (game-level only) |
| Survives PGN round-trip | ✓ (as raw comment) | ✗ (lost on re-import) |
| Accidental deletion risk | Low (ply-embedded) | High (separate field) |
| Multiple Q/A per game | ✓ | Fragile |
| Standard PGN extension format | ✓ | ✗ |
| Human-readable in raw PGN | ✓ | ✓ |

Metadata `Question`/`Answer` keys must not be used; `[%qa]` is the
canonical approach.

### Training integration

The training mode plan references Q/A support as a future protocol
enhancement. The `[%qa]` annotation provides the data model. A "study"
training protocol reads `[%qa]` annotations from the PGN and surfaces them
as interactive prompts during the session.

---

## Implementation phases

| Phase | Deliverable |
|---|---|
| UV1 | DnD zone restriction (file drop on `<tbody>` only; pointer-drag for headers) |
| UV2 | Type-aware column filters (select dropover; date partial; number operators) |
| UV3 | Multi-level group-by builder (popover) + accordion groups; `localStorage` persistence |
| UV4 | Client-side sort by column |
| UV5 | "Extract position" dialog + extraction logic |
| UV6 | `kind` column in DB schema + detection on import |
| UV7 | Kind badge in resource viewer |
| UV8 | `[%qa]` parser (extract question/answer/hint from PGN comment string) |
| UV9 | `?` badge visual indicator on moves with Q/A in text and tree modes |
| UV10 | Q/A insert popover (right-click → "Add Q/A here…" + Ctrl+Shift+Q) |
| UV11 | Q/A read popover (click `?` badge → show question, hint, answer) |
| UV12 | Study mode (navigate game with sequential Q/A prompts) |
