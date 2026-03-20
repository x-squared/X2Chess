import type { ReactElement } from "react";
import { useBoardRuntime } from "../hooks/useBoardRuntime";

/**
 * React board panel migration shell.
 */
export const BoardPanel = (): ReactElement => {
  useBoardRuntime();
  return <></>;
};
