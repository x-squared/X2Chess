/**
 * Pure selector functions for AppStoreState.
 *
 * Integration API:
 * - Import individual selectors and call them with `state` from `useAppContext()`.
 *   Example: `const ply = selectCurrentPly(state);`
 *
 * Configuration API:
 * - No configuration; selectors are plain functions with no side effects.
 *
 * Communication API:
 * - Selectors are read-only projections; they never mutate state or dispatch actions.
 */

import type { PgnModel } from "../model/pgn_model";
import type { AppStoreState, ResourceTabSnapshot, SessionItemState } from "./app_reducer";

// ── Shell ────────────────────────────────────────────────────────────────────
export const selectLocale = (state: AppStoreState): string => state.locale;
export const selectDevToolsEnabled = (state: AppStoreState): boolean =>
  state.isDeveloperToolsEnabled;
export const selectDevDockOpen = (state: AppStoreState): boolean => state.isDevDockOpen;
export const selectActiveDevTab = (state: AppStoreState): "ast" | "dom" | "pgn" =>
  state.activeDevTab;
export const selectIsMenuOpen = (state: AppStoreState): boolean => state.isMenuOpen;

// ── Board / navigation ───────────────────────────────────────────────────────
export const selectCurrentPly = (state: AppStoreState): number => state.currentPly;
export const selectMoveCount = (state: AppStoreState): number => state.moveCount;
export const selectSelectedMoveId = (state: AppStoreState): string | null =>
  state.selectedMoveId;
export const selectMoveDelayMs = (state: AppStoreState): number => state.moveDelayMs;
export const selectSoundEnabled = (state: AppStoreState): boolean => state.soundEnabled;
export const selectStatusMessage = (state: AppStoreState): string => state.statusMessage;
export const selectErrorMessage = (state: AppStoreState): string => state.errorMessage;
export const selectActiveSourceKind = (state: AppStoreState): string =>
  state.activeSourceKind;
export const selectBoardPreview = (
  state: AppStoreState,
): { fen: string; lastMove?: [string, string] | null } | null => state.boardPreview;

// ── Editor / PGN ─────────────────────────────────────────────────────────────
export const selectLayoutMode = (
  state: AppStoreState,
): "plain" | "text" | "tree" => state.pgnLayoutMode;
export const selectPgnText = (state: AppStoreState): string => state.pgnText;
export const selectPgnModel = (state: AppStoreState): PgnModel | null => state.pgnModel;
export const selectMoves = (state: AppStoreState): string[] => state.moves;
export const selectPgnTextLength = (state: AppStoreState): number => state.pgnTextLength;
export const selectPendingFocusCommentId = (state: AppStoreState): string | null =>
  state.pendingFocusCommentId;
export const selectIsGameInfoEditorOpen = (state: AppStoreState): boolean =>
  state.isGameInfoEditorOpen;
export const selectUndoDepth = (state: AppStoreState): number => state.undoDepth;
export const selectRedoDepth = (state: AppStoreState): number => state.redoDepth;

// ── Sessions ─────────────────────────────────────────────────────────────────
export const selectActiveSessionId = (state: AppStoreState): string | null =>
  state.activeSessionId;
export const selectSessionCount = (state: AppStoreState): number => state.sessionCount;
export const selectSessionTitles = (state: AppStoreState): string[] =>
  state.sessionTitles;
export const selectSessions = (state: AppStoreState): SessionItemState[] =>
  state.sessions;

// ── Resource viewer ───────────────────────────────────────────────────────────
export const selectResourceTabCount = (state: AppStoreState): number =>
  state.resourceTabCount;
export const selectActiveResourceTabId = (state: AppStoreState): string | null =>
  state.activeResourceTabId;
export const selectActiveResourceTabTitle = (state: AppStoreState): string =>
  state.activeResourceTabTitle;
export const selectActiveResourceTabKind = (state: AppStoreState): string =>
  state.activeResourceTabKind;
export const selectActiveResourceTabLocator = (state: AppStoreState): string =>
  state.activeResourceTabLocator;
export const selectActiveResourceRowCount = (state: AppStoreState): number =>
  state.activeResourceRowCount;
export const selectActiveResourceErrorMessage = (state: AppStoreState): string =>
  state.activeResourceErrorMessage;
export const selectResourceViewerTabs = (state: AppStoreState): ResourceTabSnapshot[] =>
  state.resourceViewerTabSnapshots;
