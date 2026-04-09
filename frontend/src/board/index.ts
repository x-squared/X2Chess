/**
 * board — public API for board navigation, decoration, and gesture modules.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY TERMINOLOGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Ply** — a single half-move in a chess game: White's first move is ply 1,
 * Black's reply is ply 2, and so on.  `currentPly` on the session is the ply
 * the board is currently showing; 0 means the starting position.
 *
 * **Move ID** — a unique opaque string identifier assigned by the PGN parser to
 * every move node in the parsed game tree.  It is stable across edits and is the
 * primary key for looking up a move's board position in the
 * `MovePositionIndex`.  Move IDs exist for mainline moves *and* for moves inside
 * variations (RAVs); they have no relationship to ply numbers.
 *
 * **PGN model** — the parsed representation of a PGN game produced by the
 * external PGN parser (in `parts/pgnparser`).  It is a tree: a root
 * `PgnVariationNode` whose `entries` array contains `PgnMoveNode` and nested
 * `PgnVariationNode` items.  The board module consumes this tree only through
 * the narrow `PgnModelForMoves` interface (`{ root?: PgnVariationNode }`).
 *
 * **Variation (RAV)** — a branch in the game tree, recorded in PGN inside
 * parentheses.  Variation moves are part of the PGN model and have move IDs but
 * no mainline ply number.  The board can display variation moves through the
 * selected-move path (see below) without changing `currentPly`.
 *
 * **FEN** — Forsyth-Edwards Notation: a compact string that fully describes a
 * chess position (piece placement, side to move, castling rights, en-passant
 * square, and move clocks).  Both chess.js and Chessground accept FEN strings.
 *
 * **BoardKey** — a two-character square identifier such as `"e4"` or `"a1"`,
 * constrained to the 64 legal squares by the branded type `BoardKey` and the
 * type-guard `isBoardKey`.
 *
 * **Board preview** — a transient FEN that overrides the ply-based position
 * without changing `currentPly`.  Used for PV hover in the engine panel and for
 * any other ephemeral position display.  Cleared automatically when `gotoPly` is
 * called.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CHESS.JS AND CHESSGROUND — ROLES AND SEPARATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The board module uses two external libraries and keeps them strictly separated:
 *
 *   • **chess.js** (`Chess`) — the game-logic engine.  It validates moves,
 *     tracks piece placement, and produces FEN strings.  Chess.js instances are
 *     created and discarded transiently; none is stored on the session.
 *
 *   • **Chessground** — the SVG board renderer.  It receives a FEN string plus
 *     optional last-move squares and draws the position.  Chessground knows
 *     nothing about game history or move legality; it is a pure display widget.
 *
 * These two libraries never interact directly.  Chess.js produces FEN; FEN is
 * handed to Chessground.  That pipeline runs through two separate paths:
 *
 *  Path A — ply-based (mainline navigation)
 *  ─────────────────────────────────────────
 *  `runtime.ts` owns this path.  `buildGameAtPly(ply)` replays the mainline
 *  SAN array from the session (`state.moves`) move-by-move into a fresh
 *  `Chess()` instance and returns it.  The caller then passes the resulting
 *  `Chess` object to `renderBoard(game)`.  `renderBoard` reads `game.fen()` and
 *  the `verboseMoves[ply-1]` entry (which carries the `from`/`to` squares for
 *  the last-move highlight) and calls `board.set(…)` on the Chessground API.
 *
 *  Path B — move-ID-based (variation / annotation navigation)
 *  ────────────────────────────────────────────────────────────
 *  `move_position.ts` and `move_lookup.ts` own this path.
 *  `buildMovePositionById(pgnModel)` walks the full PGN tree depth-first,
 *  replaying every SAN encountered (via `applySanWithFallback`) into transient
 *  `Chess` instances cloned at each branch point.  The result is a
 *  `MovePositionIndex` — a flat `Record<moveId, MovePositionRecord>` — where
 *  every record stores the FEN after that move, the from/to squares, the
 *  mainline ply (or null for variation moves), a parent-move link, and doubly-
 *  linked prev/next pointers within the same variation.  The index is built once
 *  per game load and cached on the session.
 *
 *  When the user selects a variation move by ID, `getMovePositionById` looks up
 *  the record in the cached index (rebuilding it on cache miss) and the board
 *  component reads `record.fen` and `record.lastMove` to call `board.set(…)`
 *  directly, bypassing chess.js entirely at render time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NAVIGATION MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `navigation.ts` provides `createBoardNavigationCapabilities`, which wires the
 * two paths together into user-facing operations:
 *
 *   `gotoPly(nextPly, { animate? })` — mainline jump or animated step sequence.
 *     Animation fires one `dispatchNavigation()` per step, playing a sound
 *     (`playMoveSound`) and sleeping `getDelayMs()` ms between steps.  Sound
 *     type is resolved by replaying the mainline with chess.js up to `plyAfterStep`
 *     to detect stalemate (the only outcome not signalled by SAN syntax alone).
 *
 *   `gotoRelativeStep(direction)` — move one step backward or forward.  When a
 *     variation move is selected, it follows `previousMoveId` / `nextMoveId`
 *     pointers in the `MovePositionRecord` instead of decrementing `currentPly`,
 *     keeping the user inside the variation.  Hitting the start of a variation
 *     jumps to `parentMoveId` (the mainline move the RAV branches from).
 *
 *   `handleSelectedMoveArrowHotkey(event)` — maps keyboard arrows to navigation:
 *     Left/Right step through moves; Shift+Down/Up cycle between sibling
 *     variations at the same branch point (using `variationFirstMoveIds` on the
 *     parent `MovePositionRecord`); unshifted Down enters the first child
 *     variation; Shift+Left/Right jump to the comment before/after a move.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BOARD PREVIEW (TRANSIENT POSITIONS)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `state.boardPreview` is a `{ fen, lastMove? }` value that, when non-null,
 * makes `renderBoard` ignore `currentPly` entirely and show the preview FEN
 * instead.  `gotoPly` clears `boardPreview` to `null` before advancing.
 *
 * The primary consumer is the engine PV panel in `AppShell`: hovering over a
 * PV move token calls `replayPvToPosition(startFen, pvSans, upToIndex)` (from
 * `move_position.ts`), which applies the SAN array into a fresh chess.js instance
 * up to the hovered index and returns the FEN + last-move squares.  That result
 * is written into `boardPreview` and triggers a re-render without touching
 * `currentPly`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MOVE HINTS (CHESS.JS AT DISPLAY TIME)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `move_hints.ts` is the only place chess.js is used at render/interaction time
 * rather than at index-build time.  When the hover listener detects the cursor
 * entering a piece square, the board component calls `computeMoveHints(game,
 * square)` with a chess.js `Chess` instance already at the current position
 * (built by `buildGameAtPly` or from a FEN in the move-position index).
 * `chess.moves({ verbose: true })` provides all legal moves; the function filters
 * to the hovered square and returns one `MoveHint` per destination, flagging
 * captures so the renderer can choose between a dot and a ring.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GESTURE AND HOVER SUBSYSTEMS (NO CHESS.JS)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `drawable_gestures.ts` and `hover_listener.ts` are pure DOM modules with no
 * chess-logic dependency.  They work entirely in screen coordinates and
 * Chessground's DOM structure:
 *
 *   `attachDrawableGestures(opts, getCurrentShapes)` — listens for right-click
 *     events to toggle `BoardShape` values (highlights and arrows).  Square
 *     identification uses geometric hit-testing against the `cg-board` bounding
 *     box rather than Chessground's `<square>` elements, which only exist for
 *     occupied/highlighted squares.  Returns a disposer.
 *
 *   `attachHoverListener(opts)` — uses `mousemove` + `document.elementsFromPoint`
 *     to detect piece elements even under `pointer-events: none` (Chessground
 *     sets this on pieces to prevent drag interference).  Fires `onPieceEnter`
 *     with the square key when a piece is found, `onPieceLeave` otherwise.
 *     Returns a disposer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAPE PIPELINE (PGN ↔ BOARD STATE)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Board decorations (highlights and arrows) are stored in PGN move comments as
 * `[%csl Ge4,Rd5]` / `[%cal Ge2e4]` annotations.  `parseShapes(comment)` reads
 * them out of a raw comment string.  `serializeShapes(shapes)` writes them back.
 * `stripShapeAnnotations(comment)` removes them from a comment for display.
 * The board component owns the round-trip: it reads shapes from the annotation on
 * move selection, feeds them to Chessground, and writes them back when the user
 * draws or erases shapes via the right-click gesture layer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATION SUMMARY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Typical integration order (inside a board React component or hook):
 *   1. Call `ensureBoard()` once after the DOM element mounts.
 *   2. On game load: the session wires `buildMovePositionById` via
 *      `createMoveLookupCapabilities` (injected through `createAppServices`).
 *   3. On each render: call `buildGameAtPly(currentPly)` and pass the result to
 *      `renderBoard(game)`.  If `boardPreview` is set, `renderBoard` uses the
 *      preview FEN automatically.
 *   4. On move-click: call `getMovePositionById(moveId)` to get the FEN and
 *      last-move squares; set them on `boardPreview` or call `board.set` directly.
 *   5. On keyboard arrow: call `handleSelectedMoveArrowHotkey(event)`.
 *   6. After mounting the board element: call `attachDrawableGestures` and
 *      `attachHoverListener`; store their disposers and invoke them on unmount.
 *   7. In the hover callback: call `computeMoveHints(game, square)` and pass the
 *      result to Chessground or a move-hint overlay component.
 */

