import { createAppWiringBootstrap } from "./app_wiring_bootstrap";
import { createPostWiringBootstrap } from "./post_wiring_bootstrap";
import { finalizeRuntimeStartup } from "./finalize_startup";

type AppWiringDeps = Parameters<typeof createAppWiringBootstrap>[0];
type PostWiringDeps = Parameters<typeof createPostWiringBootstrap>[0];
type FinalizeDeps = Parameters<typeof finalizeRuntimeStartup>[0];

type AppStartupFinalizeBootstrapDeps = {
  appWiringDeps: AppWiringDeps;
  postWiringDeps: PostWiringDeps;
  appShellCapabilities: {
    bindShellEvents: () => void;
  };
  finalizeDeps: Omit<
    FinalizeDeps,
    "startApp" | "bindShellEvents" | "bindDomEvents" | "bindGameTabsEvents" | "bindIngressEvents"
  >;
};

type AppStartupFinalizeBootstrapResult = {
  appWiringCapabilities: ReturnType<typeof createAppWiringBootstrap>;
  gameTabsUi: ReturnType<typeof createPostWiringBootstrap>["gameTabsUi"];
};

export const createAppStartupFinalizeBootstrap = ({
  appWiringDeps,
  postWiringDeps,
  appShellCapabilities,
  finalizeDeps,
}: AppStartupFinalizeBootstrapDeps): AppStartupFinalizeBootstrapResult => {
  const appWiringCapabilities = createAppWiringBootstrap(appWiringDeps);

  const {
    gameTabsUi,
    ingressHandlers,
  } = createPostWiringBootstrap(postWiringDeps);

  finalizeRuntimeStartup({
    ...finalizeDeps,
    startApp: appWiringCapabilities.startApp,
    bindShellEvents: appShellCapabilities.bindShellEvents,
    bindDomEvents: appWiringCapabilities.bindDomEvents,
    bindGameTabsEvents: gameTabsUi.bindEvents,
    bindIngressEvents: ingressHandlers.bindEvents,
  });

  return {
    appWiringCapabilities,
    gameTabsUi,
  };
};
