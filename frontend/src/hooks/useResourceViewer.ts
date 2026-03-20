import { useEffect } from "react";
import { subscribeRuntimeResourceViewerSnapshot } from "./runtime_bridge";
import { useAppContext } from "../state/app_context";

/**
 * Resource viewer runtime hook.
 *
 * Subscribes to typed resource viewer snapshots emitted by runtime startup and
 * mirrors them into React reducer state.
 */
export const useResourceViewer = (): void => {
  const { dispatch } = useAppContext();

  useEffect((): (() => void) => {
    return subscribeRuntimeResourceViewerSnapshot((snapshot): void => {
      dispatch({ type: "sync_resource_viewer_snapshot", snapshot });
    });
  }, [dispatch]);
};
