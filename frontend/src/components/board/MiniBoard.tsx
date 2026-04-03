/**
 * MiniBoard — compact, view-only Chessground board for position previews.
 *
 * Intent:
 * - Display a chess position as a small board with the last move highlighted.
 * - No interactivity — strictly display-only.
 *
 * Integration API:
 * - `<MiniBoard fen={fen} lastMove={lastMove} size={200} />`
 *
 * Configuration API:
 * - `size` — board pixel dimension (default 200).
 *
 * Communication API:
 * - None. View-only.
 */

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Chessground } from "chessground";

type ChessgroundApi = ReturnType<typeof Chessground>;

type BoardFile = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type BoardRank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type BoardKey = `${BoardFile}${BoardRank}`;
type KeyPair = [BoardKey, BoardKey];

const isBoardKey = (value: string): value is BoardKey => /^[a-h][1-8]$/.test(value);

type MiniBoardProps = {
  fen: string;
  lastMove: [string, string] | null;
  /** Board pixel size (width and height). Default: 200. */
  size?: number;
  /** Which color appears at the bottom. Default: "white". */
  orientation?: "white" | "black";
};

/** Compact view-only board for hover position previews. */
export const MiniBoard = ({ fen, lastMove, size = 200, orientation = "white" }: MiniBoardProps): ReactElement => {
  const boardElRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ChessgroundApi | null>(null);

  // Initialize Chessground once on mount.
  useEffect((): (() => void) => {
    const el = boardElRef.current;
    if (!el) return (): void => undefined;

    const api = Chessground(el, {
      fen: "start",
      orientation,
      coordinates: false,
      viewOnly: true,
      movable: { color: undefined, free: false },
      highlight: { lastMove: true, check: false },
      animation: { enabled: false },
    });
    cgRef.current = api;

    return (): void => {
      api.destroy();
      cgRef.current = null;
    };
  }, []); // runs once; Chessground lifecycle tied to this component instance

  // Sync orientation when it changes.
  useEffect((): void => {
    cgRef.current?.set({ orientation });
  }, [orientation]);

  // Sync position when fen or lastMove changes.
  useEffect((): void => {
    const api = cgRef.current;
    if (!api) return;

    const lastMovePair: KeyPair | undefined =
      lastMove &&
      isBoardKey(lastMove[0]) &&
      isBoardKey(lastMove[1])
        ? [lastMove[0], lastMove[1]]
        : undefined;

    api.set({ fen, lastMove: lastMovePair });
  }, [fen, lastMove]);

  return (
    <div
      ref={boardElRef}
      className="board"
      style={{ width: size, height: size }}
    />
  );
};
