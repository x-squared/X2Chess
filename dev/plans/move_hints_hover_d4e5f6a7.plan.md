# Move Hints on Hover — Plan

**ID:** move_hints_hover_d4e5f6a7
**Status:** Implemented (2026-03-28).

---

## Goal

When the user hovers over any piece on the board, every square that piece
can legally move to is marked with a small dot in its centre.  By default
the dots are neutral (grey/blue, matching the existing `.move-dest` style).

**Engine integration hook (future):** when engine analysis is available, each
destination square's dot is coloured to reflect the engine's evaluation of
that move — best move in green, reasonable in yellow, poor in red — without
requiring any architectural change.

---

## Behaviour

- Hover a piece → dots appear on all its legal destinations.
- Move the mouse off the piece (without clicking) → dots disappear.
- Hover a square with no piece → no effect.
- Works in **both** interactive mode (move entry enabled) and **view-only**
  mode (game review, study).
- When a piece is **selected** (clicked, `.selected` class present on its
  square), the hover dots are suppressed — Chessground's own `.move-dest`
  dots already handle that state.
- Feature can be disabled globally via a `showMoveHints` setting (default:
  on).

---

## Visual design

### Neutral dot

The dot for a destination square matches the existing `.move-dest` radial
gradient, so the hover preview is visually consistent with what the user sees
after clicking a piece:

```css
/* empty-square destination */
.board cg-board square.move-hint {
  background: radial-gradient(rgba(52, 70, 163, 0.40) 24%, rgba(0,0,0,0) 26%);
}

/* destination that contains a capturable piece — ring instead of dot */
.board cg-board square.move-hint-capture {
  background: radial-gradient(
    transparent 0%,
    transparent 74%,
    rgba(52, 70, 163, 0.40) 76%,
    rgba(52, 70, 163, 0.40) 100%
  );
}
```

### Engine-coloured dots

When the engine has evaluated the position, each destination square receives a
colour-coded class instead of the neutral `move-hint`.  The same CSS variable
approach as `board/styles.css`:

```css
.board cg-board square.move-hint-green  { background: radial-gradient(rgba(80,180, 80,0.65) 24%, rgba(0,0,0,0) 26%); }
.board cg-board square.move-hint-yellow { background: radial-gradient(rgba(210,185, 30,0.65) 24%, rgba(0,0,0,0) 26%); }
.board cg-board square.move-hint-red    { background: radial-gradient(rgba(210, 60, 60,0.65) 24%, rgba(0,0,0,0) 26%); }
.board cg-board square.move-hint-blue   { background: radial-gradient(rgba( 60,130,210,0.65) 24%, rgba(0,0,0,0) 26%); }

/* capture-ring variants */
.board cg-board square.move-hint-green.move-hint-capture  { background: radial-gradient(…); }
/* … same pattern for yellow/red/blue */
```

The engine-coloured classes are applied in the same DOM injection step as the
neutral class — no separate rendering path.

---

## Architecture

### Pure-logic module  (`board/move_hints.ts`)

No React, no DOM.

```typescript
import type { Chess } from "chess.js";
import type { BoardKey, ShapeColor } from "./board_shapes";

/**
 * A single hover-hint destination.
 * `color` is undefined until an engine populates it.
 * `isCapture` drives the ring vs dot visual variant.
 */
export type MoveHint = {
  square: BoardKey;
  isCapture: boolean;
  color?: ShapeColor;
};

/**
 * Compute the legal destinations for the piece on `square` in `game`.
 * Returns [] if the square is empty or has no legal moves.
 */
export const computeMoveHints = (
  game: Chess,
  square: BoardKey,
): MoveHint[] => { … }
```

Implementation: filter `game.moves({ verbose: true })` for moves whose `from`
matches `square`; map each to `{ square: move.to, isCapture: !!move.captured }`.

### Hover listener  (`board/hover_listener.ts`)

Pure-logic; receives a DOM element and callbacks, returns a dispose function.

```typescript
type HoverListenerOptions = {
  boardEl: HTMLElement;
  /** Called when the mouse enters a square that has a piece. */
  onPieceEnter: (square: BoardKey) => void;
  /** Called when the mouse leaves a piece square (or enters an empty square). */
  onPieceLeave: () => void;
};

export const attachHoverListener = (opts: HoverListenerOptions): (() => void) => { … }
```

Implementation:
- Listens to `mouseover` on the board element (event delegation — one listener).
- Walks up from `event.target` to find the nearest `<square>` element;
  reads its `cgKey` attribute to get the `BoardKey`.
