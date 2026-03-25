# Hover Position Preview

**Status:** Draft — ready for implementation.

## Objective

When a user hovers over a half-move token (SAN span), display a small floating
mini-board popup showing the position after that move. The feature applies to
all move-rendering surfaces: PGN text/tree/plain editor modes and the engine
analysis panel PV lines. The popup is ephemeral UI state — no reducer action
required for show/hide. A persistent user preference (`positionPreviewOnHover`)
gates the feature.

---

## Files to Create

| Path | Purpose |
|---|---|
| `frontend/src/components/HoverPreviewContext.tsx` | React context + provider for ephemeral popup state |
| `frontend/src/components/MiniBoard.tsx` | View-only Chessground mini board component |
| `frontend/src/components/HoverPositionPopup.tsx` | Portal-mounted floating popup wrapping `MiniBoard` |

---

## Files to Modify

| Path | Change summary |
|---|---|
| `frontend/src/board/move_position.ts` | Add `replayPvToPosition` pure-logic helper |
| `frontend/src/state/actions.ts` | Add `set_position_preview_on_hover` action variant |
| `frontend/src/state/app_reducer.ts` | Add `positionPreviewOnHover` field + reducer case |
| `frontend/src/state/selectors.ts` | Add `selectPositionPreviewOnHover` selector |
| `frontend/src/state/ServiceContext.tsx` | Add `setPositionPreviewOnHover` service callback |
| `frontend/src/hooks/createAppServices.ts` | Wire `setPositionPreviewOnHover` dispatch |
| `frontend/src/components/PgnTextEditor.tsx` | Wire hover on `MoveSpan`; call `showPreview` |
| `frontend/src/components/AnalysisPanel.tsx` | Refactor PV span rendering; add hover props |
| `frontend/src/components/AppShell.tsx` | Mount provider + popup; wire analysis panel hover |
| `frontend/src/components/MenuPanel.tsx` | Add position-preview toggle |
| `frontend/src/styles.css` | Add `.hover-position-popup` CSS rules |
| `frontend/data/i18n/*.json` | Add `controls.positionPreviewOnHover` key |

---

## Key Type Definitions

```typescript
// HoverPreviewContext.tsx

export type HoverPreviewState = {
  fen: string;
  lastMove: [string, string] | null;
  x: number;
  y: number;
} | null;

export type HoverPreviewContextValue = {
  previewState: HoverPreviewState;
  showPreview: (
    fen: string,
    lastMove: [string, string] | null,
    anchorRect: DOMRect,
  ) => void;
  hidePreview: () => void;
};
```

```typescript
// board/move_position.ts — new export

export type PvPositionResult = {
  fen: string;
  lastMove: [string, string] | null;
};

export const replayPvToPosition = (
  startFen: string,
  pvSans: string[],
  upToIndex: number,
): PvPositionResult => { ... };
```

```typescript
// actions.ts — new union member

| { type: "set_position_preview_on_hover"; enabled: boolean }
```

---

## Implementation Phases

### Phase 1 — Pure-logic utility: `replayPvToPosition`

**File:** `frontend/src/board/move_position.ts`

Add a new exported function after the existing exports. No React or DOM imports
(pure-logic module constraint).

**Contract:**
- Accept `startFen: string`, `pvSans: string[]`, `upToIndex: number`.
- `upToIndex` is the inclusive 0-based index into `pvSans` (hover over the first
  PV move → pass `0`).
- Load a fresh `Chess` instance via `new Chess(startFen)`.
- Replay moves from index `0` to `upToIndex` using `applySanWithFallback`
  (already in this file) to handle annotation stripping and normalization.
- Capture `moved.from` and `moved.to` from the last applied move.
- Return `{ fen: game.fen(), lastMove: [from, to] | null }`.
- If `startFen` is malformed, catch the error and return
  `{ fen: startFen, lastMove: null }`.
