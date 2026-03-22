# New Game Setup Plan

**File:** `new_game_setup_e5f6a7b8.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Provide a "New Game" dialog that lets the user start a game either from the
classical starting position or from a custom position. The dialog captures:
- Starting position (standard or custom FEN)
- Castling rights
- Side to move
- Basic metadata (optional at creation time)

New games created in a resource are added to the resource and opened in the
editor. Games not in a resource start as unsaved sessions.

---

## Dialog design

### Tab 1: Starting position

```
┌─ New Game ─────────────────────────────────────────────────────────┐
│                                                                      │
│  [● Standard starting position]  [ Custom position ]                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  (8×8 board preview — standard initial setup)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [ Cancel ]  [ Next: Metadata → ]                                    │
└──────────────────────────────────────────────────────────────────────┘
```

When "Custom position" is selected:

```
┌─ New Game ─────────────────────────────────────────────────────────┐
│                                                                      │
│  [ Standard starting position ]  [● Custom position ]               │
│                                                                      │
│  FEN:  [rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1]│
│         ✓ Valid position                                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  (8×8 interactive board — pieces can be dragged to set up)  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Side to move:     ● White   ○ Black                                 │
│                                                                      │
│  Castling rights:  ☑ White O-O   ☑ White O-O-O                      │
│                    ☑ Black O-O   ☑ Black O-O-O                      │
│                    (auto-detected from piece positions; can override) │
│                                                                      │
│  En passant:       ○ None   ● Square: [e3  ]   (from FEN, or pick)  │
│                                                                      │
│  [ Cancel ]  [ Next: Metadata → ]                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Interactive position setup

The "Custom position" board allows:
- **Drag pieces** between squares to rearrange.
- **Right-click a square** → pick piece to place (or "empty square").
- **Drag poiece from selection panel**: panel shows all possible pieces, user can just drag from there.
- **"Clear board"** button → empty all squares.
- **"Standard"** button → reset to standard starting position.
- **"Mirror"** button → flip color of all pieces.

The FEN field is live-updated as pieces are moved on the board.
The board is live-updated when the user edits the FEN field directly.

Validation:
- Both kings must be present (exactl once!).
- The side NOT to move must not be in check.
- Invalid FEN shows red border on the FEN input with an error message.

### Tab 2: Metadata (optional)

```
┌─ New Game — Metadata (optional) ──────────────────────────────────┐
│                                                                     │
│  White:   [                    ]   WhiteElo: [    ]                 │
│  Black:   [                    ]   BlackElo: [    ]                 │
│  Event:   [                    ]                                    │
│  Site:    [                    ]                                    │
│  Date:    [ dd ] . [ mm ] . [ yyyy ]   (today by default)          │
│  Round:   [    ]                                                    │
│  Result:  [*  ▾]                                                    │
│                                                                     │
│  (Additional fields shown if the target resource has a schema.)     │
│                                                                     │
│  [ ← Back ]   [ Cancel ]   [ Create game ]                         │
└─────────────────────────────────────────────────────────────────────┘
```

Metadata is optional — the user can click "Create game" with all fields
empty. Default values:
- `Date`: today's date.
- `Result`: `*` (game in progress).

---

## Fischer-Random (Chess960) support

When the selected position has the characteristic Chess960 back-rank setup
(no standard piece order but a legal Chess960 starting position), the dialog
detects this and shows:

```
  ☑ Fischer-Random starting position (Chess960)
      Castling: White O-O with Rg1  /  Black O-O-O with Ra8
```

The `[FEN "..."]` and `[SetUp "1"]` headers are added automatically.
Castling rights in the FEN reflect the rook file (X-FEN notation).

---

## Target resource

When the "New game" action is triggered from:
- **The resource viewer** (Games tab): the game is added to the active
  resource. The dialog shows the resource name at the top.
- **The toolbar / main menu**: a resource picker is shown as a first step
  (or the game is created as an unsaved standalone session if no resource
  is chosen).
- **The editor** when no resource is open: creates an unsaved session.

---

## PGN generation

On "Create game", the adapter:
1. If the position is the standard starting position: generates a minimal
   PGN with only the metadata headers and `*` as the result token.
2. If the position is custom: adds `[SetUp "1"]` and `[FEN "..."]` headers.
3. If Chess960: also adds `[Variant "Chess960"]` (for compatibility with
   other tools).

The new game is opened immediately in the editor with the cursor at the start
position (no moves yet). If saved to a resource, it appears in the resource
viewer sorted by `order_index` (appended at the end).

---

## "Edit starting position" (for existing games)

Beyond new game creation, a game with a `[SetUp]` header gains an
"Edit starting position" action in the game menu. This re-opens the custom
position dialog pre-filled with the current FEN. Editing the starting
position resets the entire move tree (confirmation required: "Changing the
starting position will remove all recorded moves. Continue?").

---

## Implementation phases

| Phase | Deliverable |
|---|---|
| NG1 | `PositionSetupBoard` component — interactive piece placement |
| NG2 | FEN input + validation + bi-directional sync with board |
| NG3 | `NewGameDialog` — tab 1 (starting position) |
| NG4 | `NewGameDialog` — tab 2 (metadata); uses type-aware inputs from MD5 |
| NG5 | Chess960 detection and FEN generation |
| NG6 | "New game" action in resource viewer + toolbar |
| NG7 | "Edit starting position" action on existing SetUp games |
