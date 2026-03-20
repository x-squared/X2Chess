import { Chess } from "chess.js";
import type { MovePositionRecord } from "./move_position";
import type { ChessSoundType } from "./move_sound";

/**
 * Navigation module.
 *
 * Integration API:
 * - Primary exports from this module: `createBoardNavigationCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type NavigationState = {
  selectedMoveId: string | null;
  currentPly: number;
  moves: string[];
  verboseMoves: Array<{ flags?: string }>;
  animationRunId: number;
  isAnimating: boolean;
  boardPreview: unknown | null;
  moveDelayMs: number;
};

type MoveCommentSide = "before" | "after";

type CreateBoardNavigationDeps = {
  state: NavigationState;
  getMovePositionById: (
    moveId: string | null,
    options: { allowResolve: boolean },
  ) => MovePositionRecord | null;
  selectMoveById: (moveId: string) => boolean;
  findCommentIdAroundMove: (moveId: string, position: MoveCommentSide) => string | null;
  focusCommentById: (commentId: string) => boolean;
  playMoveSound: (soundType: ChessSoundType) => Promise<void>;
  render: () => void;
};

type BoardNavigationCapabilities = {
  gotoPly: (nextPly: number, options?: { animate?: boolean }) => Promise<void>;
  gotoRelativeStep: (direction: number) => Promise<void>;
  handleSelectedMoveArrowHotkey: (event: KeyboardEvent) => boolean;
};

/**
 * Create board navigation and keyboard-navigation capabilities.
 *
 * @param {CreateBoardNavigationDeps} deps - Host dependencies.
 * @returns {BoardNavigationCapabilities} Navigation methods.
 */
export const createBoardNavigationCapabilities = ({
  state,
  getMovePositionById,
  selectMoveById,
  findCommentIdAroundMove,
  focusCommentById,
  playMoveSound,
  render,
}: CreateBoardNavigationDeps): BoardNavigationCapabilities => {
  /**
   * Resolve sound type for the current stepped move.
   */
  const resolveMoveSoundType = (
    direction: number,
    movedSan: string,
    plyAfterStep: number,
  ): ChessSoundType => {
    if (direction < 0) return "move";
    const san = String(movedSan || "");
    if (!san) return "move";
    if (san.includes("#")) return "checkmate";

    const isStalemateNow = (() => {
      try {
        const game = new Chess();
        for (let i = 0; i < plyAfterStep; i += 1) {
          game.move(state.moves[i]);
        }
        return game.isStalemate();
      } catch {
        return false;
      }
    })();
    if (isStalemateNow) return "stalemate";
    if (san.includes("+")) return "check";

    const verbose = state.verboseMoves[plyAfterStep - 1];
    const flags = String(verbose?.flags || "");
    if (flags.includes("k") || flags.includes("q") || /^O-O(?:-O)?/.test(san)) {
      return "castling";
    }
    if (flags.includes("c") || flags.includes("e") || san.includes("x")) {
      return "capture";
    }
    return "move";
  };

  /** Sleep helper used by animated move stepping. */
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  /** Jump or animate to a target ply. */
  const gotoPly = async (
    nextPly: number,
    { animate = true }: { animate?: boolean } = {},
  ): Promise<void> => {
    const bounded = Math.max(0, Math.min(nextPly, state.moves.length));
    if (bounded === state.currentPly) return;

    if (!animate) {
      state.animationRunId += 1;
      state.isAnimating = false;
      state.boardPreview = null;
      state.currentPly = bounded;
      render();
      return;
    }

    const direction = bounded > state.currentPly ? 1 : -1;
    const runId = ++state.animationRunId;
    state.boardPreview = null;
    state.isAnimating = true;
    render();

    try {
      while (state.currentPly !== bounded) {
        if (runId !== state.animationRunId) return;
        // Apply move immediately, then wait for the configured transition interval.
        state.currentPly += direction;
        render();
        const movedSan = direction > 0
          ? state.moves[state.currentPly - 1]
          : state.moves[state.currentPly];
        const soundType = resolveMoveSoundType(direction, movedSan, state.currentPly);
        await playMoveSound(soundType);
        if (state.moveDelayMs > 0) {
          await sleep(state.moveDelayMs);
        }
      }
    } finally {
      if (runId === state.animationRunId) {
        state.isAnimating = false;
        render();
      }
    }
  };

  /** Move one relative step, aware of selected variation context. */
  const gotoRelativeStep = async (direction: number): Promise<void> => {
    const step = direction < 0 ? -1 : 1;
    const selectedMoveId = state.selectedMoveId;
    const selectedPosition = getMovePositionById(selectedMoveId, { allowResolve: false });
    if (selectedPosition && !Number.isInteger(selectedPosition.mainlinePly)) {
      if (step < 0) {
        if (selectedPosition.previousMoveId) {
          selectMoveById(selectedPosition.previousMoveId);
          return;
        }
        if (selectedPosition.parentMoveId) {
          selectMoveById(selectedPosition.parentMoveId);
          return;
        }
      } else if (selectedPosition.nextMoveId) {
        selectMoveById(selectedPosition.nextMoveId);
        return;
      }
    }
    await gotoPly(state.currentPly + step);
  };

  /** Handle arrow-key navigation for selected move context. */
  const handleSelectedMoveArrowHotkey = (event: KeyboardEvent): boolean => {
    const moveId = state.selectedMoveId;
    const movePosition = getMovePositionById(moveId, { allowResolve: false });
    if (!moveId || !movePosition) return false;
    const isLeft = event.key === "ArrowLeft";
    const isRight = event.key === "ArrowRight";
    const isDown = event.key === "ArrowDown";
    if (!isLeft && !isRight && !isDown) return false;
    if (event.metaKey || event.ctrlKey || event.altKey) return false;

    if (event.shiftKey && (isLeft || isRight)) {
      event.preventDefault();
      const position: MoveCommentSide = isLeft ? "before" : "after";
      const commentId = findCommentIdAroundMove(moveId, position);
      if (commentId) {
        focusCommentById(commentId);
      }
      return true;
    }

    if (!event.shiftKey && isDown) {
      const firstVariationMoveId = Array.isArray(movePosition.variationFirstMoveIds)
        ? movePosition.variationFirstMoveIds[0]
        : null;
      if (!firstVariationMoveId) return false;
      event.preventDefault();
      selectMoveById(firstVariationMoveId);
      return true;
    }

    if (!event.shiftKey && isLeft && movePosition.isVariationStart && movePosition.parentMoveId) {
      event.preventDefault();
      selectMoveById(movePosition.parentMoveId);
      return true;
    }

    if (!isLeft && !isRight) return false;
    event.preventDefault();
    void gotoRelativeStep(isLeft ? -1 : 1);
    return true;
  };

  return {
    gotoPly,
    gotoRelativeStep,
    handleSelectedMoveArrowHotkey,
  };
};
