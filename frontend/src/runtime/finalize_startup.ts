import { bindRuntimeEventWiring } from "./event_binding";
import { initializeResourceViewerTabs } from "./resource_viewer_init";
import { runRuntimeStartup } from "./startup_sequence";

type InitDeps = Parameters<typeof initializeResourceViewerTabs>[0];

type FinalizeStartupDeps = {
  resourcesCapabilities: InitDeps["resourcesCapabilities"];
  resourceViewerCapabilities: InitDeps["resourceViewerCapabilities"] & { bindEvents: () => void };
  state: InitDeps["state"];
  t: (key: string, fallback?: string) => string;
  setSaveStatus: (message?: string, kind?: string) => void;
  render: () => void;
  startApp: () => void;
  bindShellEvents: () => void;
  bindDomEvents: () => void;
  bindGameTabsEvents: () => void;
  bindIngressEvents: () => void;
  boardEl: Element | null;
  boardEditorPaneEl: Element | null;
  syncBoardEditorPaneMaxHeight: (boardEl: Element | null, boardEditorPaneEl: Element | null) => void;
};

export const finalizeRuntimeStartup = ({
  resourcesCapabilities,
  resourceViewerCapabilities,
  state,
  t,
  setSaveStatus,
  render,
  startApp,
  bindShellEvents,
  bindDomEvents,
  bindGameTabsEvents,
  bindIngressEvents,
  boardEl,
  boardEditorPaneEl,
  syncBoardEditorPaneMaxHeight,
}: FinalizeStartupDeps): void => {
  bindRuntimeEventWiring({
    bindShellEvents,
    bindDomEvents,
    bindGameTabsEvents,
    bindResourceViewerEvents: resourceViewerCapabilities.bindEvents,
    bindIngressEvents,
    boardEl,
    boardEditorPaneEl,
    syncBoardEditorPaneMaxHeight,
  });

  runRuntimeStartup({
    initializeResourceViewerTabs: (): Promise<void> =>
      initializeResourceViewerTabs({
        resourcesCapabilities,
        resourceViewerCapabilities,
        state,
        t,
      }),
    setSaveStatus,
    t,
    render,
    startApp,
  });
};
