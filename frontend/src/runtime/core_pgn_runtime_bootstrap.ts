import { initializeCorePgnCapabilities } from "./core_pgn_bootstrap";

type CorePgnBootstrapDeps = Parameters<typeof initializeCorePgnCapabilities>[0];

type CorePgnRuntimeBootstrapResult = ReturnType<typeof initializeCorePgnCapabilities>;

export const createCorePgnRuntimeBootstrap = (
  deps: CorePgnBootstrapDeps,
): CorePgnRuntimeBootstrapResult => {
  return initializeCorePgnCapabilities(deps);
};
