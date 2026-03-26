# Game Anchors — Plan

**ID:** game_anchors_b4c5d6e7
**Status:** Draft — design complete, ready for implementation.

---

## Goal

Allow the user to place named **anchors** at any half-move in a game, and to
**reference** those anchors from comments elsewhere in the same game.  An anchor
is lightweight structural metadata — like a chapter marker — that travels with
the PGN.

---

## PGN encoding

### Anchor definition

Placed in a PGN comment following the move that carries the anchor:

```
{ [%anchor id="intro" text="The critical junction"] }
```

- `id` — required; short string, unique within the game (e.g. `intro`, `trap`,
  `rook-ending`).  The uniqueness constraint is enforced at insert time by the
  UI; the parser accepts duplicates without error (first definition wins for
  resolution).
- `text` — required; human-readable label shown in lists and hover tooltips.
- Uses the standard PGN `[%...]` extension syntax (same as `%qa`, `%todo`,
  `%link`).

### Anchor reference

Embedded inside any comment at any other move:

```
{ See [%anchorref id="intro"] for context. }
```

- `id` — required; refers to an anchor defined elsewhere in the same game.
- A reference renders as an inline chip in text/tree modes.  Raw text is shown
  in plain mode.

---

## Concepts and UX flows

### A — Placing an anchor definition

Trigger: right-click a move token → "Add anchor here…" (or a toolbar button
when a move is selected).

Opens the **Anchor Definition Dialog**.  The dialog has two areas:

**Top** — form to define the new anchor:
```
  ID:    [intro               ]
  Text:  [The critical junction]
         [ Cancel ]  [ Place anchor ]
```

The ID field pre-fills with a suggestion based on the move number (e.g.
`m14b` for move 14 Black); the user can change it.  If the typed ID is already
taken, the field shows an inline warning and the "Place anchor" button is
disabled.

**Bottom** — "Existing anchors in this game" list (see §C).

On confirm: `[%anchor id="..." text="..."]` is appended to the comment
following the target move.  The game becomes dirty.

### B — Inserting an anchor reference

Trigger: right-click a move or comment token → "Insert anchor reference…" (or
toolbar button).

Opens the **Anchor Picker Dialog** — the rich anchor list (see §C).  Clicking
an anchor row inserts `[%anchorref id="..."]` into the comment at the current
cursor position.  The game becomes dirty.

### C — The anchor list (shared by both dialogs)

Each row in the anchor list displays:

| Element | Detail |
|---|---|
| **(a) Anchor text** | The `text` field — primary label, bold |
| **(b) ID badge** | The `id` value in a small monospace pill |
| **(c) Context comments** | The displayable-text portion (stripped of `%`-commands) of the comment immediately preceding the anchor move and the comment immediately following (post-anchor move comment); shown in a muted small-font block |
| **(d) Moves-to-anchor toggle** | A `⋯` icon button; clicking expands an inline block showing the full SAN sequence from the start of the game (or variation) to this anchor move (e.g. `1 e4 e5 2 Nf3 Nc6 3 Bb5 …13 Rd1`).  Collapsed by default. |
| **(e) Position preview icon** | A small board icon (♔ or ⊞); hovering shows a `MiniBoard` popup (reusing `HoverPreviewContext` + `MiniBoard` from the hover-position-preview plan) at the FEN after the anchor move |

The list is filtered by a search input (substring match on `text` + `id`).

### D — Hover over an anchor reference chip

When the user hovers over a rendered `[%anchorref id="..."]` chip in text/tree
mode, a tooltip appears showing:

- The `text` of the referenced anchor.
- A `MiniBoard` (200 × 200) showing the position after the anchor move.
- If the anchor `id` is not found in the game, the chip renders with a warning
  style and the tooltip shows "Anchor not found".

Implemented via the same `HoverPreviewContext` used for move-hover previews.
The chip receives the FEN at the anchor move (pre-computed when the plan is
built) as a prop.

---

## Architecture overview

```
resources_viewer/anchor_parser.ts      Pure parser: [%anchor ...] + [%anchorref ...]
editor/useAnchorDefDialog.ts           Hook: anchor definition dialog state
editor/useAnchorRefDialog.ts           Hook: anchor picker state for references
components/AnchorDefDialog.tsx         Dialog: define a new anchor
components/AnchorPickerDialog.tsx      Dialog: pick an anchor when inserting a ref
components/AnchorChip.tsx             Inline chip for [%anchorref ...] in comments
editor/plan/types.ts                   CommentToken carries anchorAnnotations + anchorRefAnnotations
editor/plan/text_mode.ts              Populate anchor data at plan-build time
editor/plan/plain_mode.ts             Populate anchor data
components/PgnTextEditor.tsx          Wire dialogs + chips + definition badges
```

