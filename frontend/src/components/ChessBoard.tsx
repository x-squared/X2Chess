/**
 * ChessBoard component — React wrapper around the Chessground board library.
 *
 * Manages a Chessground instance imperatively (via refs) while receiving all
 * position data reactively from the `AppStoreState` context.  When `currentPly`
 * or `moves` changes the board is updated via `cgRef.current.set(...)` without
 * triggering an extra render cycle.
 *
 * Integration API:
 * - `<ChessBoard />` — mount inside a sized container; renders a single flex div
 *   whose child is the Chessground host element.
 * - Reads: `currentPly`, `moves`, `moveDelayMs`, `soundEnabled` from context.
 * - Writes: nothing — navigation is handled via service callbacks in `AppShell`.
 *
 * Configuration API:
 * - No props required.  Board is always view-only; moves are driven by state.
 *
 * Communication API:
 * - Exposes no callbacks.  Keyboard navigation is handled via service callbacks.
 */

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Chess } from "chess.js";
import { Chessground } from "chessground";
import { useAppContext } from "../state/app_context";
import {
  selectBoardPreview,
  selectCurrentPly,
  selectMoveDelayMs,
  selectMoves,
} from "../state/selectors";

type ChessgroundApi = ReturnType<typeof Chessground>;

type BoardFile = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type BoardRank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type BoardKey = `${BoardFile}${BoardRank}`;
type KeyPair = [BoardKey, BoardKey];

/** Narrow a string to a valid board key (e.g. "e4"). */
const isBoardKey = (value: string): value is BoardKey => /^[a-h][1-8]$/.test(value);

/**
 * Reconstruct a Chess position by replaying `ply` moves from the SAN list.
 *
 * @param ply - Number of half-moves to replay (0 = start position).
 * @param sanMoves - Main-line SAN move strings.
 * @returns Chess instance at the target position.
 */
const buildGameAtPly = (ply: number, sanMoves: string[]): Chess => {
  const game: Chess = new Chess();
  const limit: number = Math.min(ply, sanMoves.length);
  for (let i: number = 0; i < limit; i += 1) {
    game.move(sanMoves[i]);
  }
  return game;
};

/**
 * Derive the last-move key-pair from a Chess instance history for board highlight.
 *
 * @param game - Chess instance already at the target ply.
 * @param ply - The target ply (0 means no last move).
 * @returns `[from, to]` key pair or `undefined` when unavailable.
 */
const computeLastMove = (game: Chess, ply: number): KeyPair | undefined => {
  if (ply <= 0) return undefined;
  const history: Array<{ from: string; to: string }> = game.history({ verbose: true }) as Array<{
    from: string;
    to: string;
  }>;
  const lastEntry: { from: string; to: string } | undefined = history[ply - 1];
  if (!lastEntry) return undefined;
  const { from, to }: { from: string; to: string } = lastEntry;
  return isBoardKey(from) && isBoardKey(to) ? [from, to] : undefined;
};

/** React component that owns and renders the interactive Chessground board. */
export const ChessBoard = (): ReactElement => {
  const { state } = useAppContext();
  const currentPly: number = selectCurrentPly(state);
  const moves: string[] = selectMoves(state);
  const moveDelayMs: number = selectMoveDelayMs(state);
  const boardPreview: { fen: string; lastMove?: [string, string] | null } | null =
    selectBoardPreview(state);

  /** DOM node Chessground attaches to. */
  const boardElRef = useRef<HTMLDivElement>(null);
  /** Stable reference to the Chessground API instance. */
  const cgRef = useRef<ChessgroundApi | null>(null);
  /**
   * Keep a ref for moveDelayMs so the initialization effect closure sees the
   * initial value without needing to be listed as a dependency.
   */
  const moveDelayMsRef = useRef<number>(moveDelayMs);

  // Keep the ref current on every render.
  moveDelayMsRef.current = moveDelayMs;

  // ── Initialize Chessground once on mount ────────────────────────────────
  useEffect((): (() => void) => {
    const el: HTMLDivElement | null = boardElRef.current;
    if (!el) return (): void => undefined;

    const api: ChessgroundApi = Chessground(el, {
      fen: "start",
      orientation: "white",
      coordinates: true,
      viewOnly: true,
      movable: { color: undefined },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: moveDelayMsRef.current },
    });
    cgRef.current = api;

    return (): void => {
      api.destroy();
      cgRef.current = null;
    };
  }, []); // runs once; Chessground lifecycle tied to this component instance

  // ── Update board position when reactive state changes ───────────────────
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
      api.set({ fen: boardPreview.fen, lastMove: previewLastMove, animation: { enabled: true, duration: moveDelayMs } });
      return;
    }

    const game: Chess = buildGameAtPly(currentPly, moves);
    const fen: string = game.fen();
    const lastMove: KeyPair | undefined = computeLastMove(game, currentPly);

    api.set({
      fen,
      lastMove,
      animation: { enabled: true, duration: moveDelayMs },
    });
  }, [boardPreview, currentPly, moves, moveDelayMs]);

  return <div ref={boardElRef} className="board" />;
};
