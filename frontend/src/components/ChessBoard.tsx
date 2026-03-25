/**
 * ChessBoard component — React wrapper around the Chessground board library.
 *
 * Manages a Chessground instance imperatively (via refs) while receiving all
 * position data reactively from the `AppStoreState` context.  When `currentPly`
 * or `moves` changes the board is updated via `cgRef.current.set(...)` without
 * triggering an extra render cycle.
 *
 * Integration API:
 * - `<ChessBoard onMovePlayed={fn} />` — pass `onMovePlayed` to enable
 *   interactive move entry. Omit for view-only mode.
 * - Reads: `currentPly`, `moves`, `moveDelayMs`, `soundEnabled` from context.
 *
 * Configuration API:
 * - `onMovePlayed(from, to)` — optional; when present, the board is interactive
 *   and calls this callback when the user drops a piece.
 *
 * Communication API:
 * - `onMovePlayed(from, to)` fires after a legal drop; caller handles promotion
 *   and fork resolution via `useMoveEntry`.
 */

import { useEffect, useRef } from "react";
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
} from "../state/selectors";

type ChessgroundApi = ReturnType<typeof Chessground>;

type BoardFile = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type BoardRank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type BoardKey = `${BoardFile}${BoardRank}`;
type KeyPair = [BoardKey, BoardKey];

type CgColor = "white" | "black";
type CgDests = Map<BoardKey, BoardKey[]>;

type ChessBoardProps = {
  /** When provided, the board is interactive and calls this on piece drops. */
  onMovePlayed?: (from: string, to: string) => void;
  /** When provided, draws a green arrow hint on the board for the given move. */
  hintMove?: { from: string; to: string } | null;
};

/** Narrow a string to a valid board key (e.g. "e4"). */
const isBoardKey = (value: string): value is BoardKey => /^[a-h][1-8]$/.test(value);

/**
 * Reconstruct a Chess position by replaying `ply` moves from the SAN list.
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
 * Derive the last-move key-pair from a Chess instance history.
 */
const computeLastMove = (game: Chess, ply: number): KeyPair | undefined => {
  if (ply <= 0) return undefined;
  const history = game.history({ verbose: true }) as Array<{ from: string; to: string }>;
  const lastEntry = history[ply - 1];
  if (!lastEntry) return undefined;
  const { from, to } = lastEntry;
  return isBoardKey(from) && isBoardKey(to) ? [from, to] : undefined;
};

/**
 * Compute legal destination map for chessground from a Chess instance.
 */
const computeDests = (game: Chess): CgDests => {
  const dests: CgDests = new Map();
  for (const move of game.moves({ verbose: true }) as Array<{ from: string; to: string }>) {
    if (!isBoardKey(move.from) || !isBoardKey(move.to)) continue;
    const existing = dests.get(move.from) ?? [];
    if (!existing.includes(move.to)) existing.push(move.to);
    dests.set(move.from, existing);
  }
  return dests;
};

/** React component that owns and renders the Chessground board. */
export const ChessBoard = ({ onMovePlayed, hintMove }: ChessBoardProps = {}): ReactElement => {
  const { state } = useAppContext();
  const currentPly: number = selectCurrentPly(state);
  const moves: string[] = selectMoves(state);
  const moveDelayMs: number = selectMoveDelayMs(state);
  const boardFlipped: boolean = selectBoardFlipped(state);
  const boardPreview: { fen: string; lastMove?: [string, string] | null } | null =
    selectBoardPreview(state);

  const boardElRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ChessgroundApi | null>(null);
  const moveDelayMsRef = useRef<number>(moveDelayMs);
  const boardFlippedRef = useRef<boolean>(boardFlipped);
  /** Keep a stable ref to `onMovePlayed` so the cg event closure stays fresh. */
  const onMovePlayedRef = useRef<((from: string, to: string) => void) | undefined>(onMovePlayed);

  moveDelayMsRef.current = moveDelayMs;
  boardFlippedRef.current = boardFlipped;
  onMovePlayedRef.current = onMovePlayed;

  // ── Initialize Chessground once on mount ──────────────────────────────
  useEffect((): (() => void) => {
    const el: HTMLDivElement | null = boardElRef.current;
    if (!el) return (): void => undefined;

    const api: ChessgroundApi = Chessground(el, {
      fen: "start",
      orientation: boardFlipped ? "black" : "white",
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
      const isInteractivePreview = Boolean(onMovePlayedRef.current);
      if (isInteractivePreview) {
        const previewGame = new Chess();
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
    const isInteractive = Boolean(onMovePlayedRef.current);

    let movableConfig: Record<string, unknown>;
    if (isInteractive) {
      const sideToMove = game.turn();
      const cgColor: CgColor = sideToMove === "w" ? "white" : "black";
      movableConfig = {
        color: cgColor,
        free: false,
        dests: computeDests(game),
      };
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

  // ── Sync board orientation when flip state changes ─────────────────────
  useEffect((): void => {
    cgRef.current?.set({ orientation: boardFlipped ? "black" : "white" });
  }, [boardFlipped]);

  // ── Draw / clear best-move hint arrow ─────────────────────────────────
  useEffect((): void => {
    const api: ChessgroundApi | null = cgRef.current;
    if (!api) return;
    if (hintMove && isBoardKey(hintMove.from) && isBoardKey(hintMove.to)) {
      api.setAutoShapes([{ orig: hintMove.from, dest: hintMove.to, brush: "green" }]);
    } else {
      api.setAutoShapes([]);
    }
  }, [hintMove]);

  return <div ref={boardElRef} className="board" />;
};
