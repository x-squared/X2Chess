import { useEffect } from "react";
import { subscribeRuntimeSessionsSnapshot } from "./runtime_bridge";
import { useAppContext } from "../state/app_context";

/**
 * Sessions runtime hook.
 *
 * Subscribes to typed sessions snapshots emitted by runtime startup and
 * mirrors them into React reducer state.
 */
export const useSessionsRuntime = (): void => {
  const { dispatch } = useAppContext();

  useEffect((): (() => void) => {
    return subscribeRuntimeSessionsSnapshot((snapshot): void => {
      dispatch({ type: "sync_sessions_snapshot", snapshot });
    });
  }, [dispatch]);
};
