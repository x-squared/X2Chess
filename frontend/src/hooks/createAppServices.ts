/**
 * createAppServicesBundle — constructs and wires all application service
 * instances once.
 *
 * Integration API:
 * - `createAppServicesBundle(dispatchRef)` — call once from `useAppStartup`.
 *   Uses closure over `dispatchRef` so every `render()` call dispatches through
 *   the latest `dispatch` without needing to recreate service instances.
 *
 * Configuration API:
 * - All configuration comes from `localStorage` and compile-time constants.
 *
 * Communication API:
 * - Inbound: `dispatchRef.current` is updated by `useAppStartup` on every render.
 * - Outbound: `ServicesBundle.render()` dispatches the full current state to React.
 */

import bundledPlayers from "../../data/players.json";
import {
  parsePgnToModel,
  serializeModelToPgn,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getHeaderValue,
  normalizeX2StyleValue,
} from "../editor";
import {
  buildMovePositionById,
  resolveMovePositionById,
  stripAnnotationsForBoardParser,
} from "../board/move_position";
import { createMoveSoundPlayer } from "../board/move_sound";
import { createBoardNavigationCapabilities } from "../board/navigation";
import { createMoveLookupCapabilities } from "../board/move_lookup";
import { createPgnRuntimeCapabilities } from "../editor/pgn_runtime";
import { createEditorHistoryCapabilities } from "../editor/history";
import { createApplyPgnModelUpdate } from "../runtime/pgn_model_update";
import { createResourcesCapabilities } from "../resources";
import { createResourceViewerCapabilities } from "../resources_viewer";
import { createGameSessionModel } from "../game_sessions/session_model";
import { createGameSessionStore } from "../game_sessions/session_store";
import { createSessionPersistenceService } from "../game_sessions/session_persistence";
import { createTranslator } from "../app_shell/i18n";
import {
  DEFAULT_LOCALE,
  createInitialAppState,
  type PlayerRecord,
  type AppState,
} from "../app_shell/app_state";
import {
  createEmptyGameSessionState,
  type ActiveSessionRef,
  type GameSessionState,
} from "../game_sessions/game_session_state";
import { setResourceLoaderService } from "../services/resource_loader";
import { saveWorkspaceSnapshot } from "../runtime/workspace_persistence";
import type { AppAction } from "../state/actions";
import type { PgnModel } from "../model/pgn_model";
import type { SessionItemState, ResourceTabSnapshot } from "../state/app_reducer";
import type { Dispatch } from "react";
import type { MovePositionRecord } from "../board/move_position";

// ── Internal service types ─────────────────────────────────────────────────────

type PgnRuntime = ReturnType<typeof createPgnRuntimeCapabilities>;
type HistoryCapabilities = ReturnType<typeof createEditorHistoryCapabilities>;
type ApplyModelUpdate = ReturnType<typeof createApplyPgnModelUpdate>;
type ResourcesCapabilities = ReturnType<typeof createResourcesCapabilities>;
type SessionModel = ReturnType<typeof createGameSessionModel>;
type SessionStore = ReturnType<typeof createGameSessionStore>;
type SessionPersistence = ReturnType<typeof createSessionPersistenceService>;
type Navigation = ReturnType<typeof createBoardNavigationCapabilities>;
type MoveLookup = ReturnType<typeof createMoveLookupCapabilities>;
type ResourceViewer = ReturnType<typeof createResourceViewerCapabilities>;

// ── State-to-React sync helpers ────────────────────────────────────────────────

/** Normalise a raw devTab string into the accepted union. */
export const toDevTab = (_raw: unknown): "ast" => "ast";

/** Map a raw session object (from session_store.listSessions) to `SessionItemState`. */
type RawSession = {
  sessionId?: unknown;
  title?: unknown;
  dirtyState?: unknown;
  saveMode?: unknown;
  sourceRef?: unknown;
  ownState?: unknown;
};

/**
 * Map a raw session object (from session_store.listSessions) to `SessionItemState`.
 *
 * @param raw - Raw session object from the store.
 * @param activeSessionId - ID of the currently active session.
 * @param liveModel - Live pgnModel from activeSessionRef for the active session; null for inactive sessions.
 */
