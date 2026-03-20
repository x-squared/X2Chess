import { useEffect } from "react";
import { useAppContext } from "../state/app_context";

/**
 * Resource viewer hook placeholder for React migration.
 */
export const useResourceViewer = (): void => {
  const { state } = useAppContext();

  useEffect((): void => {
    void state.activeSourceKind;
  }, [state.activeSourceKind]);
};
