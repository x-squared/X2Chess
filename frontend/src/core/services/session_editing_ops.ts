/**
 * createEditingOps — PGN editing and history operations.
 *
 * Integration API:
 * - `createEditingOps(bundle, dispatchRef, stateRef, flushSessionState)` — call from
 *   `createSessionOrchestrator`; spread the result into `AppStartupServices`.
 *   Pure factory function; no React imports.
 *
 * Communication API:
 * - Operations read/write `bundle.activeSessionRef.current` for model and editor state.
 * - Model changes are applied via `bundle.applyModelUpdate`.
 * - Dirty-state changes are signalled via `bundle.sessionStore.updateActiveSessionMeta`.
 * - Board-flip is dispatched via `dispatchRef` for operations that replace the model.
 */

import {
  X2_BOARD_ORIENTATION_HEADER_KEY,
  X2_STYLE_HEADER_KEY,
  XSQR_HEAD_HEADER_KEY,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  findMoveNode,
  getCommentRawById,
  getHeaderValue,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  applyDefaultLayout,
  setCommentTextById,
  setHeaderValue,
  toggleMoveNag,
  deriveInitialBoardFlipped,
} from "../../model";
import { parsePgnToModel } from "../../../../parts/pgnparser/src/pgn_model";
import { serializeShapes, stripShapeAnnotations } from "../../board/shape_serializer";
import type { BoardShape } from "../../board/board_shapes";
import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import type { PlayerRecord } from "../../app/shell/model/app_state";
import { normalizeGameInfoHeaderValue, parsePlayerRecord } from "../../features/editor/model/game_info";
import { shellPrefsStore } from "../../runtime/shell_prefs_store";
import type { AppAction } from "../state/actions";
import type { AppStoreState } from "../state/app_reducer";
import type { AppStartupServices } from "../contracts/app_services";
import type { ServicesBundle } from "./createAppServices";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import { log } from "../../logger";
import { shouldBlockPlaceholderOverwrite } from "./session_helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

type EditingOps = Pick<
  AppStartupServices,
  | "loadPgnText"
  | "applyDeveloperDockRawPgn"
  | "insertComment"
  | "focusCommentAroundMove"
  | "saveCommentText"
  | "applyDefaultIndent"
  | "saveBoardShapes"
  | "toggleMoveNag"
  | "updateGameInfoHeader"
  | "undo"
  | "redo"
  | "recordHistorySnapshot"
>;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns PGN editing and history operations wired to the given bundle.
 *
 * @param bundle Fully-wired services bundle.
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param stateRef Mutable ref mirroring the latest React state.
 * @param flushSessionState Flush active session state to React.
 */
