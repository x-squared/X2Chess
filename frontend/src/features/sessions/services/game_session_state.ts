/**
 * GameSessionState — per-session game state.
 *
 * Integration API:
 * - `GameSessionState` — all mutable state that belongs to one open game session.
 * - `ActiveSessionRef` — a ref object threaded through service modules; `current`
 *   always points to the active session's `GameSessionState`. Session switch updates
 *   `current` to the new session's object without copying any data.
 * - `createEmptyGameSessionState()` — factory for a blank state object.
 *
 * Configuration API:
 * - No configuration; this module exports pure types and a factory function.
 *
 * Communication API:
 * - Service modules receive `sessionRef: ActiveSessionRef` and read/write
 *   `sessionRef.current.<field>` directly.
 *
 * Fields NOT stored here (owned by their respective service closures):
 * - `animationRunId`, `isAnimating` → navigation service
 * - `errorMessage`, `statusMessage` → dispatched directly via service callbacks
 */

import type { MovePositionIndex } from "../../../board/move_position";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import type { BoardPreviewLike } from "../../../board/runtime";
import type { LayoutMode } from "../../editor/model/plan/types";

/**
 * All state belonging to one open game session.
 * Each GameSession object carries its own live instance of this type.
 */
export type GameSessionState = {
  // PGN / model
  pgnModel: PgnModel | null;
  pgnText: string;
  moves: string[];
  verboseMoves: Array<{ flags?: string; from?: string; to?: string }>;
  movePositionById: MovePositionIndex;
  /** PGN editor layout — scoped per session (stored in [XSqrChessStyle] header). */
  pgnLayoutMode: LayoutMode;

  // Navigation
  currentPly: number;
  selectedMoveId: string | null;
  boardPreview: BoardPreviewLike | null;

  // Editor state
  pendingFocusCommentId: string | null;

  // Undo / redo — kept per-session so switching sessions restores the correct stacks.
  undoStack: unknown[];
  redoStack: unknown[];
};

/**
 * Ref object threaded through all service modules.
 * Services read and write `current`; session switch replaces `current`.
 */
export type ActiveSessionRef = { current: GameSessionState };

/**
 * Build a fresh, empty game session state.
 *
 * @returns {GameSessionState} Zeroed-out session state object.
 */
export const createEmptyGameSessionState = (): GameSessionState => ({
  pgnModel: null,
  pgnText: "",
  moves: [],
  verboseMoves: [],
  movePositionById: {},
  pgnLayoutMode: "plain",
  currentPly: 0,
  selectedMoveId: null,
  boardPreview: null,
  pendingFocusCommentId: null,
  undoStack: [],
  redoStack: [],
});