export const toSessionItem = (
  raw: unknown,
  activeSessionId: string | null,
  liveModel: unknown,
): SessionItemState => {
  const session: RawSession = (raw as RawSession) ?? {};
  const sessionId: string = typeof session.sessionId === "string" ? session.sessionId : "";
  const isActive: boolean = sessionId !== "" && sessionId === activeSessionId;
  // For the active session use the live model so PGN header changes appear immediately.
  // For inactive sessions use the model from their own ownState.
  const ownState = session.ownState as { pgnModel?: unknown } | null | undefined;
  const pgnModel: unknown = (isActive && liveModel != null)
    ? liveModel
    : ownState?.pgnModel;
  const hv = (key: string): string => getHeaderValue(pgnModel, key, "").trim();
  const sourceRef = session.sourceRef as { kind?: unknown; locator?: unknown; recordId?: unknown } | null | undefined;
  const sourceLocator: string = typeof sourceRef?.locator === "string" ? sourceRef.locator : "";
  const sourceGameRef: string = sourceRef
    ? [
        typeof sourceRef.kind === "string" ? sourceRef.kind : "",
        typeof sourceRef.locator === "string" ? sourceRef.locator : "",
        typeof sourceRef.recordId === "string" ? sourceRef.recordId : "",
      ].join(":")
    : "";
  return {
    sessionId,
    title: typeof session.title === "string" ? session.title : sessionId,
    dirtyState: typeof session.dirtyState === "string" ? session.dirtyState : "clean",
    saveMode: session.saveMode === "manual" ? "manual" : "auto",
    isActive,
    isUnsaved: !session.sourceRef,
    white: hv("White"),
    black: hv("Black"),
    event: hv("Event"),
    date: hv("Date"),
    sourceLocator,
    sourceGameRef,
  };
};

/** Map a raw resource tab to `ResourceTabSnapshot`. */
type RawResourceTab = {
  tabId?: unknown;
  title?: unknown;
  resourceRef?: { kind?: unknown; locator?: unknown } | null;
};

export const toResourceTab = (raw: unknown): ResourceTabSnapshot | null => {
  const tab: RawResourceTab = (raw as RawResourceTab) ?? {};
  const tabId: string = typeof tab.tabId === "string" ? tab.tabId : "";
  if (!tabId) return null;
  return {
    tabId,
    title: typeof tab.title === "string" ? tab.title : "",
    kind:
      tab.resourceRef && typeof tab.resourceRef.kind === "string"
        ? tab.resourceRef.kind
        : "",
    locator:
      tab.resourceRef && typeof tab.resourceRef.locator === "string"
        ? tab.resourceRef.locator
        : "",
  };
};

// ── Services bundle ─────────────────────────────────────────────────────────────

export type ServicesBundle = {
  /** Dispatch all current state into the React store. */
  render: () => void;
  sharedState: AppState;
  activeSessionRef: ActiveSessionRef;
  pgnRuntime: PgnRuntime;
  history: HistoryCapabilities;
  applyModelUpdate: ApplyModelUpdate;
  resources: ResourcesCapabilities;
  resourceViewer: ResourceViewer;
  sessionModel: SessionModel;
  sessionStore: SessionStore;
  sessionPersistence: SessionPersistence;
  moveLookup: MoveLookup;
  navigation: Navigation;
};

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create and wire all service instances once.
 *
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @returns Fully wired services bundle.
 */
