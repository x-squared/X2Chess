import type { ReactElement } from "react";
import { useSessionsRuntime } from "../hooks/useSessionsRuntime";

/**
 * React game sessions panel migration shell.
 */
export const GameSessionsPanel = (): ReactElement => {
  useSessionsRuntime();
  return <></>;
};
