import type { ReactElement } from "react";
import { useResourceViewer } from "../hooks/useResourceViewer";

/**
 * React resource viewer migration shell.
 */
export const ResourceViewer = (): ReactElement => {
  useResourceViewer();
  return <></>;
};
