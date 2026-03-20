import { Chess } from "chess.js";
import { Chessground } from "chessground";
type ChessgroundApi = ReturnType<typeof Chessground>;
type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type Key = `${File}${Rank}`;
type KeyPair = [Key, Key];

type VerboseMoveLike = { from?: string; to?: string };

const isBoardKey = (value: string): value is Key => /^[a-h][1-8]$/.test(value);
export type BoardPreviewLike = { fen: string; lastMove?: KeyPair | null };

type BoardRuntimeState = {
  moveDelayMs: number;
  moves: string[];
  verboseMoves: VerboseMoveLike[];
  currentPly: number;
  boardPreview: BoardPreviewLike | null;
};

type CreateBoardRuntimeDeps = {
  state: BoardRuntimeState;
  boardEl: HTMLElement | null;
};

type BoardRuntimeCapabilities = {
  buildGameAtPly: (ply: number) => Chess;
  ensureBoard: () => Promise<boolean>;
  renderBoard: (game: Chess) => void;
};

/**
 * Runtime module.
 *
 * Integration API:
 * - Primary exports from this module: `createBoardRuntimeCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

/**
 * Create board runtime capabilities for board init/render/game reconstruction.
 */
export const createBoardRuntimeCapabilities = (
  deps: CreateBoardRuntimeDeps,
): BoardRuntimeCapabilities => {
  const state: BoardRuntimeState = deps.state;
  const boardEl: HTMLElement | null = deps.boardEl;
  let board: ChessgroundApi | null = null;

  /** Ensure Chessground board is created once. */
  const ensureBoard: () => Promise<boolean> = async (): Promise<boolean> => {
    if (!boardEl) return false;
    if (board) return true;
    board = Chessground(boardEl, {
      fen: "start",
      orientation: "white",
      coordinates: true,
      viewOnly: true,
      movable: { color: undefined },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: state.moveDelayMs },
    });
    return true;
  };

  /** Build a Chess instance at a target ply from current mainline moves. */
  const buildGameAtPly: (ply: number) => Chess = (ply: number): Chess => {
    const game: Chess = new Chess();
    for (let i: number = 0; i < ply; i += 1) game.move(state.moves[i]);
    return game;
  };

  /** Render board position from game or board preview state. */
  const renderBoard: (game: Chess) => void = (game: Chess): void => {
    if (!board) return;
    if (state.boardPreview) {
      board.set({
        fen: state.boardPreview.fen,
        lastMove: state.boardPreview.lastMove || undefined,
        animation: { enabled: true, duration: state.moveDelayMs },
      });
      return;
    }
    const lastMove: KeyPair | undefined = state.currentPly > 0
      ? ((): KeyPair | undefined => {
        const vm: VerboseMoveLike | undefined = state.verboseMoves[state.currentPly - 1];
        return vm?.from && vm?.to && isBoardKey(vm.from) && isBoardKey(vm.to)
          ? [vm.from, vm.to]
          : undefined;
      })()
      : undefined;
    board.set({
      fen: game.fen(),
      lastMove,
      animation: { enabled: true, duration: state.moveDelayMs },
    });
  };

  return {
    buildGameAtPly,
    ensureBoard,
    renderBoard,
  };
};
