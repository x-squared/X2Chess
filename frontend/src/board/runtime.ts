import { Chess } from "chess.js";
import { Chessground } from "chessground";

type ChessgroundApi = ReturnType<typeof Chessground>;

/**
 * Board runtime component.
 *
 * Integration API:
 * - `createBoardRuntimeCapabilities({ state, boardEl })`
 *
 * Configuration API:
 * - Board animation duration is read from `state.moveDelayMs`.
 *
 * Communication API:
 * - Maintains an internal Chessground instance and renders board state from shared app state.
 */

/**
 * Create board runtime capabilities for board init/render/game reconstruction.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {HTMLElement|null} deps.boardEl - Board container element.
 * @returns {{buildGameAtPly: Function, ensureBoard: Function, renderBoard: Function}} Board runtime methods.
 */
export const createBoardRuntimeCapabilities = ({ state, boardEl }) => {
  let board: ChessgroundApi | null = null;

  /**
   * Ensure Chessground board is created once.
   *
   * @returns {Promise<boolean>} True when board is ready.
   */
  const ensureBoard = async () => {
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

  /**
   * Build a Chess instance at a target ply from current mainline moves.
   *
   * @param {number} ply - Target ply.
   * @returns {Chess} Reconstructed chess position.
   */
  const buildGameAtPly = (ply) => {
    const game = new Chess();
    for (let i = 0; i < ply; i += 1) game.move(state.moves[i]);
    return game;
  };

  /**
   * Render board position from game or board preview state.
   *
   * @param {Chess} game - Reconstructed game object for current ply.
   */
  const renderBoard = (game) => {
    if (!board) return;
    if (state.boardPreview) {
      board.set({
        fen: state.boardPreview.fen,
        lastMove: state.boardPreview.lastMove || undefined,
        animation: { enabled: true, duration: state.moveDelayMs },
      });
      return;
    }
    const lastMove = state.currentPly > 0
      ? (() => {
        const vm = state.verboseMoves[state.currentPly - 1];
        return vm?.from && vm?.to ? [vm.from, vm.to] : undefined;
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
