import type { AppStoreState } from "./app_reducer";

export const selectLocale = (state: AppStoreState): string => state.locale;
export const selectLayoutMode = (state: AppStoreState): "plain" | "text" | "tree" => state.pgnLayoutMode;
export const selectDevToolsEnabled = (state: AppStoreState): boolean => state.isDeveloperToolsEnabled;
export const selectDevDockOpen = (state: AppStoreState): boolean => state.isDevDockOpen;
export const selectActiveDevTab = (state: AppStoreState): "ast" | "dom" | "pgn" => state.activeDevTab;
