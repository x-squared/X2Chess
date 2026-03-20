/**
 * useAppStartup — initialises all application services and wires them to the
 * React reducer (Slice 7).
 *
 * Replaces `RuntimeHost` + `start_runtime.ts` + all legacy `runtime/` bootstrap
 * files with a single hook that:
 *  1. Creates a mutable `AppState` legacy object (held in a `useRef`) that the
 *     pure-logic service modules can mutate as before.
 *  2. Wires every service's `onRender` callback to `syncStateToReact` which
 *     dispatches the updated legacy state into the React `useReducer` store.
 *  3. Loads persisted preferences from `localStorage` on mount.
 *  4. Initialises the default PGN and creates the first game session.
 *  5. Returns an `AppStartupServices` object consumed by `ServiceContext`.
 *
 * Integration API:
 * - `const services = useAppStartup()` — call once in `AppShell`; pass the
 *   result to `<ServiceContext.Provider value={services}>`.
 *
 * Configuration API:
 * - No props or parameters.  All configuration comes from `localStorage` and
 *   compile-time constants (`DEFAULT_PGN`, `DEFAULT_LOCALE`).
 *
 * Communication API:
 * - Inbound: `dispatch` from `useAppContext()`.
 * - Outbound: `AppStartupServices` callbacks; the legacy services call
 *   `syncStateToReact()` which calls `dispatch()` for each changed field.
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import bundledPlayers from "../../data/players.json";
import {
  parsePgnToModel,
  serializeModelToPgn,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getHeaderValue,
  getX2StyleFromModel,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  removeCommentById,
  setCommentTextById,
  applyDefaultIndentDirectives,
} from "../editor";
import {
  buildMovePositionById,
  resolveMovePositionById,
  stripAnnotationsForBoardParser,
} from "../board/move_position";
import { createBoardCapabilities } from "../board";
import { createMoveSoundPlayer } from "../board/move_sound";
import { createBoardNavigationCapabilities } from "../board/navigation";
import { createMoveLookupCapabilities } from "../board/move_lookup";
import { createPgnRuntimeCapabilities } from "../editor/pgn_runtime";
import { createEditorHistoryCapabilities } from "../editor/history";
import { createApplyPgnModelUpdate } from "../runtime/pgn_model_update";
import { createResourcesCapabilities } from "../resources";
import { createGameSessionModel } from "../game_sessions/session_model";
import { createGameSessionStore } from "../game_sessions/session_store";
import { createSessionPersistenceService } from "../game_sessions/session_persistence";
import { createTranslator, resolveLocale, SUPPORTED_LOCALES } from "../app_shell/i18n";
import { normalizeGameInfoHeaderValue } from "../app_shell/game_info";
import { setHeaderValue } from "../model";
import {
  DEFAULT_LOCALE,
  DEFAULT_APP_MODE,
  DEFAULT_PGN,
  createInitialAppState,
  type PlayerRecord,
  type AppState,
} from "../app_shell/app_state";
import {
  resolveBuildAppMode,
  readBootstrapUiPrefs,
  resolveInitialLocale,
  MODE_STORAGE_KEY,
} from "../runtime/bootstrap_prefs";
import { setResourceLoaderService } from "../services/resource_loader";
import { useAppContext } from "../state/app_context";
import type { AppStartupServices } from "../state/ServiceContext";
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

// ── State-to-React sync helpers ────────────────────────────────────────────────

/** Normalise a raw devTab string into the accepted union. */
const toDevTab = (raw: unknown): "ast" | "dom" | "pgn" => {
  if (raw === "dom" || raw === "pgn") return raw;
  return "ast";
};

/** Map a raw session object (from session_store.listSessions) to `SessionItemState`. */
type RawSession = {
  sessionId?: unknown;
  title?: unknown;
  dirtyState?: unknown;
  saveMode?: unknown;
  sourceRef?: unknown;
};

const toSessionItem = (raw: unknown, activeSessionId: string | null): SessionItemState => {
  const session: RawSession = (raw as RawSession) ?? {};
  const sessionId: string = typeof session.sessionId === "string" ? session.sessionId : "";
  return {
    sessionId,
    title: typeof session.title === "string" ? session.title : sessionId,
    dirtyState: typeof session.dirtyState === "string" ? session.dirtyState : "clean",
    saveMode: session.saveMode === "manual" ? "manual" : "auto",
    isActive: sessionId !== "" && sessionId === activeSessionId,
    isUnsaved: !session.sourceRef,
  };
};

