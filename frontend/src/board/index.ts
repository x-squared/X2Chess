/**
 * Board Component-Contract
 *
 * Integration API:
 * - `createBoardCapabilities(state)` exposes board/navigation capabilities from shared state.
 *
 * Configuration API:
 * - Consumers provide current state and can opt into future board options through this factory.
 *
 * Communication API:
 * - Returned methods are imperative commands used by toolbar and keyboard handlers.
 */

export const createBoardCapabilities = (state) => ({
  getCurrentPly: () => state.currentPly,
  getMoveCount: () => state.moves.length,
});
