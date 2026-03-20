import { createAppShellHandlers } from "./app_shell_handlers";
import { createAppShellBootstrap } from "./app_shell_bootstrap";

type AppShellHandlersDeps = Omit<Parameters<typeof createAppShellHandlers>[0], "setDevDockOpen">;
type AppShellBootstrapDeps = Omit<Parameters<typeof createAppShellBootstrap>[0], "appShellHandlers">;

type AppShellRuntimeBootstrapDeps = {
  handlersDeps: AppShellHandlersDeps;
  bootstrapDeps: AppShellBootstrapDeps;
};

type AppShellRuntimeBootstrapResult = ReturnType<typeof createAppShellBootstrap>;

export const createAppShellRuntimeBootstrap = ({
  handlersDeps,
  bootstrapDeps,
}: AppShellRuntimeBootstrapDeps): AppShellRuntimeBootstrapResult => {
  let setDevDockOpenRef: (open: boolean) => void = (): void => {};

  const appShellHandlers = createAppShellHandlers({
    ...handlersDeps,
    setDevDockOpen: (open: boolean): void => {
      setDevDockOpenRef(open);
    },
  });

  const appShellCapabilities = createAppShellBootstrap({
    ...bootstrapDeps,
    appShellHandlers,
  });

  setDevDockOpenRef = appShellCapabilities.setDevDockOpen;
  return appShellCapabilities;
};