- Detects whether the square contains a piece by checking for a `<piece>`
  child element (Chessground's DOM structure).
- Debounces at 0 ms (a `requestAnimationFrame` flush) to avoid flicker when
  the cursor moves between the `<piece>` and its parent `<square>`.
- `mouseleave` on `cg-board` fires `onPieceLeave`.

### CSS class injection  (`board/hint_renderer.ts`)

```typescript
/**
 * Apply / remove move-hint CSS classes on Chessground square elements.
 * `hints` is the current set of destination squares (empty to clear all).
 * `selectedSquare` — pass the currently-selected square (if any) to suppress
 * hints when a piece is already selected.
 */
export const applyMoveHintClasses = (
  boardEl: HTMLElement,
  hints: MoveHint[],
  selectedSquare: BoardKey | null,
): void => { … }
```

- Clears all `move-hint*` classes from every `<square>` child of `cg-board`.
- If `selectedSquare` is non-null (piece is selected), returns without adding
  any classes.
- For each `MoveHint`, finds `cg-board square[cgKey="<square>"]` and adds:
  - `move-hint-<color>` when `hint.color` is set, `move-hint` otherwise.
  - `move-hint-capture` when `hint.isCapture` is true (in addition to the
    color/neutral class).

### `ChessBoard` integration

Three additions to `ChessBoard.tsx`:

**1. New prop interface:**

```typescript
type ChessBoardProps = {
  onMovePlayed?: (from: string, to: string) => void;
  overlayShapes?: BoardShape[];           // from board_shapes plan
  onShapesChanged?: (shapes: BoardShape[]) => void;
  presets?: ShapePresets;
  squareStyle?: SquareStyleMode;
  /** Engine hint colors keyed by destination square. Populated when engine analysis is available. */
  moveHintColors?: Map<BoardKey, ShapeColor>;
  /** Set false to disable hover move hints entirely. Default: true. */
  showMoveHints?: boolean;
};
```

**2. Hover state (local):**

```typescript
const [hoveredSquare, setHoveredSquare] = useState<BoardKey | null>(null);
```

**3. Two new `useEffect` hooks:**

```typescript
// ── Attach/detach hover listener ──────────────────────────────────────
useEffect((): (() => void) => {
  if (!showMoveHints || !boardElRef.current) return (): void => undefined;
  return attachHoverListener({
    boardEl: boardElRef.current,
    onPieceEnter: setHoveredSquare,
    onPieceLeave: () => setHoveredSquare(null),
  });
}, [showMoveHints]);

// ── Apply move-hint classes when hovered square or engine colors change ──
useEffect((): void => {
  if (!boardElRef.current) return;
  const game: Chess = buildGameAtPly(currentPly, moves);
  const hints: MoveHint[] = hoveredSquare
    ? computeMoveHints(game, hoveredSquare).map((h) => ({
        ...h,
        color: moveHintColors?.get(h.square),
      }))
    : [];
  const selectedSquare = getSelectedSquare(boardElRef.current); // reads cgKey from .selected element
  applyMoveHintClasses(boardElRef.current, hints, selectedSquare);
}, [hoveredSquare, moveHintColors, currentPly, moves]);
```

`getSelectedSquare` is a one-liner helper: find `cg-board square.selected`, read
its `cgKey`.

---

## Engine integration hook (future)

When engine analysis arrives, `AppShell` (or a dedicated engine hook) builds a
`Map<BoardKey, ShapeColor>` for the current position and passes it as
`moveHintColors` to `ChessBoard`:

```typescript
// Example (future AppShell):
const moveHintColors = useMemo((): Map<BoardKey, ShapeColor> => {
  if (!engineLines) return new Map();
  return buildHintColors(engineLines, currentPosition);
}, [engineLines, currentPosition]);

<ChessBoard moveHintColors={moveHintColors} … />
```

`buildHintColors` lives in the engine integration module, not in this plan.
The board itself is entirely passive — it just renders whatever colors it
receives.  No change to `ChessBoard` is needed when the engine is added.

---

## Interaction with board_shapes plan

`ChessBoard` already runs `applySquareHighlightClasses` (from board_shapes)
and `applyMoveHintClasses` (this plan) on the same square elements.  They
use distinct CSS class prefixes (`user-shape-*` vs `move-hint*`) and can
coexist without conflict.  The render order is:

1. `api.set()` — Chessground re-renders pieces and built-in squares.
2. `applySquareHighlightClasses` — annotation/overlay shape highlights.
3. `applyMoveHintClasses` — hover destination dots.

Both are called from their own `useEffect` hooks with their own dependency
arrays, so they do not interfere.

---

## Implementation phases

### Phase 1 — Pure-logic modules

| File | Action |
|------|--------|
| `board/move_hints.ts` | New — `MoveHint`, `computeMoveHints` |
| `board/hover_listener.ts` | New — `attachHoverListener` |
| `board/hint_renderer.ts` | New — `applyMoveHintClasses` |
| `board/index.ts` | Re-export new public surface |
| `frontend/test/board/move_hints.test.ts` | Unit tests — sample positions, edge cases (king in check, pinned piece, castling) |

### Phase 2 — ChessBoard wiring

| File | Action |
|------|--------|
| `components/ChessBoard.tsx` | Add `hoveredSquare` state; attach hover listener; run hint renderer effect; add `moveHintColors`/`showMoveHints` props |
| `board/styles.css` | Add `.move-hint`, `.move-hint-capture`, `.move-hint-{green,yellow,red,blue}` rules |

### Phase 3 — Settings *(deferred)*

Add `showMoveHints` toggle to Settings panel.

---

## Open questions

1. **Chessground square attribute name** — confirm whether destination squares
   use `cgKey`, `data-key`, or another attribute.  Also confirm how
   `getSelectedSquare` should read the selected square (`.selected` class vs
   an API call).  Check before Phase 1.
2. **`boardPreview` mode** — when `boardPreview` is active (variation hover),
   the `currentPly`/`moves` state does not reflect the displayed position.
   `computeMoveHints` should receive the preview `fen` instead.  Handle in
   Phase 2 when wiring ChessBoard.
3. **Hover during drag** — when the user is mid-drag (left-click, moving a
   piece), suppress hover hints on other pieces.  Detect via a `dragging`
   ref set in the Chessground `movable.events.after` callback.
4. **Performance** — `buildGameAtPly` replays the full move list on every
   hover event.  Cache the current `Chess` instance in a ref (already done
   implicitly in ChessBoard's position effect) and pass it to
   `computeMoveHints` rather than rebuilding.
