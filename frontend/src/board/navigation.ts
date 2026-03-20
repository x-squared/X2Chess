import { Chess } from "chess.js";

/**
 * Board navigation component.
 *
 * Integration API:
 * - `createBoardNavigationCapabilities(deps)` returns navigation/hotkey methods.
 *
 * Configuration API:
 * - Uses shared state and caller-provided callbacks for rendering and move lookup.
 *
 * Communication API:
 * - Mutates navigation-related state and delegates board sound/render/comment focus
 *   through explicit callbacks.
 */

/**
 * Create board navigation and keyboard-navigation capabilities.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {Function} deps.getMovePositionById - Callback `(moveId, options) => position|null`.
 * @param {Function} deps.selectMoveById - Callback `(moveId) => boolean`.
 * @param {Function} deps.findCommentIdAroundMove - Callback `(moveId, position) => string|null`.
 * @param {Function} deps.focusCommentById - Callback `(commentId) => boolean`.
 * @param {Function} deps.playMoveSound - Callback `(soundType) => Promise<void>`.
 * @param {Function} deps.render - Callback to refresh UI after navigation changes.
 * @returns {{gotoPly: Function, gotoRelativeStep: Function, handleSelectedMoveArrowHotkey: Function}} Navigation methods.
 */
export const createBoardNavigationCapabilities = ({
  state,
  getMovePositionById,
  selectMoveById,
  findCommentIdAroundMove,
  focusCommentById,
  playMoveSound,
  render,
}) => {
  /**
   * Resolve sound type for the current stepped move.
   *
   * @param {number} direction - Step direction (+1 forward, -1 backward).
   * @param {string} movedSan - SAN of moved step.
   * @param {number} plyAfterStep - Current ply after applying step.
   * @returns {string} Sound type key.
   */
  const resolveMoveSoundType = (direction, movedSan, plyAfterStep) => {
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

  /**
   * Sleep helper used by animated move stepping.
   *
   * @param {number} ms - Delay in milliseconds.
   * @returns {Promise<void>} Resolves after requested delay.
   */
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  /**
   * Jump or animate to a target ply.
   *
   * @param {number} nextPly - Target ply index.
   * @param {{animate?: boolean}} options - Navigation options.
   */
  const gotoPly = async (nextPly, { animate = true } = {}) => {
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

  /**
   * Move one relative step, aware of selected variation context.
   *
   * @param {number} direction - Negative for previous, positive for next.
   */
  const gotoRelativeStep = async (direction) => {
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

  /**
   * Handle arrow-key navigation for selected move context.
   *
   * @param {KeyboardEvent} event - Keyboard event to evaluate and possibly consume.
   * @returns {boolean} True when event was handled.
   */
  const handleSelectedMoveArrowHotkey = (event) => {
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
      const position = isLeft ? "before" : "after";
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