/** Map a raw resource tab to `ResourceTabSnapshot`. */
type RawResourceTab = {
  tabId?: unknown;
  title?: unknown;
  resourceRef?: { kind?: unknown; locator?: unknown } | null;
};

const toResourceTab = (raw: unknown): ResourceTabSnapshot | null => {
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

// ── All service refs held together ─────────────────────────────────────────────

type ServicesBundle = {
  legacyState: AppState;
  pgnRuntime: PgnRuntime;
  history: HistoryCapabilities;
  applyModelUpdate: ApplyModelUpdate;
  resources: ResourcesCapabilities;
  sessionModel: SessionModel;
  sessionStore: SessionStore;
  sessionPersistence: SessionPersistence;
  moveLookup: MoveLookup;
  navigation: Navigation;
};

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create and wire all service instances once.
 * Uses closure over `dispatchRef` so every `render()` call dispatches through
 * the latest `dispatch` without needing to recreate service instances.
 */
function createServices(dispatchRef: { current: Dispatch<AppAction> }): ServicesBundle {
  // ── Legacy mutable state ─────────────────────────────────────────────
  const legacyState: AppState = createInitialAppState(parsePgnToModel);
  legacyState.playerStore = bundledPlayers as PlayerRecord[];

  // ── Forward references (resolved via closure after creation) ─────────
  let historyRef: HistoryCapabilities | null = null;
  let sessionStoreRef: SessionStore | null = null;
  let sessionPersistenceRef: SessionPersistence | null = null;
  let moveLookupRef: MoveLookup | null = null;

  // ── Translator (lazy: uses legacyState.locale) ───────────────────────
  const getTranslator = (): ((key: string, fallback?: string) => string) =>
    createTranslator(legacyState.locale || DEFAULT_LOCALE);

  // ── Stable render: syncs all legacy state fields into React dispatch ──
  const render = (): void => {
    const s: AppState = legacyState;
    const d: Dispatch<AppAction> = dispatchRef.current;

    // PGN state
    if (s.pgnModel) {
      d({
        type: "set_pgn",
        pgnText: s.pgnText,
        pgnModel: s.pgnModel as PgnModel,
        moves: Array.isArray(s.moves) ? s.moves : [],
      });
    }
    d({ type: "set_current_ply", ply: Number(s.currentPly) || 0 });
    d({ type: "set_move_count", count: Array.isArray(s.moves) ? s.moves.length : 0 });
    d({ type: "set_selected_move_id", id: s.selectedMoveId });
    d({
      type: "set_undo_redo",
      undoDepth: Array.isArray(s.undoStack) ? s.undoStack.length : 0,
      redoDepth: Array.isArray(s.redoStack) ? s.redoStack.length : 0,
    });
    d({ type: "set_status_message", message: String(s.statusMessage || "") });
    d({ type: "set_error_message", message: String(s.errorMessage || "") });
    d({ type: "set_pending_focus_comment_id", id: s.pendingFocusCommentId });
    d({ type: "set_game_info_editor_open", open: Boolean(s.isGameInfoEditorOpen) });
    d({ type: "set_layout_mode", mode: normalizeX2StyleValue(s.pgnLayoutMode) });

    // Shell state
    d({ type: "set_is_menu_open", open: Boolean(s.isMenuOpen) });
    d({ type: "set_dev_dock_open", open: Boolean(s.isDevDockOpen) });
    d({ type: "set_active_dev_tab", tab: toDevTab(s.activeDevTab) });
    d({ type: "set_dev_tools_enabled", enabled: Boolean(s.isDeveloperToolsEnabled) });
    d({ type: "set_locale", locale: String(s.locale || DEFAULT_LOCALE) });
    d({ type: "set_move_delay_ms", value: Number(s.moveDelayMs) || 220 });
    d({ type: "set_sound_enabled", enabled: Boolean(s.soundEnabled) });

    // Session state
    const store: SessionStore | null = sessionStoreRef;
    if (store) {
      const rawSessions: unknown[] = store.listSessions() as unknown[];
      const sessions: SessionItemState[] = rawSessions
        .map((raw: unknown): SessionItemState => toSessionItem(raw, s.activeSessionId))
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

    // Active source kind
    d({ type: "set_active_source_kind", kind: String(s.activeSourceKind || "directory") });
  };

  // ── PGN runtime ──────────────────────────────────────────────────────
  const pgnRuntime: PgnRuntime = createPgnRuntimeCapabilities({
    state: legacyState as Record<string, unknown>,
    pgnInput: null,
    t: getTranslator(),
    defaultPgn: DEFAULT_PGN,
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
      legacyState.redoStack = [];
      sessionStoreRef?.updateActiveSessionMeta({ dirtyState: "dirty" });
    },
    onScheduleAutosave: (): void => {
      sessionPersistenceRef?.scheduleAutosaveForActiveSession();
    },
  });

  // ── Apply PGN model update ────────────────────────────────────────────
  const applyModelUpdate: ApplyModelUpdate = createApplyPgnModelUpdate({
    pgnRuntimeCapabilities: pgnRuntime,
    state: legacyState as Parameters<typeof createApplyPgnModelUpdate>[0]["state"],
    normalizeX2StyleValue,
    getX2StyleFromModel,
  });

  // ── History ───────────────────────────────────────────────────────────
  const history: HistoryCapabilities = createEditorHistoryCapabilities({
    state: legacyState as Record<string, unknown>,
    pgnInput: null,
    onSyncChessParseState: pgnRuntime.syncChessParseState,
    onRender: render,
  });
  historyRef = history;

  // ── Resources ─────────────────────────────────────────────────────────
  const resources: ResourcesCapabilities = createResourcesCapabilities({
    state: legacyState as Parameters<typeof createResourcesCapabilities>[0]["state"],
    t: getTranslator(),
    onSetSaveStatus: (status?: string, _kind?: string): void => {
      legacyState.statusMessage = status ?? "";
      render();
    },
    onApplyRuntimeConfig: (config: Record<string, unknown>): void => {
      legacyState.appConfig = config;
    },
    onLoadPgn: pgnRuntime.loadPgn,
    onInitializeWithDefaultPgn: pgnRuntime.initializeWithDefaultPgn,
    pgnInput: null,
  });

  // Register the listGamesForResource service for ResourceViewer.tsx (Slice 5 pattern).
  setResourceLoaderService(
    resources.listGamesForResource as Parameters<typeof setResourceLoaderService>[0],
  );

  // ── Session model ─────────────────────────────────────────────────────
  const sessionModel: SessionModel = createGameSessionModel({
    state: legacyState as Record<string, unknown>,
    pgnInput: null,
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

  // ── Session store ─────────────────────────────────────────────────────
  const sessionStore: SessionStore = createGameSessionStore({
    state: legacyState as Parameters<typeof createGameSessionStore>[0]["state"],
    captureActiveSessionSnapshot: sessionModel.captureActiveSessionSnapshot,
    applySessionSnapshotToState: sessionModel.applySessionSnapshotToState,
    disposeSessionSnapshot: sessionModel.disposeSessionSnapshot,
  });
  sessionStoreRef = sessionStore;

  // ── Session persistence ───────────────────────────────────────────────
  const sessionPersistence: SessionPersistence = createSessionPersistenceService({
    state: legacyState as Record<string, unknown>,
    t: getTranslator(),
    getActiveSession: sessionStore.getActiveSession as Parameters<
      typeof createSessionPersistenceService
    >[0]["getActiveSession"],
    updateActiveSessionMeta: sessionStore.updateActiveSessionMeta as Parameters<
      typeof createSessionPersistenceService
    >[0]["updateActiveSessionMeta"],
    getPgnText: (): string => legacyState.pgnText,
    saveBySourceRef: resources.saveGameBySourceRef as Parameters<
      typeof createSessionPersistenceService
    >[0]["saveBySourceRef"],
    ensureSourceForActiveSession: async (_session: unknown, _pgnText: string): Promise<null> => null,
    onSetSaveStatus: (status?: string, _kind?: string): void => {
      legacyState.statusMessage = status ?? "";
      render();
    },
  });
  sessionPersistenceRef = sessionPersistence;

  // ── Move lookup ───────────────────────────────────────────────────────
  const moveLookup: MoveLookup = createMoveLookupCapabilities({
    state: legacyState as Parameters<typeof createMoveLookupCapabilities>[0]["state"],
    buildMovePositionByIdFn: buildMovePositionById,
    resolveMovePositionByIdFn: resolveMovePositionById,
  });
  moveLookupRef = moveLookup;

  // ── Board capabilities (sound) ────────────────────────────────────────
  const boardCaps = createBoardCapabilities(legacyState as { currentPly: number; moves: string[] });
  const moveSoundPlayer = createMoveSoundPlayer({
    isSoundEnabled: (): boolean => Boolean(legacyState.soundEnabled),
  });

  // ── Navigation ────────────────────────────────────────────────────────
  const navigation: Navigation = createBoardNavigationCapabilities({
    state: legacyState as Parameters<typeof createBoardNavigationCapabilities>[0]["state"],
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
      const pos = legacyState.movePositionById?.[moveId];
      if (!pos) return false;
      legacyState.selectedMoveId = moveId;
      return true;
    },
    findCommentIdAroundMove: (moveId: string, position: "before" | "after"): string | null =>
      findExistingCommentIdAroundMove(legacyState.pgnModel, moveId, position),
    focusCommentById: (commentId: string): boolean => {
      legacyState.pendingFocusCommentId = commentId;
      return true;
    },
    playMoveSound: moveSoundPlayer.playMoveSound,
    render,
  });

  void boardCaps; // used indirectly; suppress unused warning

  return {
    legacyState,
    pgnRuntime,
    history,
    applyModelUpdate,
    resources,
    sessionModel,
    sessionStore,
    sessionPersistence,
    moveLookup,
    navigation,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Initialise all application services on mount and return stable service callbacks.
 *
 * Must be called inside the `AppProvider` tree (needs `useAppContext`).
 */
export const useAppStartup = (): AppStartupServices => {
  const { dispatch } = useAppContext();

  // Keep a mutable ref to dispatch so the stable render callback never goes stale.
  const dispatchRef = useRef<Dispatch<AppAction>>(dispatch);
  dispatchRef.current = dispatch;

  // Lazily create all services once (on first render).
  const bundleRef = useRef<ServicesBundle | null>(null);
  if (bundleRef.current === null) {
    bundleRef.current = createServices(dispatchRef);
  }
  const bundle: ServicesBundle = bundleRef.current;

  // ── Mount effect: load preferences, initialise PGN, open first session ──
  const syncStateToReact = useCallback((): void => {
    // Re-derive the render function from the bundle; dispatch via dispatchRef.
    const s: AppState = bundle.legacyState;
    const d: Dispatch<AppAction> = dispatchRef.current;

    if (s.pgnModel) {
      d({
        type: "set_pgn",
        pgnText: s.pgnText,
        pgnModel: s.pgnModel as PgnModel,
        moves: Array.isArray(s.moves) ? s.moves : [],
      });
    }
    d({ type: "set_current_ply", ply: Number(s.currentPly) || 0 });
    d({ type: "set_move_count", count: Array.isArray(s.moves) ? s.moves.length : 0 });
    d({ type: "set_selected_move_id", id: s.selectedMoveId });
    d({
      type: "set_undo_redo",
      undoDepth: Array.isArray(s.undoStack) ? s.undoStack.length : 0,
      redoDepth: Array.isArray(s.redoStack) ? s.redoStack.length : 0,
    });
    d({ type: "set_status_message", message: String(s.statusMessage || "") });
    d({ type: "set_error_message", message: String(s.errorMessage || "") });
    d({ type: "set_pending_focus_comment_id", id: s.pendingFocusCommentId });
    d({ type: "set_game_info_editor_open", open: Boolean(s.isGameInfoEditorOpen) });
    d({ type: "set_layout_mode", mode: normalizeX2StyleValue(s.pgnLayoutMode) });
    d({ type: "set_is_menu_open", open: Boolean(s.isMenuOpen) });
    d({ type: "set_dev_dock_open", open: Boolean(s.isDevDockOpen) });
    d({ type: "set_active_dev_tab", tab: toDevTab(s.activeDevTab) });
    d({ type: "set_dev_tools_enabled", enabled: Boolean(s.isDeveloperToolsEnabled) });
    d({ type: "set_locale", locale: String(s.locale || DEFAULT_LOCALE) });
    d({ type: "set_move_delay_ms", value: Number(s.moveDelayMs) || 220 });
    d({ type: "set_sound_enabled", enabled: Boolean(s.soundEnabled) });

    const rawSessions: unknown[] = bundle.sessionStore.listSessions() as unknown[];
    const sessions: SessionItemState[] = rawSessions
      .map((raw: unknown): SessionItemState =>
        toSessionItem(raw, s.activeSessionId),
      )
      .filter((item: SessionItemState): boolean => item.sessionId !== "");
    d({ type: "set_sessions", sessions, activeSessionId: s.activeSessionId });

    const resourceTabs: unknown[] = Array.isArray(s.resourceViewerTabs)
      ? s.resourceViewerTabs
      : [];
    const tabs: ResourceTabSnapshot[] = resourceTabs
      .map(toResourceTab)
      .filter((t: ResourceTabSnapshot | null): t is ResourceTabSnapshot => t !== null);
    d({
      type: "set_resource_tabs",
      tabs,
      activeTabId:
        typeof s.activeResourceTabId === "string" ? s.activeResourceTabId : null,
    });
    d({ type: "set_active_source_kind", kind: String(s.activeSourceKind || "directory") });
  }, [bundle]);

  useEffect((): void => {
    const s: AppState = bundle.legacyState;

    // 1. Load persisted preferences.
    const appMode = resolveBuildAppMode(DEFAULT_APP_MODE);
    const prefs = readBootstrapUiPrefs(appMode);
    s.isDeveloperToolsEnabled = prefs.isDeveloperToolsEnabled;
    s.appMode = appMode;

    // 2. Resolve locale.
    s.locale = resolveInitialLocale(resolveLocale, DEFAULT_LOCALE);

    // 3. Load persisted sound/speed prefs.
    const savedSound = window.localStorage?.getItem("x2chess.sound");
    if (savedSound === "false") s.soundEnabled = false;
    const savedSpeed = Number(window.localStorage?.getItem("x2chess.moveDelayMs"));
    if (Number.isFinite(savedSpeed) && savedSpeed >= 0) s.moveDelayMs = savedSpeed;

    // 4. Load persisted layout mode.
    const savedLayout = window.localStorage?.getItem("x2chess.pgnLayout");
    if (savedLayout === "text" || savedLayout === "tree" || savedLayout === "plain") {
      s.pgnLayoutMode = savedLayout;
    }

    // 5. Initialise with default PGN (creates initial session).
    try {
      bundle.pgnRuntime.initializeWithDefaultPgn();
      // Wrap it in a session.
      const initialSnapshot = bundle.sessionModel.captureActiveSessionSnapshot();
      bundle.sessionStore.openSession({
        snapshot: initialSnapshot,
        title: "Game 1",
      });
    } catch (err: unknown) {
      const message: string = err instanceof Error ? err.message : String(err);
      dispatch({ type: "set_error_message", message });
    }

    // 6. Load persisted resource state (optional — resources lazy-load on demand).

    // 7. Sync all computed state to React.
    syncStateToReact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Stable service callbacks ───────────────────────────────────────────
  return useMemo(
    (): AppStartupServices => ({
      // Navigation
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
        void bundle.navigation.gotoPly(bundle.legacyState.moves.length);
      },
      gotoMoveById: (moveId: string): void => {
        const pos = bundle.legacyState.movePositionById?.[moveId] as
          | { mainlinePly?: number }
          | undefined;
        if (pos && typeof pos.mainlinePly === "number") {
          void bundle.navigation.gotoPly(pos.mainlinePly);
        } else {
          bundle.legacyState.selectedMoveId = moveId;
          syncStateToReact();
        }
      },

      // PGN editing
      loadPgnText: (pgnText: string): void => {
        // Set pgnModel first so syncChessParseState can build movePositionById.
        const s: AppState = bundle.legacyState;
        s.pgnText = pgnText;
        s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof s.pgnModel;
        s.currentPly = 0;
        s.selectedMoveId = null;
        bundle.pgnRuntime.syncChessParseState(pgnText);
        syncStateToReact();
      },
      insertComment: (moveId: string, position: "before" | "after"): void => {
        const existing = findExistingCommentIdAroundMove(
          bundle.legacyState.pgnModel,
          moveId,
          position,
        );
        if (existing) {
          bundle.legacyState.pendingFocusCommentId = existing;
          syncStateToReact();
          return;
        }
        const newModel = insertCommentAroundMove(
          bundle.legacyState.pgnModel,
          moveId,
          position,
        );
        bundle.applyModelUpdate(newModel, null, { recordHistory: true });
      },
      saveCommentText: (commentId: string, text: string): void => {
        const newModel = setCommentTextById(
          bundle.legacyState.pgnModel,
          commentId,
          text,
        );
        if (newModel) {
          bundle.applyModelUpdate(newModel, null, { recordHistory: false });
        }
      },
      applyDefaultIndent: (): void => {
        const newModel = applyDefaultIndentDirectives(bundle.legacyState.pgnModel);
        if (newModel) {
          bundle.applyModelUpdate(newModel, null, { recordHistory: true });
        }
      },
      updateGameInfoHeader: (key: string, rawValue: string): void => {
        const normalizedValue: string = normalizeGameInfoHeaderValue(key, rawValue);
        const newModel = setHeaderValue(
          bundle.legacyState.pgnModel as PgnModel,
          key,
          normalizedValue,
        );
        bundle.applyModelUpdate(newModel, null, { recordHistory: true });
      },

      // History
      undo: (): void => {
        bundle.history.performUndo();
      },
      redo: (): void => {
        bundle.history.performRedo();
      },

      // Sessions
      switchSession: (sessionId: string): void => {
        const switched: boolean = bundle.sessionStore.switchToSession(sessionId);
        if (switched) syncStateToReact();
      },
      closeSession: (sessionId: string): void => {
        const result = bundle.sessionStore.closeSession(sessionId);
        if (result.closed) {
          if (result.emptyAfterClose) {
            // Re-create a default session after closing the last one.
            bundle.pgnRuntime.initializeWithDefaultPgn();
            const snap = bundle.sessionModel.captureActiveSessionSnapshot();
            bundle.sessionStore.openSession({ snapshot: snap, title: "Game 1" });
          }
          syncStateToReact();
        }
      },

      // Shell state
      setMenuOpen: (open: boolean): void => {
        bundle.legacyState.isMenuOpen = open;
        dispatch({ type: "set_is_menu_open", open });
      },
      setDevDockOpen: (open: boolean): void => {
        bundle.legacyState.isDevDockOpen = open;
        dispatch({ type: "set_dev_dock_open", open });
        window.localStorage?.setItem(MODE_STORAGE_KEY, String(open));
      },
      setActiveDevTab: (tab: "ast" | "dom" | "pgn"): void => {
        bundle.legacyState.activeDevTab = tab;
        bundle.legacyState.isDevDockOpen = true;
        dispatch({ type: "set_active_dev_tab", tab });
        dispatch({ type: "set_dev_dock_open", open: true });
      },
      setLayoutMode: (mode: "plain" | "text" | "tree"): void => {
        bundle.legacyState.pgnLayoutMode = mode;
        dispatch({ type: "set_layout_mode", mode });
        window.localStorage?.setItem("x2chess.pgnLayout", mode);
      },
      setLocale: (locale: string): void => {
        const resolved: string = resolveLocale(locale);
        bundle.legacyState.locale = resolved;
        dispatch({ type: "set_locale", locale: resolved });
        window.localStorage?.setItem("x2chess.locale", resolved);
      },
      setMoveDelayMs: (value: number): void => {
        bundle.legacyState.moveDelayMs = value;
        dispatch({ type: "set_move_delay_ms", value });
        window.localStorage?.setItem("x2chess.moveDelayMs", String(value));
      },
      setSoundEnabled: (enabled: boolean): void => {
        bundle.legacyState.soundEnabled = enabled;
        dispatch({ type: "set_sound_enabled", enabled });
        window.localStorage?.setItem("x2chess.sound", String(enabled));
      },
      setDeveloperToolsEnabled: (enabled: boolean): void => {
        bundle.legacyState.isDeveloperToolsEnabled = enabled;
        dispatch({ type: "set_dev_tools_enabled", enabled });
        window.localStorage?.setItem(MODE_STORAGE_KEY, String(enabled));
      },
      setSaveMode: (mode: string): void => {
        const saveMode: "auto" | "manual" = mode === "manual" ? "manual" : "auto";
        bundle.legacyState.defaultSaveMode = saveMode;
        bundle.sessionStore.updateActiveSessionMeta({ saveMode });
        syncStateToReact();
      },
      saveActiveGameNow: (): void => {
        void bundle.sessionPersistence.persistActiveSessionNow();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, dispatch, syncStateToReact],
  );
};