export function createAppServicesBundle(
  dispatchRef: { current: Dispatch<AppAction> },
): ServicesBundle {
  // ── Shared (non-session) state ───────────────────────────────────────────
  const sharedState: AppState = createInitialAppState();
  sharedState.playerStore = bundledPlayers as PlayerRecord[];

  // ── Active session ref ────────────────────────────────────────────────────
  // Starts pointing at a blank object; replaced by openSession / switchToSession.
  const activeSessionRef: ActiveSessionRef = {
    current: createEmptyGameSessionState(),
  };

  // ── Workspace snapshot debounce ───────────────────────────────────────────
  let workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Forward references ────────────────────────────────────────────────────
  let historyRef: HistoryCapabilities | null = null;
  let sessionStoreRef: SessionStore | null = null;
  let sessionPersistenceRef: SessionPersistence | null = null;
  let moveLookupRef: MoveLookup | null = null;

  // ── Translator (lazy: uses sharedState.locale) ───────────────────────────
  const getTranslator = (): ((key: string, fallback?: string) => string) =>
    createTranslator(sharedState.locale || DEFAULT_LOCALE);

  // ── Stable render: syncs active session + shared state into React ─────────
  const render = (): void => {
    const g: GameSessionState = activeSessionRef.current;
    const s: AppState = sharedState;
    const d: Dispatch<AppAction> = dispatchRef.current;

    // PGN / game state
    if (g.pgnModel) {
      d({
        type: "set_pgn",
        pgnText: g.pgnText,
        pgnModel: g.pgnModel as PgnModel,
        moves: Array.isArray(g.moves) ? g.moves : [],
      });
    }
    d({ type: "set_current_ply", ply: Number(g.currentPly) || 0 });
    d({ type: "set_move_count", count: Array.isArray(g.moves) ? g.moves.length : 0 });

    // For mainline navigation (no boardPreview active), sync selectedMoveId with
    // currentPly so the text editor highlights the current board position.
    let effectiveSelectedMoveId: string | null = g.selectedMoveId;
    const bpCheck = g.boardPreview as { fen?: string } | null;
    if (!bpCheck?.fen) {
      const ply: number = Number(g.currentPly) || 0;
      if (ply === 0) {
        effectiveSelectedMoveId = null;
      } else {
        const positions = g.movePositionById as Record<string, { mainlinePly?: unknown }> | null;
        if (positions) {
          for (const [moveId, record] of Object.entries(positions)) {
            if (record.mainlinePly === ply) {
              effectiveSelectedMoveId = moveId;
              break;
            }
          }
        }
      }
    }
    d({ type: "set_selected_move_id", id: effectiveSelectedMoveId });
    d({
      type: "set_undo_redo",
      undoDepth: Array.isArray(g.undoStack) ? g.undoStack.length : 0,
      redoDepth: Array.isArray(g.redoStack) ? g.redoStack.length : 0,
    });
    d({ type: "set_status_message", message: String(g.statusMessage || "") });
    d({ type: "set_error_message", message: String(g.errorMessage || "") });
    d({ type: "set_pending_focus_comment_id", id: g.pendingFocusCommentId });

    // Session list
    const store: SessionStore | null = sessionStoreRef;
    if (store) {
      const rawSessions: unknown[] = store.listSessions() as unknown[];
      const sessions: SessionItemState[] = rawSessions
        .map((raw: unknown): SessionItemState =>
          toSessionItem(raw, s.activeSessionId, g.pgnModel ?? null))
        .filter((item: SessionItemState): boolean => item.sessionId !== "");
      d({ type: "set_sessions", sessions, activeSessionId: s.activeSessionId });
    }

    // Resource tabs
    const resourceTabs: unknown[] = Array.isArray(s.resourceViewerTabs)
      ? s.resourceViewerTabs
      : [];
    const tabs: ResourceTabSnapshot[] = resourceTabs
      .map(toResourceTab)
      .filter((t: ResourceTabSnapshot | null): t is ResourceTabSnapshot => t !== null);
    d({
      type: "set_resource_tabs",
      tabs,
      activeTabId: typeof s.activeResourceTabId === "string" ? s.activeResourceTabId : null,
    });

    // Active resource tab data (row count + error).
    const activeTab: unknown = resourceTabs
      .find((t: unknown): boolean => (t as { tabId?: string }).tabId === s.activeResourceTabId);
    const activeRowCount: number = Array.isArray((activeTab as { rows?: unknown } | undefined)?.rows)
      ? (activeTab as { rows: unknown[] }).rows.length
      : 0;
    const activeTabError: string =
      typeof (activeTab as { errorMessage?: unknown } | undefined)?.errorMessage === "string"
        ? (activeTab as { errorMessage: string }).errorMessage
        : "";
    d({ type: "set_active_resource_data", rowCount: activeRowCount, errorMessage: activeTabError });

    // Active source kind
    d({ type: "set_active_source_kind", kind: String(s.activeSourceKind || "directory") });

    // Board preview (variation move FEN override)
    const bp = g.boardPreview as { fen?: string; lastMove?: [string, string] | null } | null;
    d({
      type: "set_board_preview",
      preview: bp?.fen ? { fen: String(bp.fen), lastMove: bp.lastMove ?? null } : null,
    });

    // Persist workspace snapshot with a short debounce so rapid successive
    // renders (e.g. during animation) collapse into a single write.
    if (workspaceSaveTimer !== null) clearTimeout(workspaceSaveTimer);
    workspaceSaveTimer = setTimeout((): void => {
      workspaceSaveTimer = null;
      saveWorkspaceSnapshot(sharedState);
    }, 500);
  };

  // ── PGN runtime ──────────────────────────────────────────────────────────
  const pgnRuntime: PgnRuntime = createPgnRuntimeCapabilities({
    sessionRef: activeSessionRef,
    pgnInput: null,
    t: getTranslator(),
    defaultPgn: "",
    parsePgnToModelFn: (source: string): unknown =>
      ensureRequiredPgnHeaders(parsePgnToModel(source)),
    serializeModelToPgnFn: serializeModelToPgn,
    buildMovePositionByIdFn: (model: unknown): Record<string, unknown> =>
      buildMovePositionById(
        model as Parameters<typeof buildMovePositionById>[0],
      ) as Record<string, unknown>,
    stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
    onRender: render,
    onRecordHistory: (): void => {
      const h: HistoryCapabilities | null = historyRef;
      if (!h) return;
      h.pushUndoSnapshot(h.captureEditorSnapshot());
      activeSessionRef.current.redoStack = [];
      sessionStoreRef?.updateActiveSessionMeta({ dirtyState: "dirty" });
    },
    onScheduleAutosave: (): void => {
      sessionPersistenceRef?.scheduleAutosaveForActiveSession();
    },
  });

  // ── Apply PGN model update ────────────────────────────────────────────────
  const applyModelUpdate: ApplyModelUpdate = createApplyPgnModelUpdate({
    pgnRuntimeCapabilities: pgnRuntime,
    sessionRef: activeSessionRef,
    normalizeX2StyleValue,
  });

  // ── History ───────────────────────────────────────────────────────────────
  const history: HistoryCapabilities = createEditorHistoryCapabilities({
    sessionRef: activeSessionRef,
    pgnInput: null,
    onSyncChessParseState: pgnRuntime.syncChessParseState,
    onRender: render,
  });
  historyRef = history;

  // ── Resources ─────────────────────────────────────────────────────────────
  const resources: ResourcesCapabilities = createResourcesCapabilities({
    state: sharedState as Parameters<typeof createResourcesCapabilities>[0]["state"],
    t: getTranslator(),
    onSetSaveStatus: (status?: string, _kind?: string): void => {
      activeSessionRef.current.statusMessage = status ?? "";
      render();
    },
    onApplyRuntimeConfig: (config: Record<string, unknown>): void => {
      sharedState.appConfig = config;
    },
    onLoadPgn: pgnRuntime.loadPgn,
    onInitializeWithDefaultPgn: pgnRuntime.initializeWithDefaultPgn,
    pgnInput: null,
  });

  // Register the listGamesForResource service for ResourceViewer.tsx.
  setResourceLoaderService(
    resources.listGamesForResource as Parameters<typeof setResourceLoaderService>[0],
  );

  // ── Resource viewer ───────────────────────────────────────────────────────
  const resourceViewer: ResourceViewer = createResourceViewerCapabilities({
    state: sharedState as Parameters<typeof createResourceViewerCapabilities>[0]["state"],
    t: getTranslator(),
    listGamesForResource: resources.listGamesForResource,
  });

  // ── Session model ─────────────────────────────────────────────────────────
  const sessionModel: SessionModel = createGameSessionModel({
    parsePgnToModelFn: parsePgnToModel,
    serializeModelToPgnFn: serializeModelToPgn,
    ensureRequiredPgnHeadersFn: ensureRequiredPgnHeaders,
    buildMovePositionByIdFn: (model: unknown): Record<string, unknown> =>
      buildMovePositionById(
        model as Parameters<typeof buildMovePositionById>[0],
      ) as Record<string, unknown>,
    stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
    getHeaderValueFn: (model: unknown, key: string, fallback: string): string =>
      getHeaderValue(model, key, fallback),
    t: getTranslator(),
  });

  // ── Session store ─────────────────────────────────────────────────────────
  const sessionStore: SessionStore = createGameSessionStore({
    state: sharedState as Parameters<typeof createGameSessionStore>[0]["state"],
    activeSessionRef,
  });
  sessionStoreRef = sessionStore;

  // ── Session persistence ───────────────────────────────────────────────────
  const sessionPersistence: SessionPersistence = createSessionPersistenceService({
    state: sharedState as Parameters<typeof createSessionPersistenceService>[0]["state"],
    t: getTranslator(),
    getActiveSession: sessionStore.getActiveSession as Parameters<
      typeof createSessionPersistenceService
    >[0]["getActiveSession"],
    updateActiveSessionMeta: sessionStore.updateActiveSessionMeta as Parameters<
      typeof createSessionPersistenceService
    >[0]["updateActiveSessionMeta"],
    getPgnText: (): string => activeSessionRef.current.pgnText,
    saveBySourceRef: resources.saveGameBySourceRef as Parameters<
      typeof createSessionPersistenceService
    >[0]["saveBySourceRef"],
    ensureSourceForActiveSession: async (_session: unknown, pgnText: string): Promise<{ sourceRef?: unknown; revisionToken?: string } | null> => {
      const rawTabs = Array.isArray(sharedState.resourceViewerTabs) ? sharedState.resourceViewerTabs : [];
      const activeTab = rawTabs.find(
        (t: unknown) => (t as { tabId?: string }).tabId === sharedState.activeResourceTabId,
      );
      const resourceRef = (activeTab as { resourceRef?: { kind?: string; locator?: string } } | undefined)?.resourceRef;
      if (!resourceRef?.locator) return null;
      const created = await resources.createGameInResource(
        { kind: resourceRef.kind, locator: resourceRef.locator },
        pgnText,
      );
      return { sourceRef: created.sourceRef, revisionToken: String(created.revisionToken || "") };
    },
    onSetSaveStatus: (status?: string, _kind?: string): void => {
      activeSessionRef.current.statusMessage = status ?? "";
      render();
    },
  });
  sessionPersistenceRef = sessionPersistence;

  // ── Move lookup ───────────────────────────────────────────────────────────
  const moveLookup: MoveLookup = createMoveLookupCapabilities({
    sessionRef: activeSessionRef,
    buildMovePositionByIdFn: buildMovePositionById,
    resolveMovePositionByIdFn: resolveMovePositionById,
  });
  moveLookupRef = moveLookup;

  // ── Board capabilities (sound) ────────────────────────────────────────────
  const moveSoundPlayer = createMoveSoundPlayer({
    isSoundEnabled: (): boolean => Boolean(sharedState.soundEnabled),
  });

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigation: Navigation = createBoardNavigationCapabilities({
    sessionRef: activeSessionRef,
    getDelayMs: (): number => Number(sharedState.moveDelayMs) || 220,
    getMovePositionById: (
      moveId: string | null,
      options: { allowResolve: boolean },
    ): MovePositionRecord | null => {
      const result: MovePositionRecord | null = moveLookupRef?.getMovePositionById(
        moveId,
        options,
      ) as MovePositionRecord | null;
      return result;
    },
    selectMoveById: (moveId: string): boolean => {
      const g = activeSessionRef.current;
      const pos = g.movePositionById?.[moveId] as
        | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
        | undefined;
      if (!pos) return false;
      g.selectedMoveId = moveId;
      if (pos.mainlinePly != null && Number.isFinite(pos.mainlinePly)) {
        g.boardPreview = null;
      } else {
        g.boardPreview = pos.fen
          ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../board/runtime").BoardPreviewLike)
          : null;
      }
      render();
      return true;
    },
    findCommentIdAroundMove: (moveId: string, position: "before" | "after"): string | null =>
      findExistingCommentIdAroundMove(activeSessionRef.current.pgnModel, moveId, position),
    focusCommentById: (commentId: string): boolean => {
      activeSessionRef.current.pendingFocusCommentId = commentId;
      return true;
    },
    playMoveSound: moveSoundPlayer.playMoveSound,
    render,
  });

  return {
    render,
    sharedState,
    activeSessionRef,
    pgnRuntime,
    history,
    applyModelUpdate,
    resources,
    resourceViewer,
    sessionModel,
    sessionStore,
    sessionPersistence,
    moveLookup,
    navigation,
  };
}