- If an intermediate SAN fails, stop and return the position reached so far
  (partial replay is acceptable for hover display — no throw).

**Why here:** `Chess` is already imported; `applySanWithFallback` handles
tolerant SAN parsing. No duplication needed.

---

### Phase 2 — React context + popup components

#### 2a. `HoverPreviewContext.tsx`

Export `HoverPreviewContext`, `HoverPreviewProvider`, and `useHoverPreview`.

The provider owns `useState<HoverPreviewState>(null)`.

**`showPreview(fen, lastMove, anchorRect)` positioning:**
- Popup size: 200 × 200 px (matches `MiniBoard` default).
- Default: below-right of anchor — `x = anchorRect.left`, `y = anchorRect.bottom + 8`.
- Flip above if `y + 208 > window.innerHeight`: `y = anchorRect.top - 208`.
- Clamp left if `x + 208 > window.innerWidth`: `x = window.innerWidth - 212`.

**`hidePreview()`** calls `setState(null)`.

No dependency on `useAppContext` or the reducer — hover state is volatile UI
feedback with no persistence requirement.

#### 2b. `MiniBoard.tsx`

```typescript
type MiniBoardProps = {
  fen: string;
  lastMove: [string, string] | null;
  size?: number; // default 200
};
```

Pattern mirrors `ChessBoard.tsx` exactly:
- `useRef<HTMLDivElement>` for the mount element.
- `useRef<ChessgroundApi | null>` for the Chessground instance.
- Init effect (empty deps): `Chessground(el, { viewOnly: true, coordinates: false, highlight: { lastMove: true }, animation: { enabled: false } })`.
- Sync effect keyed on `[fen, lastMove]`: calls `cgRef.current?.set(...)` with
  the updated position config. Validate `lastMove` squares via the same
  `isBoardKey` guard pattern used in `ChessBoard.tsx`.
- Cleanup: `api.destroy()` on unmount.
- Returns `<div ref={boardElRef} style={{ width: size, height: size }} className="mini-board" />`.
- No `useAppContext` — all data via props. Strictly view-only.

#### 2c. `HoverPositionPopup.tsx`

- Consumes `useHoverPreview()`.
- When `previewState` is null → returns `null`.
- When non-null → renders via `ReactDOM.createPortal(...)` to `document.body`.
- Portal content: `<div className="hover-position-popup" style={{ position: "fixed", left: previewState.x, top: previewState.y, zIndex: 200 }}>`.
- Contains `<MiniBoard fen={previewState.fen} lastMove={previewState.lastMove} size={200} />`.
- The popup div has `pointer-events: none` (CSS class) so it never intercepts
  mouse events and causes flicker.

---

### Phase 3 — Settings state

#### `frontend/src/state/actions.ts`

Add to `AppAction` under the board preview section:

```typescript
| { type: "set_position_preview_on_hover"; enabled: boolean }
```

#### `frontend/src/state/app_reducer.ts`

Add to `AppStoreState`:

```typescript
/** Whether hovering over a move token shows a position preview popup. */
positionPreviewOnHover: boolean;
```

Add to `initialAppStoreState`:

```typescript
positionPreviewOnHover: true,
```

Add reducer case:

```typescript
case "set_position_preview_on_hover":
  return { ...state, positionPreviewOnHover: action.enabled };
```

#### `frontend/src/state/selectors.ts`

```typescript
export const selectPositionPreviewOnHover = (state: AppStoreState): boolean =>
  state.positionPreviewOnHover;
```

#### `frontend/src/state/ServiceContext.tsx`

Add to `AppStartupServices`:

```typescript
setPositionPreviewOnHover: (enabled: boolean) => void;
```

#### `frontend/src/hooks/createAppServices.ts`

Wire the new callback to dispatch:

```typescript
setPositionPreviewOnHover: (enabled: boolean): void => {
  dispatch({ type: "set_position_preview_on_hover", enabled });
},
```

#### `frontend/src/components/MenuPanel.tsx`

