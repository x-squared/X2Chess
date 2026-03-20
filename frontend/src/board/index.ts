/**
 * Index module.
 *
 * Integration API:
 * - Primary exports from this module: `createBoardCapabilities`.
 *
 * Configuration API:
 * - `createBoardCapabilities(state)` expects a board state object containing
 *   `currentPly` and `moves`.
 *
 * Communication API:
 * - Read-only accessors over shared board state; no mutation or side effects.
 */

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
