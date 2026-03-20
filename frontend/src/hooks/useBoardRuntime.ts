import { useEffect } from "react";
import { useAppContext } from "../state/app_context";

/**
 * Board runtime hook placeholder for React migration.
 */
export const useBoardRuntime = (): void => {
  const { state } = useAppContext();

  useEffect((): void => {
    void state.activeSourceKind;
  }, [state.activeSourceKind]);
};