Add an `inline-control` label block following the existing sound-toggle pattern.
Read state via `selectPositionPreviewOnHover(state)`. Call
`services.setPositionPreviewOnHover(e.target.checked)` on change.

I18n key: `controls.positionPreviewOnHover` / fallback `"Position preview on hover"`.

---

### Phase 4 — PGN editor integration

**File:** `frontend/src/components/PgnTextEditor.tsx`

#### 4a. Access context and setting

Inside `PgnTextEditor`:

```typescript
const { showPreview, hidePreview } = useHoverPreview();
const positionPreviewOn = selectPositionPreviewOnHover(state);
```

#### 4b. Hover handlers

```typescript
const handleMoveHover = useCallback(
  (moveId: string, rect: DOMRect): void => {
    if (!positionPreviewOn || !pgnModel) return;
    const resolved = resolveMovePositionById(pgnModel, moveId);
    if (!resolved) return;
    showPreview(resolved.fen, resolved.lastMove, rect);
  },
  [positionPreviewOn, pgnModel, showPreview],
);

const handleMoveHoverEnd = useCallback((): void => {
  hidePreview();
}, [hidePreview]);
```

Use `resolveMovePositionById(pgnModel, moveId)` — a pure function already
exported from `move_position.ts` — rather than adding a new service callback
for an ephemeral lookup.

#### 4c. Thread through `TokenView` and `MoveSpan`

Add to `MoveSpanProps`:

```typescript
onMoveHover?: (moveId: string, rect: DOMRect) => void;
onMoveHoverEnd?: () => void;
```

Add to `MoveSpan`'s `<span>`:

```typescript
const handleMouseEnter = useCallback(
  (e: MouseEvent<HTMLSpanElement>): void => {
    onMoveHover?.(moveId, (e.currentTarget as HTMLSpanElement).getBoundingClientRect());
  },
  [moveId, onMoveHover],
);

const handleMouseLeave = useCallback((): void => {
  onMoveHoverEnd?.();
}, [onMoveHoverEnd]);
```

Prop-drill `onMoveHover` and `onMoveHoverEnd` through the token rendering loop
into `TokenView` into `MoveSpan`. The callbacks are optional (`?`) so existing
call sites without hover support compile without change.

---

### Phase 5 — Analysis panel integration

**File:** `frontend/src/components/AnalysisPanel.tsx`

#### 5a. Refactor PV rendering to per-token spans

Currently (line ~169) the entire PV is joined into a single string. Refactor
the `analysis-panel-variation-pv` span contents to render each SAN as a
separate child `<span className="analysis-panel-pv-move">`:

```tsx
<span className="analysis-panel-variation-pv">
  {(v.pvSan ?? v.pv).slice(0, 8).map((san, idx) => (
    <span
      key={idx}
      className="analysis-panel-pv-move"
      onMouseEnter={
        onPvMoveHover
          ? (e): void => {
              onPvMoveHover(
                v.pvSan ?? v.pv,
                idx,
                (e.currentTarget as HTMLSpanElement).getBoundingClientRect(),
              );
            }
          : undefined
      }
      onMouseLeave={onPvMoveHoverEnd}
    >
      {san}{" "}
    </span>
  ))}
  {(v.pvSan ?? v.pv).length > 8 ? "…" : ""}
</span>
```

#### 5b. New props

```typescript
onPvMoveHover?: (pvSans: string[], upToIndex: number, rect: DOMRect) => void;
onPvMoveHoverEnd?: () => void;
```

#### 5c. Parent wiring in `AppShell.tsx`

`AppShell` computes `currentFen` (FEN at current ply). Add:

```typescript
const { showPreview, hidePreview } = useHoverPreview();
const positionPreviewOn = selectPositionPreviewOnHover(state);

const handlePvMoveHover = useCallback(
  (pvSans: string[], upToIndex: number, rect: DOMRect): void => {
    if (!positionPreviewOn) return;
    const result = replayPvToPosition(currentFen, pvSans, upToIndex);
    showPreview(result.fen, result.lastMove, rect);
  },
  [positionPreviewOn, currentFen, showPreview],
);

const handlePvMoveHoverEnd = useCallback((): void => {
  hidePreview();
}, [hidePreview]);
```

Pass these as `onPvMoveHover` and `onPvMoveHoverEnd` to `<AnalysisPanel>`.

---

### Phase 6 — CSS

**File:** `frontend/src/styles.css`

```css
/* ── Hover position preview popup ──────────────────────────────────────────── */

.hover-position-popup {
  position: fixed;
  z-index: 200;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  box-shadow: var(--shadow-m);
  padding: 4px;
  pointer-events: none;
}

.hover-position-popup-board {
  display: block;
  width: 200px;
  height: 200px;
}
```

**File:** `frontend/src/styles.css` (or editor styles):

```css
.analysis-panel-pv-move {
  cursor: default;
}
```

---

## App Root Mounting

**File:** `frontend/src/components/AppShell.tsx`

Wrap the app tree with `HoverPreviewProvider` and place `HoverPositionPopup`
as a sibling to `<main>` (portal renders to `document.body` regardless):

```tsx
return (
  <ServiceContextProvider value={services}>
    <HoverPreviewProvider>
      <main className="app">
        {/* ... existing app content ... */}
      </main>
      <HoverPositionPopup />
    </HoverPreviewProvider>
  </ServiceContextProvider>
);
```

---

## Architecture Notes

**Pure-logic boundary:** `replayPvToPosition` lives in `board/move_position.ts`
with no React imports. It receives `startFen` as a plain string.

**Single rendering owner:** `HoverPositionPopup` is the sole owner of the
floating mini-board DOM. `ChessBoard` continues to own the main board. No
shared mutable state between them.

**Context vs. reducer:** `HoverPreviewState` is ephemeral pointer-driven UI
feedback — local `useState` in `HoverPreviewProvider` is correct. The user
preference `positionPreviewOnHover` is persistent intent → reducer.

**`pointer-events: none` on popup:** The popup must never capture mouse events.
Without this, the mouse approaching the popup would trigger `onMouseLeave` on
the move span, hiding the popup before the user sees it (flicker loop). With
`pointer-events: none`, the hovered span drives show/hide entirely.

**Hover handler stability:** `handleMouseEnter`/`handleMouseLeave` in
`MoveSpan` are wrapped in `useCallback` with stable deps so the entire token
list does not re-create handlers on each parent render.

**AnalysisPanel PV refactor scope:** Only the `analysis-panel-variation-pv`
inner rendering changes. The click-to-preview `onClick` on the `<li>` (line 144)
remains unchanged; only child `<span>` elements gain hover handlers.

---

## Testing Notes

**Unit test:** `frontend/test/board/move_position.test.ts`

- Happy path: from standard start FEN, replay `["e4", "e5", "Nf3"]` with
  `upToIndex=2` → verify FEN and `lastMove` squares `["g1","f3"]`.
- Edge: `upToIndex` beyond array length → partial replay, no throw.
- Edge: malformed `startFen` → `{ fen: startFen, lastMove: null }`, no throw.
- Edge: illegal SAN mid-sequence → partial replay stops, no throw.

**Manual integration checklist:**
- [ ] Hover mainline move (plain/text/tree modes) → popup shows correct position.
- [ ] Hover variation move → popup shows correct variation position.
- [ ] Mouse-leave → popup disappears.
- [ ] Toggle off in menu → no popup on hover.
- [ ] Toggle on → popup resumes.
- [ ] Hover PV move in analysis panel → popup shows correct PV position.
- [ ] Near viewport edges → popup does not overflow.
- [ ] Main board `boardPreview` state is unaffected by hovering.
- [ ] `npm run typecheck` passes with no new `any` types.