---

## Phase 1 — Parser: `resources_viewer/anchor_parser.ts`

New file, same structure as `qa_parser.ts`.

```ts
// ── Types ─────────────────────────────────────────────────────────────────────

export type AnchorAnnotation = {
  id: string;
  text: string;
};

export type AnchorRefAnnotation = {
  id: string;
};

// ── Exports ───────────────────────────────────────────────────────────────────

/** Parse all [%anchor ...] annotations from a PGN comment string. */
export const parseAnchorAnnotations = (commentText: string): AnchorAnnotation[]

/** Return true if the comment contains at least one [%anchor ...]. */
export const hasAnchorAnnotations = (commentText: string): boolean

/** Remove all [%anchor ...] from a comment string (for display). */
export const stripAnchorAnnotations = (commentText: string): string

/** Build a [%anchor id="..." text="..."] command string. */
export const formatAnchorAnnotation = (anchor: AnchorAnnotation): string

/** Replace the anchor at index in rawText with annotation (null = delete). */
export const replaceAnchorAnnotation = (rawText: string, index: number, annotation: AnchorAnnotation | null): string

/** Append a new anchor annotation to rawText. */
export const appendAnchorAnnotation = (rawText: string, annotation: AnchorAnnotation): string

// ── Reference variants ────────────────────────────────────────────────────────

export const parseAnchorRefAnnotations = (commentText: string): AnchorRefAnnotation[]
export const hasAnchorRefAnnotations = (commentText: string): boolean
export const stripAnchorRefAnnotations = (commentText: string): string
export const formatAnchorRefAnnotation = (ref: AnchorRefAnnotation): string
export const replaceAnchorRefAnnotation = (rawText: string, index: number, ref: AnchorRefAnnotation | null): string
export const appendAnchorRefAnnotation = (rawText: string, ref: AnchorRefAnnotation): string
```

---

## Phase 2 — Token changes

### 2.1 `editor/plan/types.ts`

Extend `CommentToken` with two new fields:

```ts
/** Anchors defined in this comment (parsed at plan-build time). */
anchorAnnotations: AnchorAnnotation[];

/** Anchor references embedded in this comment (parsed at plan-build time). */
anchorRefAnnotations: AnchorRefAnnotation[];
```

Both default to `[]` for all existing comment token emitters.

### 2.2 `editor/plan/text_mode.ts` and `plain_mode.ts`

When emitting a `CommentToken`, call:
```ts
anchorAnnotations: parseAnchorAnnotations(rawText),
anchorRefAnnotations: parseAnchorRefAnnotations(rawText),
```

The `text` field (already computed for display) runs through `stripAnchorAnnotations`
and `stripAnchorRefAnnotations` in addition to the existing strips.

### 2.3 Resolved FEN on tokens

To support the position-preview icon in the anchor list and chip hover, each
anchor in the list needs the FEN at its move.  This is resolved when building
the anchor list from the PGN model using `resolveMovePositionById(pgnModel, moveId)`
(pure-logic, already planned in `move_position.ts`).  The resolved FEN is passed
into dialog and chip props — it is not stored on the token.

---

## Phase 3 — Anchor definition dialog

### 3.1 `editor/useAnchorDefDialog.ts`

```ts
export type AnchorDefDialogState = {
  targetMoveId: string;       // move where the anchor will be placed
  existingCommentId: string;  // comment id to append to (or empty string = create new)
  existingRawText: string;    // current raw text of that comment
  suggestedId: string;        // pre-filled default ID
};

export type UseAnchorDefDialogResult = {
  anchorDefDialog: AnchorDefDialogState | null;
  handleOpenAnchorDefDialog: (moveId: string) => void;
  handleConfirmAnchorDef: (id: string, text: string) => void;
  handleCloseAnchorDefDialog: () => void;
};
```

`handleOpenAnchorDefDialog` computes a suggested ID from the move number
(e.g. `m14b`) and looks up the existing comment for that move to pass as
`existingRawText`.

`handleConfirmAnchorDef` calls `appendAnchorAnnotation(existingRawText, { id, text })`,
then dispatches `saveCommentText` (existing service method).

