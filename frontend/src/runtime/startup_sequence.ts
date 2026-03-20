type RunRuntimeStartupDeps = {
  initializeResourceViewerTabs: () => Promise<void>;
  setSaveStatus: (message?: string, kind?: string) => void;
  t: (key: string, fallback?: string) => string;
  render: () => void;
  startApp: () => void;
};

export const runRuntimeStartup = ({
  initializeResourceViewerTabs,
  setSaveStatus,
  t,
  render,
  startApp,
}: RunRuntimeStartupDeps): void => {
  void (async (): Promise<void> => {
    try {
      await initializeResourceViewerTabs();
    } catch (error: unknown) {
      const message: string = error instanceof Error ? error.message : String(error);
      setSaveStatus(message || t("resources.error", "Unable to load resource games."), "error");
    } finally {
      render();
    }
  })();

  startApp();
};
