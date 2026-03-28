/**
 * ChessBoard — React wrapper around the Chessground board library.
 *
 * Manages a Chessground instance imperatively (via refs) while receiving all
 * position data reactively from the `AppStoreState` context.  When `currentPly`
 * or `moves` changes the board is updated via `cgRef.current.set(...)` without
 * triggering an extra render cycle.
 *
 * Integration API:
 * - `<ChessBoard onMovePlayed={fn} />` — pass `onMovePlayed` to enable
 *   interactive move entry. Omit for view-only mode.
 * - Reads: `currentPly`, `moves`, `moveDelayMs`, `boardFlipped`,
 *   `boardPreview`, `selectedMoveId` from context.
 *
 * Configuration API:
 * - `onMovePlayed(from, to)` — optional; when present the board is interactive.
 * - `overlayShapes`          — ephemeral shapes (training hints, engine arrows)
 *   merged with PGN annotation shapes for the current move.
 * - `onShapesChanged(shapes)` — called when the user draws or erases shapes
 *   via right-click gestures; caller is responsible for persisting to PGN.
 * - `moveHintColors`         — optional engine evaluation colours keyed by
 *   destination square; applied to hover-destination dots when present.
 * - `showMoveHints`          — set `false` to disable hover destination dots.
 *   Defaults to `true`.
 * - `presets`                — primary / secondary colour presets for drawing.
 *
 * Communication API:
 * - `onMovePlayed(from, to)` fires after a legal drop; caller handles promotion
 *   and fork resolution via `useMoveEntry`.
 * - `onShapesChanged(shapes)` fires after every completed right-click gesture.
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Chess } from "chess.js";
import { Chessground } from "chessground";
import { useAppContext } from "../state/app_context";
import {
  selectBoardFlipped,
  selectBoardPreview,
  selectCurrentPly,
  selectMoveDelayMs,
  selectMoves,
  selectAnnotationShapes,
} from "../state/selectors";
import type { BoardKey, BoardShape, ShapeColor, ShapePresets } from "../board/board_shapes";
import { isBoardKey, DEFAULT_PRESETS } from "../board/board_shapes";
import type { SquareStyleMode } from "../runtime/shape_prefs";
import type { MoveHint } from "../board/move_hints";
import { attachDrawableGestures } from "../board/drawable_gestures";
import { attachHoverListener } from "../board/hover_listener";
import { computeMoveHints } from "../board/move_hints";

type ChessgroundApi = ReturnType<typeof Chessground>;

type CgColor = "white" | "black";
type CgDests = Map<BoardKey, BoardKey[]>;
type KeyPair = [BoardKey, BoardKey];

/** CSS class applied to a square via Chessground's `highlight.custom`. */
type SquareClass = string;

