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
  const raw = typeof __X2CHESS_MODE__ !== "undefined" ? String(__X2CHESS_MODE__) : defaultAppMode;
  return raw === "PROD" ? "PROD" : "DEV";
};

export const resolveInitialLocale = (
  resolveLocale: ResolveLocaleFn,
  defaultLocale: string,
): string => resolveLocale(window.localStorage?.getItem("x2chess.locale") || navigator.language || defaultLocale);

const readPersistedDeveloperToolsPreference = (): boolean | null => {
  const raw = window.localStorage?.getItem(MODE_STORAGE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
};

const readPersistedDimension = (storageKey: string): number | null => {
  const raw = window.localStorage?.getItem(storageKey);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export const readBootstrapUiPrefs = (appMode: AppMode): BootstrapUiPrefs => {
  const persistedDeveloperTools = readPersistedDeveloperToolsPreference();
  return {
    isDeveloperToolsEnabled: persistedDeveloperTools !== null ? persistedDeveloperTools : appMode === "DEV",
    resourceViewerHeightPx: readPersistedDimension(RESOURCE_VIEWER_HEIGHT_STORAGE_KEY),
    boardColumnWidthPx: readPersistedDimension(BOARD_COLUMN_WIDTH_STORAGE_KEY),
  };
};
