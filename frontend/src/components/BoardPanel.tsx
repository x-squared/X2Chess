import type { ReactElement } from "react";
import { useBoardRuntime } from "../hooks/useBoardRuntime";
import { useAppContext } from "../state/app_context";
import { selectCurrentPly, selectMoveCount, selectSelectedMoveId } from "../state/selectors";

/**
 * React board boundary (Slice 3 in progress).
 *
 * Keeps board runtime synchronized into React state while imperative DOM rendering
 * remains the active visual path.
 */
export const BoardPanel = (): ReactElement => {
  useBoardRuntime();
  const { state } = useAppContext();
  const currentPly: number = selectCurrentPly(state);
  const moveCount: number = selectMoveCount(state);
  const selectedMoveId: string | null = selectSelectedMoveId(state);

  return (
    <section
      data-react-slice="board-panel"
      data-current-ply={String(currentPly)}
      data-move-count={String(moveCount)}
      data-selected-move-id={selectedMoveId || ""}
      hidden
    />
  );
};
