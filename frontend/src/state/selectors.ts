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

import type { PgnModel } from "../../../parts/pgnparser/src/pgn_model";
import type { AppStoreState, ResourceTabSnapshot, SessionItemState } from "./app_reducer";
import { findMoveNode } from "../../../parts/pgnparser/src/pgn_move_ops";
import { parseShapes } from "../board/shape_parser";
import type { BoardShape } from "../board/board_shapes";
import type { ShapePrefs } from "../runtime/shape_prefs";
import type { EditorStylePrefs } from "../runtime/editor_style_prefs";
import type { DefaultLayoutPrefs } from "../runtime/default_layout_prefs";

// ── Shell ────────────────────────────────────────────────────────────────────
export const selectLocale = (state: AppStoreState): string => state.locale;
export const selectDevToolsEnabled = (state: AppStoreState): boolean =>
  state.isDeveloperToolsEnabled;
export const selectDevDockOpen = (state: AppStoreState): boolean => state.isDevDockOpen;
export const selectActiveDevTab = (state: AppStoreState): "ast" | "pgn" =>
  state.activeDevTab;
export const selectIsMenuOpen = (state: AppStoreState): boolean => state.isMenuOpen;

// ── Board / navigation ───────────────────────────────────────────────────────
export const selectBoardFlipped = (state: AppStoreState): boolean => state.boardFlipped;
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
export const selectPositionPreviewOnHover = (state: AppStoreState): boolean =>
  state.positionPreviewOnHover;
export const selectShapePrefs = (state: AppStoreState): ShapePrefs => state.shapePrefs;
export const selectEditorStylePrefs = (state: AppStoreState): EditorStylePrefs => state.editorStylePrefs;
export const selectDefaultLayoutPrefs = (state: AppStoreState): DefaultLayoutPrefs => state.defaultLayoutPrefs;

// ── Editor / PGN ─────────────────────────────────────────────────────────────
export const selectLayoutMode = (
  state: AppStoreState,
): "plain" | "text" | "tree" => state.pgnLayoutMode;
export const selectShowEvalPills = (state: AppStoreState): boolean => state.showEvalPills;
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

/**
 * Derive the starting FEN for the active game from its PGN headers.
 *
 * Returns the value of the `FEN` header when present and non-empty, which
 * indicates the game begins from a custom position.  Falls back to an empty
 * string (callers treat empty as standard initial position) when no FEN header
 * is present.  `SetUp` is intentionally not checked — many producers omit it even with a custom FEN.
 */
export const selectStartingFen = (state: AppStoreState): string =>
  state.pgnModel?.headers?.find((h) => h.key === "FEN")?.value?.trim() ?? "";

// ── Board shapes (annotation-derived) ────────────────────────────────────────
/**
 * Derive the `BoardShape[]` for the currently selected move from `[%csl]` /
 * `[%cal]` annotations in its `commentsAfter` text.  Returns `[]` when there
 * is no selected move, no model, or no shape annotations present.
 */
export const selectAnnotationShapes = (state: AppStoreState): BoardShape[] => {
  const model: PgnModel | null = state.pgnModel;
  const moveId: string | null = state.selectedMoveId;
  if (!model || !moveId) return [];

  const moveNode = findMoveNode(model, moveId);
  if (!moveNode) return [];

  const shapes: BoardShape[] = [];
  for (const comment of moveNode.commentsAfter) {
    shapes.push(...parseShapes(comment.raw));
  }
  return shapes;
};

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

// ── Storage import ───────────────────────────────────────────────────────────
export const selectStorageImportPending = (state: AppStoreState): Record<string, string> | null =>
  state.storageImportPending;
