import { useEffect } from "react";
import { subscribeRuntimeShellSnapshot } from "./runtime_bridge";
import { useAppContext } from "../state/app_context";

/**
 * Shell runtime hook.
 *
 * Subscribes to typed shell snapshots from runtime startup and mirrors them
 * into React reducer state.
 */
export const useShellRuntime = (): void => {
  const { dispatch } = useAppContext();

  useEffect((): (() => void) => {
    return subscribeRuntimeShellSnapshot((snapshot): void => {
      dispatch({ type: "sync_shell_snapshot", snapshot });
    });
  }, [dispatch]);
};
