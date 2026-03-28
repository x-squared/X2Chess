# Board Shapes — Plan

**ID:** board_shapes_3f4a5b6c
**Status:** Implemented (2026-03-28).

---

## Goal

Allow the user to annotate the board with **square highlights** and **directional
arrows** using mouse gestures, and persist them in PGN comment annotations.
Highlights and arrows are also read from PGN and displayed when navigating to
any annotated ply.

---

## Interaction model

All gestures use the **right mouse button**.  Left-click move entry is
unaffected.

| Gesture | Effect |
|---------|--------|
| Right-click a plain square | Apply **primary** preset highlight |
| Shift + right-click a plain square | Apply **secondary** preset highlight |
| Right-click + drag, release on different square | Draw **primary** preset arrow |
| Shift + right-click + drag, release on different square | Draw **secondary** preset arrow |
| Right-click an already-highlighted square | **Remove** the highlight |
| Right-click an existing arrow origin | **Remove** the arrow |
| Right-click the board background (no shape) | Clear all shapes on the current ply |

Drag is distinguished from click by a minimum pixel threshold (~4 px) so that a
right-click on a square is never accidentally converted to a zero-length arrow.

### Two presets, not four

There are exactly **two** user-configured color presets — **primary** and
**secondary** — rather than an ad-hoc four-color picker.  The user configures
which named PGN colors (red, yellow, green, blue) map to each preset in
Settings.  Default mapping: primary = **green**, secondary = **red**.

This maps cleanly to the standard `[%csl]`/`[%cal]` PGN format and to common
chess GUI conventions (right-click = green, Shift + right-click = red in
Lichess).

---

## Visual rendering

### Overlay colour

Highlights use a **semi-transparent** overlay so the underlying light/dark
square colour remains visible.  The overlay adds a hue without obscuring the
square.  Suggested alpha: 0.5–0.65.

### Two style modes (configurable in Settings)

| Mode | Description |
|------|-------------|
| **Fill** (default) | Semi-transparent filled rectangle covering the square |
| **Frame** | A coloured border/outline inside the square, no fill |

Both modes are implemented in CSS.  Chessground renders highlighted squares as
`<square class="…">` elements; a CSS class on the board container switches the
mode globally:

```css
/* Fill mode (default) */
.board.shapes-fill cg-board square.user-shape-green  { background: rgba(103,200,103,0.55); }
.board.shapes-fill cg-board square.user-shape-red    { background: rgba(220, 80, 80,0.55); }
.board.shapes-fill cg-board square.user-shape-yellow { background: rgba(230,205, 60,0.55); }
.board.shapes-fill cg-board square.user-shape-blue   { background: rgba( 70,140,220,0.55); }

/* Frame mode */
.board.shapes-frame cg-board square.user-shape-green  { outline: 3px solid rgba(103,200,103,0.85); outline-offset: -3px; }
.board.shapes-frame cg-board square.user-shape-red    { outline: 3px solid rgba(220, 80, 80,0.85); outline-offset: -3px; }
/* … etc */
```

The class `shapes-fill` / `shapes-frame` is set on the `.board` div.

> **Note on Chessground auto-shapes vs. custom CSS:**
> Chessground's built-in `setAutoShapes` renders squares via `<piece class="…">`
> elements — not easily styled per-color with CSS.  Square highlights should
> instead be driven by explicit `<square class="user-shape-*">` DOM manipulation
> (or a thin SVG overlay).  Arrows are rendered by Chessground's built-in SVG
> layer and are styled acceptably without custom CSS.  See _Rendering strategy_
> below.

---

## Rendering strategy

Chessground exposes two shape APIs:

| API | Used for | Notes |
|-----|----------|-------|
| `api.setAutoShapes(shapes)` | **Arrows** | Chessground renders arrows as SVG. Color is mapped from brush name to a CSS `--cg-…` variable. Works well. |
| DOM class injection on `<square>` | **Square highlights** | Chessground renders each square as a `<square key="e4">` element.  We add/remove `user-shape-green` etc. directly on these elements after `api.set()`. |

The DOM injection for squares is a lightweight imperative step — iterate the
`BoardShape[]` with `kind === "highlight"`, find `cg-board square[data-key="e4"]`
(Chessground uses `cgKey` attribute on generated squares), and toggle the class.
A `MutationObserver` is _not_ needed because we control when Chessground
re-renders (after every `api.set()` call).

### Arrow brush colours

Chessground's brush system uses CSS variables.  Override in `board/styles.css`:

```css
.board { --cg-brush-green: rgba(103,200,103,0.85); }
.board { --cg-brush-red:   rgba(220, 80, 80,0.85); }
.board { --cg-brush-yellow:rgba(230,205, 60,0.85); }
.board { --cg-brush-blue:  rgba( 70,140,220,0.85); }
```

