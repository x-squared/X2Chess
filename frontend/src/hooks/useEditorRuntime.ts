import { useEffect } from "react";
import { subscribeRuntimeEditorSnapshot } from "./runtime_bridge";
import { useAppContext } from "../state/app_context";

/**
 * Editor runtime hook.
 *
 * Subscribes to typed editor snapshots emitted by the runtime startup and
 * mirrors them into the React reducer state.
 */
export const useEditorRuntime = (): void => {
  const { dispatch } = useAppContext();

  useEffect((): (() => void) => {
    return subscribeRuntimeEditorSnapshot((snapshot): void => {
      dispatch({ type: "sync_editor_snapshot", snapshot });
    });
  }, [dispatch]);
};
