import { useEffect } from "react";
import { subscribeRuntimeBoardSnapshot } from "./runtime_bridge";
import { useAppContext } from "../state/app_context";

/**
 * Board runtime hook.
 *
 * Subscribes to typed board/runtime snapshots emitted by the runtime startup
 * and mirrors them into the React reducer state.
 */
export const useBoardRuntime = (): void => {
  const { dispatch } = useAppContext();

  useEffect((): (() => void) => {
    return subscribeRuntimeBoardSnapshot((snapshot): void => {
      dispatch({ type: "sync_board_snapshot", snapshot });
    });
  }, [dispatch]);
};
