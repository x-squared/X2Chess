import type { AppStoreState } from "./app_reducer";

export const selectLocale = (state: AppStoreState): string => state.locale;
export const selectLayoutMode = (state: AppStoreState): "plain" | "text" | "tree" => state.pgnLayoutMode;
export const selectDevToolsEnabled = (state: AppStoreState): boolean => state.isDeveloperToolsEnabled;
export const selectDevDockOpen = (state: AppStoreState): boolean => state.isDevDockOpen;
export const selectActiveDevTab = (state: AppStoreState): "ast" | "dom" | "pgn" => state.activeDevTab;

export const selectCurrentPly = (state: AppStoreState): number => state.currentPly;
export const selectMoveCount = (state: AppStoreState): number => state.moveCount;
export const selectSelectedMoveId = (state: AppStoreState): string | null => state.selectedMoveId;
export const selectPendingFocusCommentId = (state: AppStoreState): string | null => state.pendingFocusCommentId;
export const selectIsGameInfoEditorOpen = (state: AppStoreState): boolean => state.isGameInfoEditorOpen;
export const selectPgnTextLength = (state: AppStoreState): number => state.pgnTextLength;
export const selectActiveSessionId = (state: AppStoreState): string | null => state.activeSessionId;
export const selectSessionCount = (state: AppStoreState): number => state.sessionCount;
export const selectSessionTitles = (state: AppStoreState): string[] => state.sessionTitles;
export const selectResourceTabCount = (state: AppStoreState): number => state.resourceTabCount;
export const selectActiveResourceTabId = (state: AppStoreState): string | null => state.activeResourceTabId;
export const selectActiveResourceTabTitle = (state: AppStoreState): string => state.activeResourceTabTitle;
export const selectActiveResourceTabKind = (state: AppStoreState): string => state.activeResourceTabKind;
export const selectActiveResourceTabLocator = (state: AppStoreState): string => state.activeResourceTabLocator;
export const selectActiveResourceRowCount = (state: AppStoreState): number => state.activeResourceRowCount;
export const selectActiveResourceErrorMessage = (state: AppStoreState): string => state.activeResourceErrorMessage;