### 3.2 `components/AnchorDefDialog.tsx`

Props:
```ts
{
  state: AnchorDefDialogState;
  allAnchors: ResolvedAnchor[];   // built from pgnModel for the "existing anchors" list
  pgnModel: PgnModel;
  onConfirm: (id: string, text: string) => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
}
```

`ResolvedAnchor` (see §5) is produced from the pgnModel in `PgnTextEditor`
before opening the dialog.

Layout:
```
┌─ Add anchor ────────────────────────────────────────────────┐
│                                                              │
│  ID:    [intro                ]  ← short identifier          │
│  Text:  [The critical junction]  ← human-readable label     │
│                                                              │
│  ⚠ ID "intro" is already used.  (shown only if conflict)    │
│                                                              │
│  ──── Existing anchors in this game ────────────────────    │
│  [AnchorList component — see §C]                            │
│                                                              │
│                            [ Cancel ]  [ Place anchor ]     │
└──────────────────────────────────────────────────────────────┘
```

"Place anchor" is disabled when: ID is empty, text is empty, or ID conflicts
with an existing anchor.

---

## Phase 4 — Anchor picker dialog (for references)

### 4.1 `editor/useAnchorRefDialog.ts`

```ts
export type AnchorRefDialogState = {
  targetCommentId: string;   // comment receiving the [%anchorref ...]
  rawText: string;           // current raw text of that comment
  editIndex: number;         // -1 for insert; ≥0 for editing existing ref
};

export type UseAnchorRefDialogResult = {
  anchorRefDialog: AnchorRefDialogState | null;
  handleOpenAnchorRefDialog: (commentId: string, rawText: string, editIndex?: number) => void;
  handleConfirmAnchorRef: (id: string) => void;
  handleDeleteAnchorRef: (commentId: string, index: number, rawText: string) => void;
  handleCloseAnchorRefDialog: () => void;
};
```

`handleConfirmAnchorRef` calls `appendAnchorRefAnnotation` (insert) or
`replaceAnchorRefAnnotation` (edit), then dispatches `saveCommentText`.

### 4.2 `components/AnchorPickerDialog.tsx`

```ts
{
  allAnchors: ResolvedAnchor[];
  pgnModel: PgnModel;
  editIndex: number;          // -1 = insert; pre-selects row when editing
  onSelect: (id: string) => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
}
```

Layout:
```
┌─ Insert anchor reference ────────────────────────────────────┐
│                                                               │
│  Search: [                    ]                               │
│                                                               │
│  [AnchorList component — see §C]                             │
│                                                               │
│                              [ Cancel ]                       │
└───────────────────────────────────────────────────────────────┘
```

Clicking a row calls `onSelect(anchor.id)` and closes.

---

## Phase 5 — `ResolvedAnchor` type and list building

### 5.1 Type

`ResolvedAnchor` is a runtime-only type (not stored in PGN).  Built in
`PgnTextEditor` from the `pgnModel` immediately before opening either dialog.

```ts
// editor/resolveAnchors.ts  — new pure-logic file

export type ResolvedAnchor = {
  id: string;
  text: string;
  moveId: string;
  /** SAN and color at the anchor move (e.g. "Nd5", "black"). */
  moveSan: string;
  /** FEN after the anchor move (for position preview). */
  fen: string;
  lastMove: [string, string] | null;
  /** Displayable text of the comment immediately before the anchor move. */
  precedingCommentText: string;
  /** Displayable text of the comment immediately after the anchor move (post-anchor comment, stripped). */
  followingCommentText: string;
  /** Full SAN sequence from the start of the variation to this move (for the move-list expansion). */
  movePath: string;   // e.g. "1 e4 e5 2 Nf3 Nc6 3 Bb5"
};

/** Walk pgnModel and collect all ResolvedAnchor entries, in PGN order. */
export const resolveAnchors = (pgnModel: PgnModel): ResolvedAnchor[]
```

`resolveAnchors` is a pure-logic function (no React, no I/O) that traverses
the variation tree, computing FEN at each move and checking each comment for
`[%anchor ...]` annotations.  FEN computation reuses the same `Chess` instance
walk already done for `resolveMovePositionById`.

### 5.2 `AnchorList` sub-component

Used inside both dialogs.  Pure React component; no context reads.

