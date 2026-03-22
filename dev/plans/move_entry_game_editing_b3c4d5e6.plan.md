# Move Entry and Game Editing Plan

**File:** `move_entry_game_editing_b3c4d5e6.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Define how the user enters and modifies moves in a game, exclusively through
board interaction (drag-and-drop or click-to-move). Cover: entering the next
move, creating a variation, handling conflicts with existing moves, and
structural editing (truncation operations). No autosave — all edits are
committed explicitly.

---

## Core design constraint

**All move input is board-only.** The user never types SAN or UCI text to add
moves; only physically moving pieces on the board is accepted. This keeps the
interaction natural, consistent, and prevents illegal moves at the input layer.

---

## A. Entering a move at the end of the game

The simplest case: the user is at the last position of the mainline and makes
a move.

1. The move is validated by chess.js (illegal moves are rejected silently by
   the board — the piece snaps back).
2. The move is appended to the mainline PGN as the next move.
3. The game is **modified** (dirty flag set). A "Save" action is required to
   persist. No autosave.
4. The cursor advances to the new position.

---

## B. Entering a move in the middle of the game

When the user is at a ply that already has a following move (i.e. they are
browsing somewhere in the middle), making a different move creates a **fork**.
This is the most UX-sensitive case.

### B.1 — If the played move matches the existing next move

The cursor simply advances along the existing mainline or variation. No new
branch is created.

### B.2 — If the played move differs from the existing next move

A disambiguation dialog appears immediately (before the move is committed):

```
┌─ Continue or create variation? ─────────────────────────────────────┐
│                                                                       │
│  You played Nf6. The game continues with Nf3.                        │
│                                                                       │
│  ○ Replace the next move (Nf3 and all following moves are removed)   │
│  ● Add as a variation (Nf6 becomes an alternative to Nf3)            │
│  ○ Promote to mainline (Nf6 becomes the main move, Nf3 becomes alt)  │
│                                        [ Cancel ]  [ Confirm ]       │
└───────────────────────────────────────────────────────────────────────┘
```

Three choices:
- **Replace**: the existing next move (and all descendants) is deleted; the
  new move becomes the sole continuation. This is destructive and confirmed
  visually (the dialog shows what will be removed).
- **Add as variation**: the new move is inserted as an alternative line; the
  existing mainline is undisturbed. The cursor enters the new variation.
- **Promote to mainline**: the new move becomes the mainline; the old move
  demotes to a variation.

Default selection: **Add as variation** (safest, preserves existing content).

Cancel returns the piece to its original square.

### B.3 — If the played move already exists as a variation

The cursor enters that existing variation. No new branch is created.

---

## C. Continuing an existing variation

When the user is at the end of an existing variation and makes a move, it is
appended to that variation (same as case A, but within the variation). No
disambiguation needed.

---

## D. Visual feedback during move entry

While the user is dragging a piece (or has selected it for click-to-move):

- **Green highlight** on the source square.
- **Dotted circle** on legal target squares (always shown; cannot disable
  legal-move hints during editing — only in training mode are they hidden).
- If the board is in the **middle of the game** (a fork would be created), a
  small **"fork indicator"** badge appears near the destination square for
  moves that would differ from the existing continuation. This primes the user
  before they drop the piece.

After the piece is dropped and the disambiguation dialog is dismissed (or the
move is appended with no dialog):

- The move appears immediately in the move list / tree view.
- The dirty indicator in the tab bar / title bar activates.

---

## E. Save model

Edits are **not autosaved**. The dirty flag is set on any modification.

| State | Tab indicator |
|---|---|
| Clean | Tab shows normal title |
| Dirty | Tab title shows `●` prefix (e.g. `● My Game`) |

Save actions:
- **Ctrl/Cmd+S**: save the current game.
- **"Save" button** in the editor toolbar (always visible when dirty).
- Navigating away from a dirty game (closing tab, switching game in the
  resource viewer) triggers a "Save changes?" confirmation dialog.

The PGN model maintains an "original snapshot" at load time. The dirty flag
is derived by comparing the current PGN to the snapshot. This means undo-ing
all changes returns to a clean state.

---

## F. Undo / Redo

- **Ctrl/Cmd+Z**: undo last move-entry or truncation operation.
- **Ctrl/Cmd+Shift+Z** (or **Ctrl/Cmd+Y**): redo.
- Undo history is scoped to the current game session.
- Saving clears the undo history.

---

## G. Truncation operations

Truncation operations are accessible from:
1. **Right-click context menu** on any move in the tree/text view.
2. **Editor toolbar** (acts on the current cursor position).

### G.1 — Delete this move and everything after it

Removes the move at the cursor and all descendants in the current line. If
the cursor is on a mainline move, this truncates the mainline. If on a
variation move, this truncates the variation (and the variation node itself
if it becomes empty).

Confirmation required (shows count of moves to be removed):

```
Remove move Nf6 and the 14 following moves?
[ Cancel ]  [ Remove ]
```

### G.2 — Delete all moves before this position

Removes all moves before the current cursor position. The current position
becomes the new starting FEN. All prior mainline moves and all variations that
branch off them are deleted.

Confirmation required. Particularly important: once done, the starting FEN
is set in the PGN headers (`[SetUp "1"]`, `[FEN "..."]`). The game becomes a
"position" game starting from mid-game.

### G.3 — Delete a variation

Removes an entire variation subtree. Accessible from the variation's first
move.

### G.4 — Delete all variations from this point

Removes all alternative lines that diverge at or after the current position,
keeping only the mainline from this position forward. Useful when analysis
variations have accumulated and the user wants to "clean" a game.

---

## H. Variation management

Beyond deletion, the user can:

- **Promote variation to mainline**: swaps the variation and the current
  mainline so the variation becomes the main continuation. The previous
  mainline becomes a variation.
- **Demote mainline to variation**: the reverse.

Both are accessible from right-click on the variation's first move.

---

## I. Handling NAGs and comments during editing

When a move is replaced (option "Replace" in the dialog), its NAGs and inline
comments are discarded. This is noted in the dialog:

```
○ Replace the next move
  Warning: the comment "15.Nf3 ± " and 1 annotation will be removed.
