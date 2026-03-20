type ResolveLocaleFn = (localeCode: string) => string;

type RuntimeConfigCapabilitiesLike = {
  applyRuntimeConfig: (config?: Record<string, unknown>) => void;
};

type SessionPersistenceLike = {
  setActiveSessionSaveMode: (mode: "auto" | "manual") => void;
};

type ShellStateLike = {
  locale: string;
  isDevDockOpen: boolean;
  activeDevTab: string;
  appConfig: Record<string, unknown>;
};

export const handleLocaleChange = (
  localeCode: string,
  state: ShellStateLike,
  resolveLocale: ResolveLocaleFn,
): void => {
  const nextLocale = resolveLocale(localeCode);
  if (nextLocale === state.locale) return;
  window.localStorage?.setItem("x2chess.locale", nextLocale);
  window.location.reload();
};

export const handleDeveloperToolsChange = (
  enabled: boolean,
  modeStorageKey: string,
  state: ShellStateLike,
  runtimeConfigCapabilities: RuntimeConfigCapabilitiesLike,
  render: () => void,
): void => {
  window.localStorage?.setItem(modeStorageKey, enabled ? "true" : "false");
  if (!enabled) state.isDevDockOpen = false;
  runtimeConfigCapabilities.applyRuntimeConfig(state.appConfig || {});
  render();
};

export const handleDeveloperDockOpenChange = (
  state: ShellStateLike,
  runtimeConfigCapabilities: RuntimeConfigCapabilitiesLike,
  render: () => void,
): void => {
  runtimeConfigCapabilities.applyRuntimeConfig(state.appConfig || {});
  render();
};

export const handleSwitchDeveloperDockTab = (
  tabId: "ast" | "dom" | "pgn",
  state: ShellStateLike,
  setDevDockOpen: (isOpen: boolean) => void,
): void => {
  const normalized = tabId === "dom" || tabId === "pgn" ? tabId : "ast";
  state.activeDevTab = normalized;
  setDevDockOpen(true);
};

export const handleActiveSaveModeChange = (
  mode: "auto" | "manual",
  sessionPersistenceService: SessionPersistenceLike,
  render: () => void,
): void => {
  sessionPersistenceService.setActiveSessionSaveMode(mode);
  render();
};

export const handleBoardColumnWidthChange = (
  widthPx: number,
  boardColumnWidthStorageKey: string,
  render: () => void,
): void => {
  window.localStorage?.setItem(boardColumnWidthStorageKey, String(widthPx));
  render();
};

export const handleResourceViewerHeightChange = (
  heightPx: number,
  resourceViewerHeightStorageKey: string,
): void => {
  window.localStorage?.setItem(resourceViewerHeightStorageKey, String(heightPx));
};