```ts
// components/AnchorList.tsx

type AnchorListProps = {
  anchors: ResolvedAnchor[];
  query: string;              // search filter string
  selectedId?: string;        // highlighted row (for picker)
  onSelect: (anchor: ResolvedAnchor) => void;
  t: (key: string, fallback?: string) => string;
};
```

Each row:
```
┌────────────────────────────────────────────────────────────────┐
│ ⚓ [intro]  The critical junction                  ♔ [board]  │
│                                                                │
│   "...White's plan becomes clear after 13.Rd1."               │
│   "The rook centralises and..."                               │
│                                               [⋯ show moves]  │
│   (expanded) 1 e4 e5 2 Nf3 Nc6 3 Bb5 … 13 Rd1               │
└────────────────────────────────────────────────────────────────┘
```

- `⚓ [intro]` — anchor icon + ID badge
- `The critical junction` — text label (bold)
- `♔ [board]` — board icon; `onMouseEnter` calls `showPreview(anchor.fen, anchor.lastMove, rect)` via `useHoverPreview()` context; `onMouseLeave` calls `hidePreview()`
- The two muted comment lines — `precedingCommentText` + `followingCommentText` (each truncated to ~80 chars with ellipsis if longer; empty lines hidden)
- `[⋯ show moves]` — toggle button; expands to show `anchor.movePath` inline
- Clicking anywhere on the row (except the board icon) → `onSelect(anchor)`

Rows are filtered by `query` (substring match on `text` + `id` + `movePath`,
case-insensitive).

---

## Phase 6 — Rendering in the editor

### 6.1 Anchor definition badge on moves

In text and tree modes, any move whose following comment contains
`[%anchor ...]` annotations displays a small **`⚓`** badge to the right of the
move token (same pattern as `?` for Q/A).

```
12…Nd5  ⚓   13 Rd1
```

- Clicking the `⚓` badge opens `AnchorDefDialog` in **edit mode** (pre-filled
  with the existing anchor; shows a "Delete" button).
- Badge count: if multiple anchors are on the same move, the badge shows `⚓2`.

Implementation: emit an additional `InlineToken` with
`tokenType: "anchor_indicator"` after the move token in `text_mode.ts` /
`tree_mode.ts`, analogous to how the `?` badge is emitted for Q/A.

### 6.2 `components/AnchorChip.tsx`

Inline chip rendered for each `[%anchorref ...]` in a comment.

```ts
type AnchorChipProps = {
  refAnnotation: AnchorRefAnnotation;
  resolved: ResolvedAnchor | null;   // null = broken reference
  onEdit: (index: number) => void;   // opens picker in edit mode
  onDelete: (index: number) => void;
  t: (key: string, fallback?: string) => string;
};
```

Appearance:
- Resolved: `⚓ {text}` in a small chip (accent colour)
- Broken: `⚓ ?{id}` in a warning chip (muted grey with strikethrough icon)

Hover behaviour (resolved chips only):
- `onMouseEnter`: call `showPreview(resolved.fen, resolved.lastMove, rect)` via
  `useHoverPreview()` to show the mini-board; also show a tooltip text overlay
  with the anchor `text`.
- `onMouseLeave`: call `hidePreview()`.

The `HoverPositionPopup` (from the hover-position-preview plan) is reused
without modification; the popup renders the FEN passed via `showPreview`.

For the text label tooltip (anchor text on hover), reuse the `title` attribute
or a lightweight CSS tooltip — no extra portal needed.

A small ✕ button on the chip calls `onDelete`.  A pencil icon calls `onEdit`.

### 6.3 Wiring chips into `PgnTextEditor`

In the comment-rendering section:

```tsx
{token.kind === "comment" && token.anchorRefAnnotations.length > 0 && (
  token.anchorRefAnnotations.map((ref, i) => (
    <AnchorChip
      key={ref.id + i}
      refAnnotation={ref}
      resolved={resolvedAnchorsMap.get(ref.id) ?? null}
      onEdit={(idx) => handleEditAnchorRef(token.commentId, idx, token.rawText)}
      onDelete={(idx) => handleDeleteAnchorRef(token.commentId, idx, token.rawText)}
      t={t}
    />
  ))
)}
```

`resolvedAnchorsMap` is `useMemo`-cached: `new Map(resolveAnchors(pgnModel).map(a => [a.id, a]))`.
Rebuilt only when `pgnModel` reference changes.

---

## Phase 7 — Command entry points in `PgnTextEditor`