export const createEditingOps = (
  bundle: ServicesBundle,
  dispatchRef: { current: (action: AppAction) => void },
  stateRef: { current: AppStoreState },
  flushSessionState: () => void,
): EditingOps => ({
  // ── PGN text replacement ────────────────────────────────────────────────────

  loadPgnText: (pgnText: string): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    g.pgnText = pgnText;
    g.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof g.pgnModel;
    g.currentPly = 0;
    g.selectedMoveId = null;
    bundle.pgnRuntime.syncChessParseState(pgnText);
    bundle.sessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
    flushSessionState();
  },

  /**
   * Apply raw PGN from the Developer Dock: replaces the in-memory game, flushes UI,
   * clears undo/redo, and marks the session dirty without scheduling autosave.
   *
   * @param pgnText - Full PGN string to parse and load.
   * @returns True when parsing and sync succeeded; false when the session is left unchanged.
   */
  applyDeveloperDockRawPgn: (pgnText: string): boolean => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    let nextModel: PgnModel;
    try {
      nextModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText));
    } catch (err: unknown) {
      const message: string = err instanceof Error ? err.message : String(err);
      log.error("session_editing_ops", `applyDeveloperDockRawPgn: parse failed: ${message}`);
      dispatchRef.current({ type: "set_error_message", message });
      return false;
    }
    g.pgnText = pgnText;
    g.pgnModel = nextModel;
    g.currentPly = 0;
    g.selectedMoveId = null;
    g.pendingFocusCommentId = null;
    g.boardPreview = null;
    g.undoStack = [];
    g.redoStack = [];
    bundle.pgnRuntime.syncChessParseState(pgnText);
    bundle.sessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
    flushSessionState();
    dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(g.pgnModel) });
    // [log: may downgrade to debug once dev-dock raw PGN apply is stable]
    log.info(
      "session_editing_ops",
      "applyDeveloperDockRawPgn: session replaced from dev dock (undo cleared; no autosave scheduled)",
    );
    return true;
  },

  // ── Comments ────────────────────────────────────────────────────────────────

  insertComment: (moveId: string, position: "before" | "after"): { id: string; rawText: string } | null => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    if (!g.pgnModel) return null;
    const existing = findExistingCommentIdAroundMove(g.pgnModel, moveId, position);
    if (existing) {
      g.pendingFocusCommentId = existing;
      g.selectedMoveId = null;
      flushSessionState();
      const rawText = getCommentRawById(g.pgnModel, existing) ?? "";
      return { id: existing, rawText };
    }
    const result = insertCommentAroundMove(g.pgnModel, moveId, position);
    g.selectedMoveId = null;
    bundle.applyModelUpdate(result.model, result.insertedCommentId, {
      recordHistory: true,
      preferredLayoutMode: g.pgnLayoutMode,
    });
    return result.insertedCommentId ? { id: result.insertedCommentId, rawText: "" } : null;
  },

  focusCommentAroundMove: (moveId: string, position: "before" | "after"): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    if (!g.pgnModel) return;
    const existing = findExistingCommentIdAroundMove(g.pgnModel, moveId, position);
    if (existing) {
      g.pendingFocusCommentId = existing;
      flushSessionState();
    }
  },

  saveCommentText: (commentId: string, text: string): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    if (!g.pgnModel) return;
    const newModel = setCommentTextById(g.pgnModel, commentId, text);
    if (newModel) {
      bundle.applyModelUpdate(newModel, null, {
        recordHistory: false,
        preferredLayoutMode: g.pgnLayoutMode,
      });
      bundle.sessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
    }
  },

  // ── Layout ──────────────────────────────────────────────────────────────────

  applyDefaultIndent: (): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    if (!g.pgnModel) return;
    const prefs = stateRef.current.defaultLayoutPrefs;
    const newModel = applyDefaultLayout(g.pgnModel, prefs);
    if (newModel) {
      bundle.applyModelUpdate(newModel, null, { recordHistory: true });
    }
  },

  // ── Shapes ──────────────────────────────────────────────────────────────────

  saveBoardShapes: (moveId: string, shapes: BoardShape[]): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    if (!g.pgnModel) return;
    if (!findMoveNode(g.pgnModel, moveId)) return;

    let commentId: string | null = findExistingCommentIdAroundMove(g.pgnModel, moveId, "after");
    let workingModel: PgnModel = g.pgnModel;

    if (!commentId) {
      if (shapes.length === 0) return;
      const result = insertCommentAroundMove(workingModel, moveId, "after", "");
      if (!result.insertedCommentId) return;
      commentId = result.insertedCommentId;
      workingModel = result.model;
    }

    const existingRaw: string | null = getCommentRawById(workingModel, commentId);
    const stripped: string = stripShapeAnnotations(existingRaw ?? "");
    const shapePart: string = serializeShapes(shapes);
    const newRaw: string = [stripped, shapePart].filter(Boolean).join(" ");

    const updatedModel = setCommentTextById(workingModel, commentId, newRaw);
    if (updatedModel) {
      bundle.applyModelUpdate(updatedModel, null, {
        recordHistory: true,
        preferredLayoutMode: g.pgnLayoutMode,
      });
    }
  },

  // ── NAGs ────────────────────────────────────────────────────────────────────

  toggleMoveNag: (moveId: string, nag: string): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    if (!g.pgnModel) return;
    const newModel = toggleMoveNag(g.pgnModel, moveId, nag);
    bundle.applyModelUpdate(newModel, null, {
      recordHistory: true,
      preferredLayoutMode: g.pgnLayoutMode,
    });
  },

  // ── Game info headers ───────────────────────────────────────────────────────

  updateGameInfoHeader: (sessionId: string, key: string, rawValue: string): void => {
    // [log: may downgrade to debug once game-info header edit flow is stable]
    log.info("session_editing_ops", "updateGameInfoHeader: request received", {
      key,
      sessionId,
      isExplicitClear: rawValue.trim() === "",
    });
    if (key === XSQR_HEAD_HEADER_KEY) {
      log.info("session_editing_ops", "updateGameInfoHeader: ignored read-only Head");
      return;
    }
    const activeSessionId: string | null = bundle.sessionStore.getActiveSessionId();
    if (sessionId !== activeSessionId) {
      log.info(
        "session_editing_ops",
        `updateGameInfoHeader: rejected non-active target key="${key}" target="${sessionId}" active="${activeSessionId ?? "null"}"`,
      );
      return;
    }
    const targetSession = bundle.sessionStore.getSessionById(sessionId);
    if (!targetSession) {
      log.warn("session_editing_ops", `updateGameInfoHeader: target session missing "${sessionId}"`);
      return;
    }
    const g: GameSessionState = targetSession.ownState;
    const normalizedValue: string = normalizeGameInfoHeaderValue(key, rawValue);
    const currentValue: string = getHeaderValue(g.pgnModel, key, "");
    // [log: may downgrade to debug once game-info header edit flow is stable]
    log.info("session_editing_ops", "updateGameInfoHeader: normalized values", {
      key,
      isRawEmpty: rawValue.trim() === "",
      isNormalizedEmpty: normalizedValue.trim() === "",
      isCurrentEmpty: currentValue.trim() === "",
    });
    if (shouldBlockPlaceholderOverwrite(key, rawValue, normalizedValue, currentValue)) {
      log.warn(
        "session_editing_ops",
        `updateGameInfoHeader: blocked placeholder overwrite key="${key}" current="${currentValue}" next="${normalizedValue}" session="${sessionId}"`,
      );
      return;
    }
    const newModel = setHeaderValue(g.pgnModel as PgnModel, key, normalizedValue);
    const writtenValue: string = getHeaderValue(newModel, key, "");
    // [log: may downgrade to debug once game-info header edit flow is stable]
    log.info("session_editing_ops", "updateGameInfoHeader: header written", {
      key,
      isWrittenEmpty: writtenValue.trim() === "",
    });
    if (key === X2_STYLE_HEADER_KEY) {
      const mode: "plain" | "text" | "tree" = normalizeX2StyleValue(normalizedValue);
      g.pgnLayoutMode = mode;
      shellPrefsStore.write({ ...shellPrefsStore.read(), pgnLayout: mode });
    }
    if (key === "White" || key === "Black") {
      const record: PlayerRecord | null = parsePlayerRecord(normalizedValue);
      if (record) bundle.resources.addPlayerRecord(record);
    }
    if (key === X2_BOARD_ORIENTATION_HEADER_KEY) {
      // Reflect the explicit orientation change on the board immediately.
      const flipped: boolean = normalizedValue.trim().toLowerCase() === "black";
      dispatchRef.current({ type: "set_board_flipped", flipped });
    }
    bundle.applyModelUpdate(newModel, null, { recordHistory: true });
    // Header edits must refresh session-pill metadata immediately.
    bundle.sessionStore.updateActiveSessionMeta({});
    // [log: may downgrade to debug once game-info header edit flow is stable]
    log.info("session_editing_ops", "updateGameInfoHeader: model update applied", {
      key,
      sessionId,
      isWrittenEmpty: writtenValue.trim() === "",
    });
  },

  // ── History ─────────────────────────────────────────────────────────────────

  undo: (): void => {
    bundle.history.performUndo();
  },
  redo: (): void => {
    bundle.history.performRedo();
  },
  recordHistorySnapshot: (): void => {
    bundle.history.pushUndoSnapshot(bundle.history.captureEditorSnapshot());
    bundle.history.clearRedoStack();
  },
});
