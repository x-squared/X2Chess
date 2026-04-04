/**
 * createSessionOrchestrator — all user-facing operations for the app.
 *
 * Integration API:
 * - `createSessionOrchestrator(bundle, dispatchRef, stateRef)` — call once
 *   from `useAppStartup` and return the result as `AppStartupServices`.
 *   Pure factory function; no React imports.
 *
 * Communication API:
 * - Operations read/write `bundle.activeSessionRef.current` directly.
 * - State changes are propagated via `dispatchRef.current` (fine-grained
 *   actions) or via service callbacks that were wired at bundle creation time.
 */

import {
  parsePgnToModel,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getCommentRawById,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  setCommentTextById,
  applyDefaultLayout,
} from "../editor";
import { setHeaderValue, findMoveNode, toggleMoveNag } from "../model";
import { serializeShapes, stripShapeAnnotations } from "../board/shape_serializer";
import type { BoardShape } from "../board/board_shapes";
import type { BoardPreviewLike } from "../board/runtime";
import { type PlayerRecord } from "../app_shell/app_state";
import { resolveLocale } from "../app_shell/i18n";
import { normalizeGameInfoHeaderValue, parsePlayerRecord, buildPlayerNameSuggestions } from "../app_shell/game_info";
import { shellPrefsStore } from "../runtime/shell_prefs_store";
import { writeShapePrefs } from "../runtime/shape_prefs";
import type { ShapePrefs } from "../runtime/shape_prefs";
import { writeEditorStylePrefs } from "../runtime/editor_style_prefs";
import type { EditorStylePrefs } from "../runtime/editor_style_prefs";
import { writeDefaultLayoutPrefs } from "../runtime/default_layout_prefs";
import type { DefaultLayoutPrefs } from "../runtime/default_layout_prefs";
import type { AppStartupServices } from "../state/ServiceContext";
import type { AppAction } from "../state/actions";
import type { PgnModel } from "../model/pgn_model";
import type { GameSessionState } from "../game_sessions/game_session_state";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";
import type { AppStoreState } from "../state/app_reducer";
import type { Dispatch } from "react";
import type { ServicesBundle } from "./createAppServices";

// ── Module-level helpers ──────────────────────────────────────────────────────

/** Return the last non-empty path segment of a locator string, or a fallback. */
const lastLocatorSegment = (locator: string | null | undefined, fallback: string): string => {
  const segments: string[] = (locator ?? "").split("/");
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (segments[i]) return segments[i];
  }
  return fallback;
};

/**
 * Resolve the selected move ID for the current ply when not in board-preview mode.
 * Walks `movePositionById` to find the entry whose `mainlinePly` matches.
 */