export type ChessBoardProps = {
  /** When provided, the board is interactive and calls this on piece drops. */
  onMovePlayed?: (from: string, to: string) => void;
  /**
   * Ephemeral shapes (training hints, engine arrows).
   * Merged with PGN annotation shapes derived from the current move.
   */
  overlayShapes?: BoardShape[];
  /**
   * Called when the user draws or erases a shape via right-click gesture.
   * Receives the complete new shape list for the current ply.
   * @param shapes - Updated decoration array.
   */
  onShapesChanged?: (shapes: BoardShape[]) => void;
  /**
   * Engine-supplied evaluation colours keyed by destination square.
   * When set, hover-destination dots use these colours instead of the neutral
   * style.  Populated externally once engine integration is wired.
   */
  moveHintColors?: Map<BoardKey, ShapeColor>;
  /**
   * Set to `false` to hide hover-destination dots entirely.
   * Defaults to `true`.
   */
  showMoveHints?: boolean;
  /** Primary / secondary colour presets for right-click drawing. */
  presets?: ShapePresets;
  /**
   * Rendering style for square highlights: filled overlay (`"fill"`) or
   * inset border (`"frame"`).  Defaults to `"fill"`.
   */
  squareStyle?: SquareStyleMode;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reconstruct a Chess position by replaying `ply` moves from the SAN list. */
const buildGameAtPly = (ply: number, sanMoves: string[]): Chess => {
  const game: Chess = new Chess();
  const limit: number = Math.min(ply, sanMoves.length);
  for (let i: number = 0; i < limit; i += 1) {
    game.move(sanMoves[i]);
  }
  return game;
};

/** Derive the last-move key-pair from a Chess instance history. */
const computeLastMove = (game: Chess, ply: number): KeyPair | undefined => {
  if (ply <= 0) return undefined;
  const history = game.history({ verbose: true }) as Array<{ from: string; to: string }>;
  const lastEntry = history[ply - 1];
  if (!lastEntry) return undefined;
  const { from, to } = lastEntry;
  return isBoardKey(from) && isBoardKey(to) ? [from, to] : undefined;
};

/** Compute legal destination map for Chessground from a Chess instance. */
const computeDests = (game: Chess): CgDests => {
  const dests: CgDests = new Map();
  for (const move of game.moves({ verbose: true }) as Array<{ from: string; to: string }>) {
    if (!isBoardKey(move.from) || !isBoardKey(move.to)) continue;
    const existing: BoardKey[] = dests.get(move.from) ?? [];
    if (!existing.includes(move.to)) existing.push(move.to);
    dests.set(move.from, existing);
  }
  return dests;
};

/**
 * Build a `Map<BoardKey, SquareClass>` for Chessground's `highlight.custom`
 * by merging square highlights (board shapes) and move-hint dots.
 * Board shape highlights take priority over move-hint dots on the same square.
 *
 * @param highlights - Square highlights from annotation + overlay shapes.
 * @param hints      - Hover-destination hints for the currently hovered piece.
 */
const buildCustomHighlights = (
  highlights: Array<{ square: BoardKey; cssClass: SquareClass }>,
  hints: MoveHint[],
  moveHintColors?: Map<BoardKey, ShapeColor>,
): Map<BoardKey, SquareClass> => {
  const map: Map<BoardKey, SquareClass> = new Map();

  // Move hints first (lower priority).
  for (const hint of hints) {
    const engineColor: ShapeColor | undefined = moveHintColors?.get(hint.square);
    const suffix: string = hint.isCapture ? "ring" : "dot";
    const cls: SquareClass = engineColor
      ? `move-hint-${suffix}-${engineColor}`
      : `move-hint-${suffix}`;
    map.set(hint.square, cls);
  }

  // Board shape highlights second (higher priority — overwrite hints).
  for (const h of highlights) {
    map.set(h.square, h.cssClass);
  }

  return map;
};

// ── Component ─────────────────────────────────────────────────────────────────

/** React component that owns and renders the Chessground board. */
export const ChessBoard = ({
  onMovePlayed,
  overlayShapes = [],
  onShapesChanged,
  moveHintColors,
  showMoveHints = true,
  presets = DEFAULT_PRESETS,
  squareStyle = "fill",
}: ChessBoardProps = {}): ReactElement => {
  const { state } = useAppContext();
  const currentPly: number = selectCurrentPly(state);
  const moves: string[] = selectMoves(state);
  const moveDelayMs: number = selectMoveDelayMs(state);
  const boardFlipped: boolean = selectBoardFlipped(state);
  const boardPreview: { fen: string; lastMove?: [string, string] | null } | null =
    selectBoardPreview(state);
  const annotationShapes: BoardShape[] = selectAnnotationShapes(state);

  const boardElRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ChessgroundApi | null>(null);
  const moveDelayMsRef = useRef<number>(moveDelayMs);
  const boardFlippedRef = useRef<boolean>(boardFlipped);
  const onMovePlayedRef = useRef<((from: string, to: string) => void) | undefined>(onMovePlayed);
  const onShapesChangedRef = useRef<((shapes: BoardShape[]) => void) | undefined>(onShapesChanged);
  const presetsRef = useRef<ShapePresets>(presets);

  moveDelayMsRef.current = moveDelayMs;
  boardFlippedRef.current = boardFlipped;
  onMovePlayedRef.current = onMovePlayed;
  onShapesChangedRef.current = onShapesChanged;
  presetsRef.current = presets;

  /** Hover state: which square (if any) the cursor is over. */
  const [hoveredSquare, setHoveredSquare] = useState<BoardKey | null>(null);

  /** User-drawn shapes for the current ply (ephemeral React state). */
  const [drawnShapes, setDrawnShapes] = useState<BoardShape[]>([]);
  const drawnShapesRef = useRef<BoardShape[]>(drawnShapes);
  drawnShapesRef.current = drawnShapes;

  // Clear drawn shapes and hover state when the ply changes.
  useEffect((): void => {
    setDrawnShapes([]);
    setHoveredSquare(null);
  }, [currentPly, boardPreview]);

  // ── Initialize Chessground once on mount ──────────────────────────────────
  useEffect((): (() => void) => {
    const el: HTMLDivElement | null = boardElRef.current;
    if (!el) return (): void => undefined;

    const api: ChessgroundApi = Chessground(el, {
      fen: "start",
      orientation: boardFlippedRef.current ? "black" : "white",
      coordinates: true,
      viewOnly: !onMovePlayedRef.current,
      movable: {
        color: onMovePlayedRef.current ? "both" : undefined,
        free: false,
        events: {
          after: (orig: string, dest: string): void => {
            onMovePlayedRef.current?.(orig, dest);
          },
        },
      },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: moveDelayMsRef.current },
    });
    cgRef.current = api;

    return (): void => {
      api.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once; Chessground lifecycle tied to this component instance

  // ── Attach / detach hover listener ───────────────────────────────────────
  useEffect((): (() => void) => {
    const el: HTMLDivElement | null = boardElRef.current;
    if (!showMoveHints || !el) return (): void => undefined;
    return attachHoverListener({
      boardEl: el,
      onPieceEnter: (sq: BoardKey): void => setHoveredSquare(sq),
      onPieceLeave: (): void => setHoveredSquare(null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMoveHints]);

  // ── Attach / detach right-click gesture handler ───────────────────────────
  useEffect((): (() => void) => {
    const el: HTMLDivElement | null = boardElRef.current;
    if (!el) return (): void => undefined;

    const getCurrentShapes = (): BoardShape[] => drawnShapesRef.current;

    return attachDrawableGestures(
      {
        boardEl: el,
        presets: presetsRef.current,
        onChange: (shapes: BoardShape[]): void => {
          setDrawnShapes(shapes);
          onShapesChangedRef.current?.(shapes);
        },
      },
      getCurrentShapes,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // re-attach only on mount; presets are read via ref

  // ── Update board position and legal moves when reactive state changes ──
  useEffect((): void => {
    const api: ChessgroundApi | null = cgRef.current;
    if (!api) return;

    if (boardPreview) {
      const previewLastMove: KeyPair | undefined =
        boardPreview.lastMove &&
        isBoardKey(boardPreview.lastMove[0]) &&
        isBoardKey(boardPreview.lastMove[1])
          ? [boardPreview.lastMove[0], boardPreview.lastMove[1]]
          : undefined;
      const isInteractivePreview: boolean = Boolean(onMovePlayedRef.current);
      if (isInteractivePreview) {
        const previewGame: Chess = new Chess();
        try { previewGame.load(boardPreview.fen); } catch { /* fall through */ }
        const cgColor: CgColor = previewGame.turn() === "w" ? "white" : "black";
        api.set({
          fen: boardPreview.fen,
          lastMove: previewLastMove,
          viewOnly: false,
          movable: { color: cgColor, free: false, dests: computeDests(previewGame) },
          animation: { enabled: true, duration: moveDelayMs },
        });
      } else {
        api.set({
          fen: boardPreview.fen,
          lastMove: previewLastMove,
          viewOnly: true,
          movable: { color: undefined, dests: new Map() },
          animation: { enabled: true, duration: moveDelayMs },
        });
      }
      return;
    }

    const game: Chess = buildGameAtPly(currentPly, moves);
    const fen: string = game.fen();
    const lastMove: KeyPair | undefined = computeLastMove(game, currentPly);
    const isInteractive: boolean = Boolean(onMovePlayedRef.current);

    let movableConfig: Record<string, unknown>;
    if (isInteractive) {
      const sideToMove: string = game.turn();
      const cgColor: CgColor = sideToMove === "w" ? "white" : "black";
      movableConfig = { color: cgColor, free: false, dests: computeDests(game) };
    } else {
      movableConfig = { color: undefined, dests: new Map() };
    }

    api.set({
      fen,
      lastMove,
      viewOnly: !isInteractive,
      movable: movableConfig,
      animation: { enabled: true, duration: moveDelayMs },
    });
  }, [boardPreview, currentPly, moves, moveDelayMs]);

  // ── Sync board orientation when flip state changes ─────────────────────────
  useEffect((): void => {
    cgRef.current?.set({ orientation: boardFlipped ? "black" : "white" });
  }, [boardFlipped]);

  // ── Sync shapes: highlights (custom CSS classes) + arrows (SVG) ──────────
  useEffect((): void => {
    const api: ChessgroundApi | null = cgRef.current;
    if (!api) return;

    // Merge all three shape sources.
    const allShapes: BoardShape[] = [...annotationShapes, ...overlayShapes, ...drawnShapes];

    // ── Arrows → Chessground setAutoShapes ──
    const arrowShapes: Array<{ orig: BoardKey; dest: BoardKey; brush: string }> = allShapes
      .filter((s: BoardShape): boolean => s.kind === "arrow")
      .map((s: BoardShape) => {
        if (s.kind !== "arrow") return { orig: "a1" as BoardKey, dest: "a1" as BoardKey, brush: "green" };
        return { orig: s.from, dest: s.to, brush: s.color };
      });
    api.setAutoShapes(arrowShapes);

    // ── Highlights → Chessground highlight.custom ──
    const squareHighlights: Array<{ square: BoardKey; cssClass: SquareClass }> = allShapes
      .filter((s: BoardShape): boolean => s.kind === "highlight")
      .map((s: BoardShape) => {
        if (s.kind !== "highlight") return { square: "a1" as BoardKey, cssClass: "" };
        return { square: s.square, cssClass: `user-shape-${s.color}` };
      });

    // Compute hover hints for the current position.
    const hints: MoveHint[] = (() => {
      if (!hoveredSquare) return [];
      const game: Chess = boardPreview
        ? (() => {
            const g: Chess = new Chess();
            try { g.load(boardPreview.fen); } catch { /* fall through */ }
            return g;
          })()
        : buildGameAtPly(currentPly, moves);
      return computeMoveHints(game, hoveredSquare);
    })();

    const customMap: Map<BoardKey, SquareClass> = buildCustomHighlights(
      squareHighlights,
      hints,
      moveHintColors,
    );

    api.set({ highlight: { lastMove: true, check: true, custom: customMap } });
  }, [annotationShapes, overlayShapes, drawnShapes, hoveredSquare, moveHintColors, currentPly, moves, boardPreview]);

  // ── Apply square-style class (fill vs frame) ──────────────────────────────
  useEffect((): void => {
    const el = boardElRef.current;
    if (!el) return;
    el.classList.remove("shapes-fill", "shapes-frame");
    el.classList.add(squareStyle === "frame" ? "shapes-frame" : "shapes-fill");
  }, [squareStyle]);

  return <div ref={boardElRef} className="board" />;
};
