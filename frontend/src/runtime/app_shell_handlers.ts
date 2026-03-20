import {
  handleActiveSaveModeChange,
  handleBoardColumnWidthChange,
  handleDeveloperDockOpenChange,
  handleDeveloperToolsChange,
  handleLocaleChange,
  handleResourceViewerHeightChange,
  handleSwitchDeveloperDockTab,
} from "./shell_callbacks";

type ShellHandlerState = Parameters<typeof handleLocaleChange>[1];
type ResolveLocaleFn = Parameters<typeof handleLocaleChange>[2];
type RuntimeConfigLike = Parameters<typeof handleDeveloperToolsChange>[3];
type SessionPersistenceLike = Parameters<typeof handleActiveSaveModeChange>[1];

type AppShellHandlerDeps<TState extends ShellHandlerState> = {
  state: TState;
  resolveLocale: ResolveLocaleFn;
  modeStorageKey: string;
  boardColumnWidthStorageKey: string;
  resourceViewerHeightStorageKey: string;
  runtimeConfigCapabilities: RuntimeConfigLike;
  sessionPersistenceService: SessionPersistenceLike;
  render: () => void;
  setDevDockOpen: (open: boolean) => void;
};

export const createAppShellHandlers = <TState extends ShellHandlerState>({
  state,
  resolveLocale,
  modeStorageKey,
  boardColumnWidthStorageKey,
  resourceViewerHeightStorageKey,
  runtimeConfigCapabilities,
  sessionPersistenceService,
  render,
  setDevDockOpen,
}: AppShellHandlerDeps<TState>) => ({
  onChangeLocale: (localeCode: string): void => {
    handleLocaleChange(localeCode, state, resolveLocale);
  },
  onChangeDeveloperTools: (enabled: boolean): void => {
    handleDeveloperToolsChange(enabled, modeStorageKey, state, runtimeConfigCapabilities, render);
  },
  onChangeDeveloperDockOpen: (): void => {
    handleDeveloperDockOpenChange(state, runtimeConfigCapabilities, render);
  },
  onSwitchDeveloperDockTab: (tabId: "ast" | "dom" | "pgn"): void => {
    handleSwitchDeveloperDockTab(tabId, state, setDevDockOpen);
  },
  onChangeActiveSaveMode: (mode: "auto" | "manual"): void => {
    handleActiveSaveModeChange(mode, sessionPersistenceService, render);
  },
  onChangeBoardColumnWidth: (widthPx: number): void => {
    handleBoardColumnWidthChange(widthPx, boardColumnWidthStorageKey, render);
  },
  onChangeResourceViewerHeight: (heightPx: number): void => {
    handleResourceViewerHeightChange(heightPx, resourceViewerHeightStorageKey);
  },
});
