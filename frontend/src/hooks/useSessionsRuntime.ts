import { useEffect } from "react";
import { useAppContext } from "../state/app_context";

/**
 * Sessions hook placeholder for React migration.
 */
export const useSessionsRuntime = (): void => {
  const { state } = useAppContext();

  useEffect((): void => {
    void state.statusMessage;
  }, [state.statusMessage]);
};
