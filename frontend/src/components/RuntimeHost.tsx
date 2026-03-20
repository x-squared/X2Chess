import type { ReactElement } from "react";
import { useRuntimeStartup } from "../hooks/useRuntimeStartup";

/**
 * Transitional host where runtime mounts.
 */
export const RuntimeHost = (): ReactElement => {
  useRuntimeStartup();
  return <div id="app" data-react-owned-runtime-host="true" />;
};