export const resolveSelectedMoveId = (g: GameSessionState): string | null => {
  const bp = g.boardPreview as { fen?: string } | null;
  if (bp?.fen) return g.selectedMoveId;
  const ply: number = Number(g.currentPly) || 0;
  if (ply === 0) return null;
  const positions = g.movePositionById as Record<string, { mainlinePly?: unknown }> | null;
  if (positions) {
    for (const [moveId, record] of Object.entries(positions)) {
      if (record.mainlinePly === ply) return moveId;
    }
  }
  return g.selectedMoveId;
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create all user-facing operation callbacks wired to the services bundle.
 *
 * @param bundle Fully-wired services bundle (created once from `createAppServicesBundle`).
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param stateRef Mutable ref mirroring the latest React state (updated on every render).
 * @returns `AppStartupServices` object consumed by `ServiceContext`.
 */
export const createSessionOrchestrator = (
  bundle: ServicesBundle,
  dispatchRef: { current: Dispatch<AppAction> },
  stateRef: { current: AppStoreState },
): AppStartupServices => {
  // Flush PGN/navigation/undo/focus state to React after inline session mutations.
  // Session-list and resource-viewer changes are dispatched by the
  // onSessionsChanged/onTabsChanged service callbacks automatically.
  const flushSessionState = (): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    const bp = g.boardPreview as { fen?: string; lastMove?: [string, string] | null } | null;
    const d = dispatchRef.current;
    d({ type: "set_pgn_state", pgnText: g.pgnText, pgnModel: g.pgnModel as PgnModel | null, moves: Array.isArray(g.moves) ? g.moves : [], pgnTextLength: g.pgnText.length, moveCount: Array.isArray(g.moves) ? g.moves.length : 0 });
    d({ type: "set_navigation", currentPly: Number(g.currentPly) || 0, selectedMoveId: resolveSelectedMoveId(g), boardPreview: bp?.fen ? { fen: String(bp.fen), lastMove: bp.lastMove ?? null } : null });
    d({ type: "set_undo_redo_depth", undoDepth: Array.isArray(g.undoStack) ? g.undoStack.length : 0, redoDepth: Array.isArray(g.redoStack) ? g.redoStack.length : 0 });
    d({ type: "set_pending_focus", commentId: g.pendingFocusCommentId });
  };

  return {
    // ── Navigation ─────────────────────────────────────────────────────────
    gotoFirst: (): void => {
      void bundle.navigation.gotoPly(0);
    },
    gotoPrev: (): void => {
      void bundle.navigation.gotoRelativeStep(-1);
    },
    gotoNext: (): void => {
      void bundle.navigation.gotoRelativeStep(1);
    },
    gotoLast: (): void => {
      void bundle.navigation.gotoPly(bundle.activeSessionRef.current.moves.length);
    },
    gotoMoveById: (moveId: string): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      const pos = g.movePositionById?.[moveId] as
        | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
        | undefined;
      if (pos && typeof pos.mainlinePly === "number") {
        g.selectedMoveId = moveId;
        g.boardPreview = null;
        flushSessionState();
        void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
      } else {
        g.selectedMoveId = moveId;
        g.boardPreview = pos?.fen
          ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as BoardPreviewLike)
          : null;
        flushSessionState();
      }
    },
    handleEditorArrowHotkey: (event: KeyboardEvent): boolean =>
      bundle.navigation.handleSelectedMoveArrowHotkey(event),

    // ── PGN editing ────────────────────────────────────────────────────────
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
    insertComment: (moveId: string, position: "before" | "after"): { id: string; rawText: string } | null => {
      const g: GameSessionState = bundle.activeSessionRef.current;
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
      const existing = findExistingCommentIdAroundMove(g.pgnModel, moveId, position);
      if (existing) {
        g.pendingFocusCommentId = existing;
        flushSessionState();
      }
    },
    saveCommentText: (commentId: string, text: string): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      const newModel = setCommentTextById(g.pgnModel, commentId, text);
      if (newModel) {
        bundle.applyModelUpdate(newModel, null, {
          recordHistory: false,
          preferredLayoutMode: g.pgnLayoutMode,
        });
      }
    },
    applyDefaultIndent: (): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      const prefs = stateRef.current.defaultLayoutPrefs;
      const newModel = applyDefaultLayout(g.pgnModel, prefs);
      if (newModel) {
        bundle.applyModelUpdate(newModel, null, { recordHistory: true });
      }
    },
    saveBoardShapes: (moveId: string, shapes: BoardShape[]): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      if (!findMoveNode(g.pgnModel as PgnModel, moveId)) return;

      let commentId: string | null = findExistingCommentIdAroundMove(g.pgnModel, moveId, "after");
      let workingModel: unknown = g.pgnModel;

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
    toggleMoveNag: (moveId: string, nag: string): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      const newModel = toggleMoveNag(g.pgnModel, moveId, nag);
      bundle.applyModelUpdate(newModel, null, {
        recordHistory: true,
        preferredLayoutMode: g.pgnLayoutMode,
      });
    },
    updateGameInfoHeader: (key: string, rawValue: string): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      const normalizedValue: string = normalizeGameInfoHeaderValue(key, rawValue);
      const newModel = setHeaderValue(g.pgnModel as PgnModel, key, normalizedValue);
      if (key === "X2Style") {
        const mode: "plain" | "text" | "tree" = normalizeX2StyleValue(normalizedValue);
        g.pgnLayoutMode = mode;
        shellPrefsStore.write({ ...shellPrefsStore.read(), pgnLayout: mode });
      }
      if (key === "White" || key === "Black") {
        const record: PlayerRecord | null = parsePlayerRecord(normalizedValue);
        if (record) bundle.resources.addPlayerRecord(record);
      }
      bundle.applyModelUpdate(newModel, null, { recordHistory: true });
    },

    // ── Move entry ─────────────────────────────────────────────────────────
    applyPgnModelEdit: (newModel: PgnModel, targetMoveId: string | null): void => {
      const g: GameSessionState = bundle.activeSessionRef.current;
      bundle.applyModelUpdate(newModel, null, {
        recordHistory: true,
        preferredLayoutMode: g.pgnLayoutMode,
      });
      if (targetMoveId) {
        const pos = (g.movePositionById as Record<string, { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null } | undefined> | undefined)?.[targetMoveId];
        if (pos && typeof pos.mainlinePly === "number") {
          g.selectedMoveId = targetMoveId;
          g.boardPreview = null;
          void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
        } else if (pos?.fen) {
          g.selectedMoveId = targetMoveId;
          g.boardPreview = { fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as BoardPreviewLike;
          flushSessionState();
        }
      }
    },

    // ── History ────────────────────────────────────────────────────────────
    undo: (): void => {
      bundle.history.performUndo();
    },
    redo: (): void => {
      bundle.history.performRedo();
    },

    // ── Sessions ───────────────────────────────────────────────────────────
    switchSession: (sessionId: string): void => {
      const switched: boolean = bundle.sessionStore.switchToSession(sessionId);
      if (switched) flushSessionState();
    },
    closeSession: (sessionId: string): void => {
      const result = bundle.sessionStore.closeSession(sessionId);
      if (result.closed) {
        if (result.emptyAfterClose) {
          const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText("");
          bundle.sessionStore.openSession({ ownState: newState, title: "New Game" });
        }
        flushSessionState();
      }
    },

    // ── Resource rows ──────────────────────────────────────────────────────
    openResource: (): void => {
      void (async (): Promise<void> => {
        try {
          const selected = await bundle.resources.chooseResourceByPicker();
          if (!selected) return;
          const ref = selected.resourceRef;
          const locatorLastSegment: string = lastLocatorSegment(ref.locator, String(ref.kind ?? "Resource"));
          bundle.resourceViewer.upsertTab({
            title: locatorLastSegment,
            resourceRef: ref,
            select: true,
          });
          flushSessionState();
        } catch (err: unknown) {
          const message: string = err instanceof Error ? err.message : String(err);
          dispatchRef.current({ type: "set_error_message", message });
        }
      })();
    },
    openPgnText: (pgnText: string, options?: { preferredTitle?: string; sourceRef?: { kind: string; locator: string; recordId?: string } | null }): void => {
      const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(pgnText);
      const derivedTitle: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, "New Game");
      const title: string = options?.preferredTitle || derivedTitle;
      bundle.sessionStore.openSession({ ownState: newState, title, sourceRef: options?.sourceRef ?? null });
      flushSessionState();
    },
    reorderGameInResource: async (sourceRef: unknown, neighborSourceRef: unknown): Promise<void> => {
      const ref = sourceRef as { kind?: string; locator?: string; recordId?: unknown } | null;
      const neighbor = neighborSourceRef as { kind?: string; locator?: string; recordId?: unknown } | null;
      await bundle.resources.reorderGameInResource(
        { kind: String(ref?.kind ?? "db"), locator: String(ref?.locator ?? ""), recordId: ref?.recordId == null ? undefined : String(ref.recordId) },
        { kind: String(neighbor?.kind ?? "db"), locator: String(neighbor?.locator ?? ""), recordId: neighbor?.recordId == null ? undefined : String(neighbor.recordId) },
      );
    },
    searchByPosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<PositionSearchHit[]> =>
      bundle.resources.searchByPositionAcross(positionHash, resourceRefs),
    searchByText: async (query: string, resourceRefs: PgnResourceRef[]): Promise<TextSearchHit[]> =>
      bundle.resources.searchTextAcross(query, resourceRefs),
    explorePosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<MoveFrequencyEntry[]> =>
      bundle.resources.explorePositionAcross(positionHash, resourceRefs),
    openGameFromRef: (sourceRef: unknown): void => {
      void (async (): Promise<void> => {
        const ref = sourceRef as { kind?: string; locator?: string; recordId?: unknown } | null;
        try {
          const result = await bundle.resources.loadGameBySourceRef({
            kind: String(ref?.kind ?? "directory"),
            locator: String(ref?.locator ?? ""),
            recordId: ref?.recordId == null ? undefined : String(ref.recordId),
          });
          const g: GameSessionState = bundle.activeSessionRef.current;
          g.pgnText = result.pgnText;
          g.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(result.pgnText)) as typeof g.pgnModel;
          g.currentPly = 0;
          g.selectedMoveId = null;
          bundle.pgnRuntime.syncChessParseState(result.pgnText);
          bundle.sessionStore.updateActiveSessionMeta({
            sourceRef: {
              kind: String(ref?.kind ?? "directory"),
              locator: String(ref?.locator ?? ""),
              recordId: ref?.recordId == null ? undefined : String(ref.recordId),
            },
            dirtyState: "clean",
          });
          flushSessionState();
        } catch (err: unknown) {
          const message: string = err instanceof Error ? err.message : String(err);
          dispatchRef.current({ type: "set_error_message", message });
        }
      })();
    },

    // ── Game links ─────────────────────────────────────────────────────────
    openGameFromRecordId: async (recordId: string): Promise<void> => {
      const activeSession = bundle.sessionStore.getActiveSession();
      const sourceRef = activeSession?.sourceRef;
      if (!sourceRef?.kind || !sourceRef.locator) return;
      try {
        const result = await bundle.resources.loadGameBySourceRef({
          kind: String(sourceRef.kind),
          locator: String(sourceRef.locator),
          recordId,
        });
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
        const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, recordId);
        bundle.sessionStore.openSession({
          ownState: newState,
          title,
          sourceRef: { kind: String(sourceRef.kind), locator: String(sourceRef.locator), recordId },
        });
        flushSessionState();
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        dispatchRef.current({ type: "set_error_message", message });
      }
    },
    fetchGameMetadataByRecordId: async (recordId: string): Promise<Record<string, string> | null> => {
      const activeSession = bundle.sessionStore.getActiveSession();
      const sourceRef = activeSession?.sourceRef;
      if (!sourceRef?.kind || !sourceRef.locator) return null;
      try {
        const resourceRef: { kind: string; locator: string } = {
          kind: String(sourceRef.kind),
          locator: String(sourceRef.locator),
        };
        const rows: unknown[] = await bundle.resources.listGamesForResource(resourceRef);
        const row = (rows as Array<Record<string, unknown>>).find((r: Record<string, unknown>): boolean => {
          const ref = r.sourceRef as Record<string, unknown> | null;
          return (
            String(ref?.recordId ?? "") === recordId ||
            String(r.identifier ?? "") === recordId
          );
        });
        if (!row) return null;
        return (row.metadata as Record<string, string>) ?? null;
      } catch {
        return null;
      }
    },
    getActiveSessionResourceRef: (): { kind: string; locator: string } | null => {
      const activeSession = bundle.sessionStore.getActiveSession();
      const sourceRef = activeSession?.sourceRef;
      if (!sourceRef?.kind || !sourceRef.locator) return null;
      return { kind: String(sourceRef.kind), locator: String(sourceRef.locator) };
    },

    // ── Shell state ────────────────────────────────────────────────────────
    // Pure React dispatches; stateRef mirrors latest values for service reads.
    setMenuOpen: (open: boolean): void => {
      dispatchRef.current({ type: "set_is_menu_open", open });
    },
    setDevDockOpen: (open: boolean): void => {
      if (open && !stateRef.current.isDeveloperToolsEnabled) {
        dispatchRef.current({ type: "set_dev_tools_enabled", enabled: true });
      }
      dispatchRef.current({ type: "set_dev_dock_open", open });
    },
    setActiveDevTab: (_tab: "ast"): void => {
      dispatchRef.current({ type: "set_active_dev_tab", tab: "ast" });
      dispatchRef.current({ type: "set_dev_dock_open", open: true });
    },
    setLayoutMode: (mode: "plain" | "text" | "tree"): void => {
      bundle.activeSessionRef.current.pgnLayoutMode = mode;
      dispatchRef.current({ type: "set_layout_mode", mode });
      shellPrefsStore.write({ ...shellPrefsStore.read(), pgnLayout: mode });
    },
    setShowEvalPills: (show: boolean): void => {
      dispatchRef.current({ type: "set_show_eval_pills", show });
    },
    setLocale: (locale: string): void => {
      const resolved: string = resolveLocale(locale);
      dispatchRef.current({ type: "set_locale", locale: resolved });
      shellPrefsStore.write({ ...shellPrefsStore.read(), locale: resolved });
    },
    setMoveDelayMs: (value: number): void => {
      dispatchRef.current({ type: "set_move_delay_ms", value });
      shellPrefsStore.write({ ...shellPrefsStore.read(), moveDelayMs: value });
    },
    setSoundEnabled: (enabled: boolean): void => {
      dispatchRef.current({ type: "set_sound_enabled", enabled });
      shellPrefsStore.write({ ...shellPrefsStore.read(), sound: enabled });
    },
    setPositionPreviewOnHover: (enabled: boolean): void => {
      dispatchRef.current({ type: "set_position_preview_on_hover", enabled });
      shellPrefsStore.write({ ...shellPrefsStore.read(), positionPreviewOnHover: enabled });
    },
    setDeveloperToolsEnabled: (enabled: boolean): void => {
      dispatchRef.current({ type: "set_dev_tools_enabled", enabled });
      shellPrefsStore.write({ ...shellPrefsStore.read(), developerToolsEnabled: enabled });
    },
    setShapePrefs: (prefs: ShapePrefs): void => {
      writeShapePrefs(prefs);
      dispatchRef.current({ type: "set_shape_prefs", prefs });
    },
    setEditorStylePrefs: (prefs: EditorStylePrefs): void => {
      writeEditorStylePrefs(prefs);
      dispatchRef.current({ type: "set_editor_style_prefs", prefs });
    },
    setDefaultLayoutPrefs: (prefs: DefaultLayoutPrefs): void => {
      writeDefaultLayoutPrefs(prefs);
      dispatchRef.current({ type: "set_default_layout_prefs", prefs });
    },
    setSaveMode: (mode: string): void => {
      bundle.sessionPersistence.setActiveSessionSaveMode(mode);
      flushSessionState();
    },
    saveActiveGameNow: (): void => {
      void bundle.sessionPersistence.persistActiveSessionNow();
    },
    saveSessionById: (sessionId: string): void => {
      if (bundle.sessionStore.getActiveSessionId() !== sessionId) {
        bundle.sessionStore.switchToSession(sessionId);
        flushSessionState();
      }
      void bundle.sessionPersistence.persistActiveSessionNow();
    },
    getPlayerNameSuggestions: (query: string): string[] =>
      buildPlayerNameSuggestions(bundle.resources.getPlayerStore(), query),

    // Overridden by AppShell to open the curriculum panel.
    openCurriculumPanel: (): void => {},
    // Overridden by AppShell to open the editor style dialog.
    openEditorStyleDialog: (): void => {},
    // Overridden by AppShell to open the default layout dialog.
    openDefaultLayoutDialog: (): void => {},
  };
};
