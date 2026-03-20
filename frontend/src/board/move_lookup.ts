/**
 * Board move-lookup component.
 *
 * Integration API:
 * - `createMoveLookupCapabilities({ state, buildMovePositionByIdFn, resolveMovePositionByIdFn })`
 *
 * Configuration API:
 * - Uses caller-provided index builder/resolver functions.
 *
 * Communication API:
 * - Reads and updates `state.movePositionById` cache.
 */

/**
 * Create move lookup capability for resolving move ids to board positions.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {Function} deps.buildMovePositionByIdFn - Callback `(pgnModel) => Record<string, object>`.
 * @param {Function} deps.resolveMovePositionByIdFn - Callback `(pgnModel, moveId) => object|null`.
 * @returns {{getMovePositionById: Function}} Move lookup methods.
 */
export const createMoveLookupCapabilities = ({
  state,
  buildMovePositionByIdFn,
  resolveMovePositionByIdFn,
}) => {
  /**
   * Resolve move position metadata by move id with cached index + on-demand fallback.
   *
   * @param {string} moveId - Move id to resolve.
   * @param {{allowResolve?: boolean}} options - Lookup options.
   * @returns {object|null} Move position metadata or null.
   */
  const getMovePositionById = (moveId, { allowResolve = false } = {}) => {
    if (!moveId) return null;
    let target = state.movePositionById?.[moveId];
    if (!target) {
      state.movePositionById = buildMovePositionByIdFn(state.pgnModel);
      target = state.movePositionById?.[moveId];
    }
    if (!target && allowResolve) {
      const resolved = resolveMovePositionByIdFn(state.pgnModel, moveId);
      if (resolved) {
        state.movePositionById = {
          ...(state.movePositionById || {}),
          [moveId]: resolved,
        };
        target = resolved;
      }
    }
    return target || null;
  };

  return {
    getMovePositionById,
  };
};
