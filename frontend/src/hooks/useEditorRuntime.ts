import { useEffect } from "react";
import { useAppContext } from "../state/app_context";

/**
 * Editor runtime hook placeholder for React migration.
 */
export const useEditorRuntime = (): void => {
  const { state } = useAppContext();

  useEffect((): void => {
    void state.pgnLayoutMode;
  }, [state.pgnLayoutMode]);
};