---

## Chessground `drawable` integration

Chessground ships a built-in `drawable` subsystem that supports the right-click
gesture model described above.  Enable it at init:

```typescript
drawable: {
  enabled: true,           // allow user to draw
  visible: true,
  defaultSnapToValidMoves: false,
  eraseOnClick: true,      // right-click existing shape = remove
  onChange: (shapes) => handleDrawableChange(shapes),
}
```

Chessground calls `onChange` with the full current `DrawShape[]` after every
gesture.  Each `DrawShape` has `{ orig, dest?, brush }`.

**Gap**: Chessground's built-in drawable does not distinguish Shift + right-click
from plain right-click with a different brush.  We need to intercept the
`mousedown` event to capture the modifier key and pass it to Chessground's
`drawable.brushes` config before the gesture completes, or we handle the gesture
entirely ourselves.

**Recommended approach**: handle the right-click gestures ourselves (a thin
event layer on the `.board` element) rather than depending on Chessground's
`drawable`.  This gives full control over the two-preset model and avoids
Chessground's internal `DrawShape` type leaking into our model.  The event layer:

1. Listens to `contextmenu` (prevent default), `mousedown` (button 2),
   `mousemove`, `mouseup` on the board element.
2. On `mousedown` (right button): record `startSquare`, `isShift`, start drag
   tracking.
3. On `mouseup`: if drag distance < 4 px → toggle highlight on `startSquare`;
   otherwise → add/remove arrow from `startSquare` to `endSquare`.
4. Emits a `BoardShape[]` diff that ChessBoard applies to its local shape state.

This layer lives in `board/drawable_gestures.ts` (pure-logic; takes DOM element
and returns a disposable subscription).

---

## PGN encoding

Standard `[%csl]`/`[%cal]` extensions — compatible with Lichess, ChessBase,
SCID, Arena.

```
{ [%csl Rg1,Ge4] [%cal Ge2e4,Rd1h5] }
```

Color prefix: `R` = red, `Y` = yellow, `G` = green, `B` = blue.

The user's two presets map to two of these four PGN colors.  Default:
primary → `G`, secondary → `R`.

---

## Data model  (`board/board_shapes.ts`)

Pure-logic, no React/DOM.

```typescript
export type ShapeColor = "green" | "red" | "yellow" | "blue";

export type BoardKey = `${BoardFile}${BoardRank}`;  // "a1"–"h8"
export type BoardFile = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type BoardRank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

export const isBoardKey = (v: string): v is BoardKey => /^[a-h][1-8]$/.test(v);

export type SquareHighlight = {
  kind: "highlight";
  square: BoardKey;
  color: ShapeColor;
};

export type BoardArrow = {
  kind: "arrow";
  from: BoardKey;
  to: BoardKey;
  color: ShapeColor;
};

export type BoardShape = SquareHighlight | BoardArrow;

/** User-configurable preset mapping. */
export type ShapePresets = {
  primary: ShapeColor;    // default "green"
  secondary: ShapeColor;  // default "red"
};
```

`BoardKey`, `BoardFile`, `BoardRank`, `isBoardKey` replace the locally-declared
copies in `ChessBoard.tsx` and `board/runtime.ts`.

---

## Parsing  (`board/shape_parser.ts`)

```typescript
/** Parse [%csl …] and [%cal …] blocks from a PGN comment string. */
export const parseShapes = (comment: string): BoardShape[] => { … }
```

Silently drops malformed tokens; returns `[]` for empty/missing annotations.

---

## Serialization  (`board/shape_serializer.ts`)

```typescript
/** Render BoardShape[] as "[%csl …] [%cal …]" annotation string (empty string if no shapes). */
export const serializeShapes = (shapes: BoardShape[]): string => { … }
```

Output is deterministic (sorted) so PGN diffs are stable.

---

## Gesture handler  (`board/drawable_gestures.ts`)

```typescript
type DrawableGestureOptions = {
  boardEl: HTMLElement;
  presets: ShapePresets;
  /** Called whenever the user gesture completes with the new full shape list. */
  onChange: (shapes: BoardShape[]) => void;
};

/** Attach right-click gesture listeners; returns a dispose function. */
export const attachDrawableGestures = (
  opts: DrawableGestureOptions,
  currentShapes: () => BoardShape[],
): (() => void) => { … }
```

Logic:
- Prevents `contextmenu` default to suppress the browser menu.
- Tracks `mousedown` (button 2) / `mousemove` / `mouseup`.
- Identifies the square under the cursor by reading the Chessground `<square>`
  element's attribute (or computing from board bounding rect + orientation).
