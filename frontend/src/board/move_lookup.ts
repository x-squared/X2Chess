import type {
  MovePositionIndex,
  MovePositionRecord,
  MovePositionResolved,
} from "./move_position";
import type { PgnModel } from "../../../parts/pgnparser/src/pgn_model";
import type { ActiveSessionRef } from "../game_sessions/game_session_state";

/**
 * Move Lookup module.
 *
 * Integration API:
 * - Primary exports from this module: `createMoveLookupCapabilities`.
 *
 * Configuration API:
 * - Injects callbacks `buildMovePositionByIdFn` and `resolveMovePositionByIdFn`.
 * - Reads and updates `sessionRef.current.movePositionById` cache.
 *
 * Communication API:
 * - Returns `getMovePositionById(moveId, options)` for board/editor callers.
 */

type MoveLookupDeps = {
  sessionRef: ActiveSessionRef;
  buildMovePositionByIdFn: (pgnModel: PgnModel) => MovePositionIndex;
  resolveMovePositionByIdFn: (
    pgnModel: PgnModel,
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
  const { sessionRef, buildMovePositionByIdFn, resolveMovePositionByIdFn } = deps;

  /**
   * Resolve move position metadata by move id with cached index + on-demand fallback.
   */
  const getMovePositionById = (
    moveId: string | null,
    { allowResolve = false }: { allowResolve?: boolean } = {},
  ): MovePositionRecord | MovePositionResolved | null => {
    if (!moveId) return null;
    const g = sessionRef.current;
    const pgnModel = g.pgnModel as PgnModel;

    let target: MovePositionRecord | MovePositionResolved | undefined = g.movePositionById?.[moveId];
    if (!target) {
      g.movePositionById = buildMovePositionByIdFn(pgnModel);
      target = g.movePositionById?.[moveId];
    }

    if (!target && allowResolve) {
      const resolved = resolveMovePositionByIdFn(pgnModel, moveId);
      if (resolved) {
        const normalizedResolved: MovePositionRecord = {
          ...resolved,
          variationFirstMoveIds: [],
          previousMoveId: null,
          nextMoveId: null,
        };
        g.movePositionById = {
          ...g.movePositionById,
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
