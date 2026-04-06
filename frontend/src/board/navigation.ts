import { Chess } from "chess.js";
import type { MovePositionRecord } from "./move_position";
import type { ChessSoundType } from "./move_sound";
import type { ActiveSessionRef } from "../game_sessions/game_session_state";
import { log } from "../logger";

/**
 * Navigation module.
 *
 * Integration API:
 * - Primary exports from this module: `createBoardNavigationCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `sessionRef`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - Navigation state changes are reported via `onNavigationChange` rather than a
 *   generic `render` callback.  Animation tracking state is internal to this module.
 */

type MoveCommentSide = "before" | "after";

type BoardPreviewValue = { fen: string; lastMove?: [string, string] | null } | null;

type CreateBoardNavigationDeps = {
  sessionRef: ActiveSessionRef;
  /** Returns the current move animation delay in milliseconds. */
  getDelayMs: () => number;
  getMovePositionById: (
    moveId: string | null,
    options: { allowResolve: boolean },
  ) => MovePositionRecord | null;
  selectMoveById: (moveId: string) => boolean;
  findCommentIdAroundMove: (moveId: string, position: MoveCommentSide) => string | null;
  focusCommentById: (commentId: string) => boolean;
  playMoveSound: (soundType: ChessSoundType) => Promise<void>;
  /** Called after currentPly, selectedMoveId, or boardPreview change. */
  onNavigationChange: (currentPly: number, selectedMoveId: string | null, boardPreview: BoardPreviewValue) => void;
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
  sessionRef,
  getDelayMs,
  getMovePositionById,
  selectMoveById,
  findCommentIdAroundMove,
  focusCommentById,
  playMoveSound,
  onNavigationChange,
}: CreateBoardNavigationDeps): BoardNavigationCapabilities => {
  // Animation tracking state is internal — not part of session state.
  let animationRunId = 0;
  let isAnimating = false;

  const dispatchNavigation = (): void => {
    const g = sessionRef.current;
    const bp = g.boardPreview as BoardPreviewValue;
    onNavigationChange(g.currentPly, g.selectedMoveId, bp);
  };

  /**
   * Resolve sound type for the current stepped move.
   */
  const resolveMoveSoundType = (
    direction: number,
    movedSan: string,
    plyAfterStep: number,
  ): ChessSoundType => {
    const g = sessionRef.current;
    if (direction < 0) return "move";
    const san = String(movedSan || "");
    if (!san) return "move";
    if (san.includes("#")) return "checkmate";

    const isStalemateNow = (() => {
      try {
        const game = new Chess();
        for (let i = 0; i < plyAfterStep; i += 1) {
          game.move(g.moves[i]);
        }
        return game.isStalemate();
      } catch {
        return false;
      }
    })();
    if (isStalemateNow) return "stalemate";
    if (san.includes("+")) return "check";

    const verbose = g.verboseMoves[plyAfterStep - 1];
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
      globalThis.setTimeout(resolve, ms);
    });

  /** Jump or animate to a target ply. */
  const gotoPly = async (
    nextPly: number,
    { animate = true }: { animate?: boolean } = {},
  ): Promise<void> => {
    const g = sessionRef.current;
    const bounded = Math.max(0, Math.min(nextPly, g.moves.length));
    log.debug("navigation", `gotoPly: nextPly=${nextPly} g.moves.length=${g.moves.length} bounded=${bounded} g.currentPly=${g.currentPly} → ${bounded === g.currentPly ? "EARLY RETURN" : "advance"}`);
    if (bounded === g.currentPly) return;

    if (!animate) {
      animationRunId += 1;
      isAnimating = false;
      g.boardPreview = null;
      g.currentPly = bounded;
      dispatchNavigation();
      return;
    }

    const direction = bounded > g.currentPly ? 1 : -1;
    const runId = ++animationRunId;
    g.boardPreview = null;
    isAnimating = true;
    dispatchNavigation();

    try {
      while (sessionRef.current.currentPly !== bounded) {
        if (runId !== animationRunId) return;
        sessionRef.current.currentPly += direction;
        dispatchNavigation();
        const movedSan = direction > 0
          ? sessionRef.current.moves[sessionRef.current.currentPly - 1]
          : sessionRef.current.moves[sessionRef.current.currentPly];
        const soundType = resolveMoveSoundType(direction, movedSan, sessionRef.current.currentPly);
        await playMoveSound(soundType);
        if (getDelayMs() > 0) {
          await sleep(getDelayMs());
        }
      }
    } finally {
      if (runId === animationRunId) {
        isAnimating = false;
        dispatchNavigation();
      }
    }
  };

  /** Move one relative step, aware of selected variation context. */
  const gotoRelativeStep = async (direction: number): Promise<void> => {
    const step = direction < 0 ? -1 : 1;
    const selectedMoveId = sessionRef.current.selectedMoveId;
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
    await gotoPly(sessionRef.current.currentPly + step);
  };

  /** Handle arrow-key navigation for selected move context. */
  const handleSelectedMoveArrowHotkey = (event: KeyboardEvent): boolean => {
    const moveId = sessionRef.current.selectedMoveId;
    const movePosition = getMovePositionById(moveId, { allowResolve: false });
    if (!moveId || !movePosition) return false;
    const isLeft = event.key === "ArrowLeft";
    const isRight = event.key === "ArrowRight";
    const isDown = event.key === "ArrowDown";
    const isUp = event.key === "ArrowUp";
    if (!isLeft && !isRight && !isDown && !isUp) return false;
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

    if (event.shiftKey && (isDown || isUp) && movePosition.isVariationStart && movePosition.parentMoveId) {
      const parentPosition = getMovePositionById(movePosition.parentMoveId, { allowResolve: false });
      const siblings = Array.isArray(parentPosition?.variationFirstMoveIds)
        ? parentPosition.variationFirstMoveIds
        : [];
      const currentIndex = siblings.indexOf(moveId);
      if (currentIndex === -1) return false;
      const siblingMoveId = isDown
        ? (siblings[currentIndex + 1] ?? null)
        : (siblings[currentIndex - 1] ?? null);
      if (!siblingMoveId) return false;
      event.preventDefault();
      selectMoveById(siblingMoveId);
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

  // Expose isAnimating as a getter so the host can read it without it being session state.
  const getIsAnimating = (): boolean => isAnimating;

  return {
    gotoPly,
    gotoRelativeStep,
    handleSelectedMoveArrowHotkey,
    getIsAnimating,
  } as BoardNavigationCapabilities & { getIsAnimating: () => boolean };
};