```

When a move is added as a variation, any comments on the mainline move are
preserved on the mainline.

---

## J. Fischer-Random (Chess960) moves

- Castling notation: board displays castling as king sliding to the rook
  square (Fischer-Random standard). Internally stored as O-O / O-O-O.
- The board handles disambiguating king-captures-rook from a normal capture
  based on the castling rights in the current position.

---

## K. Promotion

When a pawn reaches the back rank:
- A promotion picker appears immediately (Queen, Rook, Bishop, Knight as four
  small piece icons).
- The default (highlighted) is Queen.
- Clicking a piece or pressing Escape (= Queen) completes the move.

---

## Implementation notes

### PGN model operations needed

```typescript
// Append move at the cursor position (end of current line)
appendMove(cursor: PgnCursor, move: SanMove): PgnCursor;

// Insert move as a new variation at the cursor (not at the end of a line)
insertVariation(cursor: PgnCursor, move: SanMove): PgnCursor;

// Replace move at cursor (deletes cursor node and all descendants; inserts new move)
replaceMove(cursor: PgnCursor, move: SanMove): PgnCursor;

// Promote variation at cursor to mainline
promoteToMainline(cursor: PgnCursor): PgnCursor;

// Truncate: remove node at cursor and all descendants in current line
truncateAfter(cursor: PgnCursor): PgnCursor;

// Truncate: remove all moves before cursor; set starting FEN
truncateBefore(cursor: PgnCursor): PgnCursor;

// Delete the entire variation that cursor belongs to
deleteVariation(cursor: PgnCursor): PgnCursor;

// Delete all variations from this point
deleteVariationsAfter(cursor: PgnCursor): PgnCursor;
```

### Component responsibility

| Component | Responsibility |
|---|---|
| `ChessBoard` | Drag-and-drop / click-to-move; emits `onMovePlayed(from, to, promotion?)` |
| `MoveEntryController` | Receives `onMovePlayed`; resolves against PGN cursor; shows disambiguation dialog |
| `DisambiguationDialog` | "Replace / Add variation / Promote" dialog |
| `PromotionPicker` | Promotion piece selection |
| `TruncationMenu` | Context menu items + confirmation dialogs for truncation ops |

`MoveEntryController` is a pure-logic class; all UI is in the React components.

---

## Implementation phases

| Phase | Deliverable |
|---|---|
| M1 | PGN model operations: `appendMove`, `insertVariation`, `replaceMove`, `truncateAfter`, `truncateBefore`, `deleteVariation` |
| M2 | `MoveEntryController` — fork detection + disambiguation dialog |
| M3 | `PromotionPicker` component |
| M4 | Dirty flag + "Save" button + tab indicator |
| M5 | Undo/Redo stack |
| M6 | Truncation context menu (`TruncationMenu`) |
| M7 | Variation management: promote/demote |
| M8 | "Navigate away from dirty game" guard |
