import type {
  MovePositionIndex,
  MovePositionRecord,
  MovePositionResolved,
  PgnModelForMoves,
} from "./move_position";

/**
 * Move Lookup module.
 *
 * Integration API:
 * - Primary exports from this module: `createMoveLookupCapabilities`.
 *
 * Configuration API:
 * - Injects callbacks `buildMovePositionByIdFn` and `resolveMovePositionByIdFn`.
 * - Reads and updates `state.movePositionById` cache.
 *
 * Communication API:
 * - Returns `getMovePositionById(moveId, options)` for board/editor callers.
 */

type MoveLookupState = {
  pgnModel: PgnModelForMoves;
  movePositionById: MovePositionIndex;
};

type MoveLookupDeps = {
  state: MoveLookupState;
  buildMovePositionByIdFn: (pgnModel: PgnModelForMoves) => MovePositionIndex;
  resolveMovePositionByIdFn: (
    pgnModel: PgnModelForMoves,
    moveId: string,
  ) => MovePositionResolved | null;
};

type MoveLookupCapabilities = {
  getMovePositionById: (
    moveId: string | null,
    options?: { allowResolve?: boolean },
  ) => MovePositionRecord | MovePositionResolved | null;
};

/**
 * Create move lookup capability for resolving move ids to board positions.
 */
export const createMoveLookupCapabilities = (
  deps: MoveLookupDeps,
): MoveLookupCapabilities => {
  const state: MoveLookupState = deps.state;
  const buildMovePositionByIdFn: (pgnModel: PgnModelForMoves) => MovePositionIndex =
    deps.buildMovePositionByIdFn;
  const resolveMovePositionByIdFn: (
    pgnModel: PgnModelForMoves,
    moveId: string,
  ) => MovePositionResolved | null = deps.resolveMovePositionByIdFn;
  /**
   * Resolve move position metadata by move id with cached index + on-demand fallback.
   */
  const getMovePositionById = (
    moveId: string | null,
    { allowResolve = false }: { allowResolve?: boolean } = {},
  ): MovePositionRecord | MovePositionResolved | null => {
    if (!moveId) return null;

    let target: MovePositionRecord | MovePositionResolved | undefined = state.movePositionById?.[moveId];
    if (!target) {
      state.movePositionById = buildMovePositionByIdFn(state.pgnModel);
      target = state.movePositionById?.[moveId];
    }

    if (!target && allowResolve) {
      const resolved = resolveMovePositionByIdFn(state.pgnModel, moveId);
      if (resolved) {
        const normalizedResolved: MovePositionRecord = {
          ...resolved,
          variationFirstMoveIds: [],
          previousMoveId: null,
          nextMoveId: null,
        };
        state.movePositionById = {
          ...(state.movePositionById || {}),
          [moveId]: normalizedResolved,
        };
        target = normalizedResolved;
      }
    }
    return target || null;
  };

  return {
    getMovePositionById,
  };
};