- On click (no drag): toggle highlight — add if absent, remove if present.
- On drag: add arrow if the origin/destination pair is new, remove if it
  already exists (same from/to/color).
- Returns updated `BoardShape[]` via `onChange`.

---

## Settings  (`runtime/shape_prefs.ts`)

```typescript
export type SquareStyleMode = "fill" | "frame";

export type ShapePrefs = {
  primaryColor: ShapeColor;    // default "green"
  secondaryColor: ShapeColor;  // default "red"
  squareStyle: SquareStyleMode; // default "fill"
};
```

Persisted via the existing bootstrap prefs mechanism (`runtime/bootstrap_prefs.ts`).

---

## State integration

### Selector

```typescript
/** BoardShape[] for the current ply, parsed from PGN comment. */
export const selectAnnotationShapes = (state: AppStoreState): BoardShape[] => { … }
```

Derived — no new reducer fields.

### Ephemeral overlay

`AppShell` holds local `useState<BoardShape[]>([])` for ephemeral shapes
(training hints, engine arrows).  These are **not** persisted to PGN.

---

## `ChessBoard` prop change

```typescript
type ChessBoardProps = {
  onMovePlayed?: (from: string, to: string) => void;
  /** Ephemeral shapes (training hints, engine arrows). Merged with annotation shapes. */
  overlayShapes?: BoardShape[];
  /** Called when the user draws/erases shapes via right-click gestures. */
  onShapesChanged?: (shapes: BoardShape[]) => void;
  presets?: ShapePresets;
  squareStyle?: SquareStyleMode;
};
```

`hintMove` is removed.  Callers in `AppShell` that previously set `hintMove`
switch to `overlayShapes`.

### Internal render logic

```typescript
// Merge annotation (from PGN) + overlay (ephemeral) + user-drawn (local state)
const allShapes = [...annotationShapes, ...overlayShapes, ...drawnShapes];

// Arrows → Chessground setAutoShapes
api.setAutoShapes(allShapes.filter(isArrow).map(toAutoShape));

// Highlights → CSS class injection on <square> elements
applySquareHighlightClasses(boardElRef.current, allShapes.filter(isHighlight));
```

`applySquareHighlightClasses` iterates current `<square>` children of `cg-board`,
removes all `user-shape-*` classes, then re-adds based on `allShapes`.

---

## Implementation phases

### Phase 1 — Types + pure-logic

| File | Action |
|------|--------|
| `board/board_shapes.ts` | New — `ShapeColor`, `BoardKey`, `BoardShape`, `ShapePresets`, `isBoardKey` |
| `board/shape_parser.ts` | New — `parseShapes(comment)` |
| `board/shape_serializer.ts` | New — `serializeShapes(shapes)` |
| `board/drawable_gestures.ts` | New — right-click gesture handler |
| `board/index.ts` | Re-export new public surface |
| `board/runtime.ts` | Import `BoardKey` from `board_shapes` |
| `frontend/test/board/shape_parser.test.ts` | New — parse/serialize round-trip tests |
| `frontend/test/board/drawable_gestures.test.ts` | New — click vs drag logic tests |

### Phase 2 — Settings + state

| File | Action |
|------|--------|
| `runtime/shape_prefs.ts` | New — `ShapePrefs`, load/save |
| `state/selectors.ts` | Add `selectAnnotationShapes` |

### Phase 3 — ChessBoard wiring

| File | Action |
|------|--------|
| `components/ChessBoard.tsx` | Replace `hintMove`; attach gesture handler; render arrows + highlights |
| `board/styles.css` | Add `.user-shape-*` CSS rules for fill and frame modes |
| `components/AppShell.tsx` | Migrate `hintMove` → `overlayShapes`; wire `onShapesChanged` → serialize → PGN write |

### Phase 4 — Settings UI *(deferred)*

Add primary/secondary color pickers and fill/frame toggle to the Settings panel.

---

## Open questions

1. **Square detection in gesture handler** — Chessground marks each square DOM
   element with an attribute (`data-key` or similar); confirm exact attribute
   name from Chessground source before implementing.
2. **Ply-0 shapes** — game preamble comment can carry `[%csl]`/`[%cal]`;
   decide whether the initial position shows those shapes.
3. **boardPreview mode** — when `boardPreview` overrides the position (variation
   hover), should annotation shapes be suppressed?  Likely yes.
4. **MiniBoard** — hover-preview boards do not need interactive drawing but
   could display annotation shapes; defer to a follow-up.
5. **Arrow self-loop** — if the user right-click-drags less than 4 px but lands
   on the same square, treat as a highlight, not a zero-length arrow.