// ── Navigation capabilities ───────────────────────────────────────────────────
type BoardState = {
  currentPly: number;
  moves: string[];
};

type BoardCapabilities = {
  getCurrentPly: () => number;
  getMoveCount: () => number;
};

export const createBoardCapabilities = (state: BoardState): BoardCapabilities => ({
  getCurrentPly: (): number => state.currentPly,
  getMoveCount: (): number => state.moves.length,
});

// ── Shared types ──────────────────────────────────────────────────────────────
export type {
  BoardFile,
  BoardRank,
  BoardKey,
  ShapeColor,
  SquareHighlight,
  BoardArrow,
  BoardShape,
  ShapePresets,
} from "./board_shapes";
export { isBoardKey, DEFAULT_PRESETS } from "./board_shapes";

// ── Shape parsing and serialization ──────────────────────────────────────────
export { parseShapes } from "./shape_parser";
export { serializeShapes, stripShapeAnnotations } from "./shape_serializer";

// ── Gesture and hover listeners ───────────────────────────────────────────────
export type { DrawableGestureOptions } from "./drawable_gestures";
export { attachDrawableGestures } from "./drawable_gestures";
export type { HoverListenerOptions } from "./hover_listener";
export { attachHoverListener } from "./hover_listener";

// ── Move hints ────────────────────────────────────────────────────────────────
export type { MoveHint } from "./move_hints";
export { computeMoveHints } from "./move_hints";