| Trigger | Action |
|---|---|
| Right-click move token → "Add anchor here…" | `handleOpenAnchorDefDialog(moveId)` |
| Right-click move/comment token → "Insert anchor reference…" | `handleOpenAnchorRefDialog(commentId, rawText)` |
| Click `⚓` badge | open `AnchorDefDialog` in edit mode |
| Click ✕ on chip | `handleDeleteAnchorRef(...)` |
| Click ✏ on chip | `handleEditAnchorRef(...)` → opens picker in edit mode |

Keyboard shortcuts: none in this phase; can be added later.

---

## Phase 8 — i18n keys

```
editor.addAnchor                "Add anchor here…"
editor.insertAnchorRef          "Insert anchor reference…"
editor.anchorId                 "ID"
editor.anchorText               "Text"
editor.anchorIdConflict         "This ID is already used"
editor.placeAnchor              "Place anchor"
editor.editAnchor               "Edit anchor"
editor.deleteAnchor             "Delete anchor"
editor.existingAnchors          "Existing anchors in this game"
editor.anchorNotFound           "Anchor not found"
editor.anchorShowMoves          "Show moves"
editor.anchorHideMoves          "Hide moves"
anchorPicker.title              "Insert anchor reference"
anchorPicker.search             "Search by label or ID…"
anchorPicker.noAnchors          "No anchors defined in this game"
anchorPicker.noResults          "No anchors match your search"
```

---

## Phase 9 — Tests

| File | Coverage |
|---|---|
| `test/resources_viewer/anchor_parser.test.ts` | parse / format / strip / replace / append for both `%anchor` and `%anchorref`; duplicate IDs; missing fields; round-trips |
| `test/editor/resolveAnchors.test.ts` | single anchor in mainline; anchor in variation; no anchors; duplicate IDs (first wins); preceding/following comment extraction; movePath generation |
| `test/editor/useAnchorDefDialog.test.ts` | open dialog; suggested ID; conflict detection; confirm appends to raw text |
| `test/editor/useAnchorRefDialog.test.ts` | insert ref; edit ref; delete ref; mutations on rawText |

No UI-level tests in this phase (component test infrastructure not yet in place).

---

## Dependency on other plans

| Plan | Dependency |
|---|---|
| `hover_position_preview_a3b2c1d0` | `HoverPreviewContext`, `MiniBoard`, `HoverPositionPopup`, `replayPvToPosition` — must be implemented first (or in parallel) for position preview in the anchor list and chip hover to work. The anchor plan can ship without position previews if the hover plan is not yet merged; the board icon and chip hover simply omit the mini-board in that case. |

---

## Out of scope (deferred)

- Cross-game anchor references (link to an anchor in a different game/resource)
- Anchor navigation (jump to anchor move when clicking a chip) — deferred until
  session navigation API is settled
- Anchor list as a side panel / table of contents view
- Colour-coded anchors (assigning a colour tag to distinguish e.g. "critical"
  from "interesting")
- Export: anchors survive PGN round-trip as `{ [%anchor ...] }` comment commands

---

## File checklist

- [ ] `frontend/src/resources_viewer/anchor_parser.ts` — new
- [ ] `frontend/src/editor/resolveAnchors.ts` — new
- [ ] `frontend/src/editor/plan/types.ts` — add `anchorAnnotations`, `anchorRefAnnotations` to `CommentToken`
- [ ] `frontend/src/editor/plan/text_mode.ts` — populate anchor data; emit `anchor_indicator` token
- [ ] `frontend/src/editor/plan/plain_mode.ts` — populate anchor data (no badge)
- [ ] `frontend/src/editor/useAnchorDefDialog.ts` — new
- [ ] `frontend/src/editor/useAnchorRefDialog.ts` — new
- [ ] `frontend/src/components/AnchorList.tsx` — new
- [ ] `frontend/src/components/AnchorDefDialog.tsx` — new
- [ ] `frontend/src/components/AnchorPickerDialog.tsx` — new
- [ ] `frontend/src/components/AnchorChip.tsx` — new
- [ ] `frontend/src/components/PgnTextEditor.tsx` — wire dialogs, badges, chips, resolvedAnchorsMap
- [ ] `frontend/test/resources_viewer/anchor_parser.test.ts` — new
- [ ] `frontend/test/editor/resolveAnchors.test.ts` — new
- [ ] `frontend/test/editor/useAnchorDefDialog.test.ts` — new
- [ ] `frontend/test/editor/useAnchorRefDialog.test.ts` — new
