import { shellPrefsStore } from "./shell_prefs_store";

export const MODE_STORAGE_KEY = "x2chess.developerTools";
export const RESOURCE_VIEWER_HEIGHT_STORAGE_KEY = "x2chess.resourceViewerHeightPx";
export const BOARD_COLUMN_WIDTH_STORAGE_KEY = "x2chess.boardColumnWidthPx";

export type AppMode = "DEV" | "PROD";

type ResolveLocaleFn = (locale: string) => string;

type BootstrapUiPrefs = {
  isDeveloperToolsEnabled: boolean;
  resourceViewerHeightPx: number | null;
  boardColumnWidthPx: number | null;
};

export const resolveBuildAppMode = (defaultAppMode: AppMode): AppMode => {
  const raw = typeof __X2CHESS_MODE__ === "undefined" ? defaultAppMode : String(__X2CHESS_MODE__);
  return raw === "PROD" ? "PROD" : "DEV";
};

export const resolveInitialLocale = (
  resolveLocale: ResolveLocaleFn,
  defaultLocale: string,
): string => {
  const prefs = shellPrefsStore.read();
  return resolveLocale(prefs.locale || navigator.language || defaultLocale);
};

export const readBootstrapUiPrefs = (appMode: AppMode): BootstrapUiPrefs => {
  const prefs = shellPrefsStore.read();
  const isDeveloperToolsEnabled = prefs.developerToolsEnabled ?? appMode === "DEV";
  return {
    isDeveloperToolsEnabled,
    resourceViewerHeightPx: prefs.resourceViewerHeightPx,
    boardColumnWidthPx: prefs.boardColumnWidthPx,
  };
};
