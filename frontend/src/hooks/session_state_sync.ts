/**
 * session_state_sync — shared session-to-React dispatch helpers.
 *
 * Keeps one canonical mapping from `GameSessionState` to the reducer actions that
 * mirror active-session PGN/navigation/editor state into `AppStoreState`.
 *
 * Integration API:
 * - `resolveSelectedMoveIdForSync(session)` — compute selected move ID for dispatch.
 * - `dispatchNavigationState(session, dispatchAction)` — emit navigation action only.
 * - `dispatchSessionStateSnapshot(session, dispatchAction)` — emit all session sync actions.
 *
 * Configuration API:
 * - No module-level configuration. Callers pass `GameSessionState` and an action dispatcher.
 *
 * Communication API:
 * - Outbound only: emits `set_navigation` (fast path) or the full set
 *   (`set_pgn_state`, `set_navigation`, `set_undo_redo_depth`, `set_pending_focus`)
 *   through the provided callback.
 */

import type { GameSessionState } from "../features/sessions/services/game_session_state";
import type { AppAction } from "../state/actions";

type BoardPreviewSnapshot = { fen: string; lastMove?: [string, string] | null } | null;
type DispatchAction = (action: AppAction) => void;
type SessionSelectionSyncState = {
  boardPreview: { fen?: string } | null;
  selectedMoveId: string | null;
  currentPly: number;
  movePositionById: Record<string, { mainlinePly?: unknown }> | null;
};

/**
 * Resolve the selected move ID for reducer sync.
 *
 * When no board preview is active, this prefers the move whose `mainlinePly`
 * matches `currentPly`. At ply 0 it always resolves to `null`.
 *
 * @param session - Active game session state.
 * @returns Move ID to dispatch as selected, or `null`.
 */
export const resolveSelectedMoveIdForSync = (session: SessionSelectionSyncState): string | null => {
  const boardPreview = session.boardPreview as { fen?: string } | null;
  if (boardPreview?.fen) return session.selectedMoveId;
  const ply: number = Number(session.currentPly) || 0;
  if (ply === 0) return null;
  const positions = session.movePositionById as Record<string, { mainlinePly?: unknown }> | null;
  if (positions) {
    for (const [moveId, record] of Object.entries(positions)) {
      if (record && typeof record === "object" && record.mainlinePly === ply) return moveId;
    }
  }
  return session.selectedMoveId;
};

/**
 * Dispatch only the navigation slice for the provided session state.
 *
 * Useful for high-frequency navigation updates where the PGN/editor slices
 * did not change and should not be re-dispatched.
 *
 * @param session - Session-like selection/navigation state.
 * @param dispatchAction - Callback that forwards reducer actions.
 * @returns Nothing.
 */
export const dispatchNavigationState = (
  session: SessionSelectionSyncState,
  dispatchAction: DispatchAction,
): void => {
  const boardPreview = session.boardPreview as { fen?: string; lastMove?: [string, string] | null } | null;
  const normalizedBoardPreview: BoardPreviewSnapshot = boardPreview?.fen
    ? { fen: String(boardPreview.fen), lastMove: boardPreview.lastMove ?? null }
    : null;
  dispatchAction({
    type: "set_navigation",
    currentPly: Number(session.currentPly) || 0,
    selectedMoveId: resolveSelectedMoveIdForSync(session),
    boardPreview: normalizedBoardPreview,
  });
};

/**
 * Dispatch the full active-session snapshot to React reducer state.
 *
 * @param session - Active game session state to mirror.
 * @param dispatchAction - Callback that forwards reducer actions.
 * @returns Nothing.
 */
export const dispatchSessionStateSnapshot = (
  session: GameSessionState,
  dispatchAction: DispatchAction,
): void => {
  const normalizedMoves: string[] = Array.isArray(session.moves) ? session.moves : [];
  dispatchAction({
    type: "set_pgn_state",
    pgnText: session.pgnText,
    pgnModel: session.pgnModel,
    moves: normalizedMoves,
    pgnTextLength: session.pgnText.length,
    moveCount: normalizedMoves.length,
  });
  dispatchNavigationState(session, dispatchAction);
  dispatchAction({
    type: "set_undo_redo_depth",
    undoDepth: Array.isArray(session.undoStack) ? session.undoStack.length : 0,
    redoDepth: Array.isArray(session.redoStack) ? session.redoStack.length : 0,
  });
  dispatchAction({ type: "set_pending_focus", commentId: session.pendingFocusCommentId });
};
