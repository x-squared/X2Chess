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
import { createBoardCapabilities } from "../board";
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
import { createTranslator, resolveLocale } from "../app_shell/i18n";
import {
  DEFAULT_LOCALE,
  DEFAULT_PGN,
  createInitialAppState,
  type PlayerRecord,
  type AppState,
} from "../app_shell/app_state";
import { setResourceLoaderService } from "../services/resource_loader";
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
export const toDevTab = (raw: unknown): "ast" | "dom" | "pgn" => {
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
  snapshot?: unknown;
};

export const toSessionItem = (raw: unknown, activeSessionId: string | null): SessionItemState => {
  const session: RawSession = (raw as RawSession) ?? {};
  const sessionId: string = typeof session.sessionId === "string" ? session.sessionId : "";
  const pgnModel: unknown = (session.snapshot as { pgnModel?: unknown } | null)?.pgnModel;
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
    isActive: sessionId !== "" && sessionId === activeSessionId,
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
  /** Dispatch all current legacy state fields into the React store. */
  render: () => void;
  legacyState: AppState;
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

    // For mainline navigation (no boardPreview active), keep selectedMoveId in sync with
    // currentPly so the text editor highlights the move at the current board position.
    let effectiveSelectedMoveId: string | null = s.selectedMoveId;
    const bpCheck = s.boardPreview as { fen?: string } | null;
    if (!bpCheck?.fen) {
      const ply: number = Number(s.currentPly) || 0;
      if (ply === 0) {
        effectiveSelectedMoveId = null;
      } else {
        const positions = s.movePositionById as Record<string, { mainlinePly?: unknown }> | null;
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
      undoDepth: Array.isArray(s.undoStack) ? s.undoStack.length : 0,
      redoDepth: Array.isArray(s.redoStack) ? s.redoStack.length : 0,
    });
    d({ type: "set_status_message", message: String(s.statusMessage || "") });
    d({ type: "set_error_message", message: String(s.errorMessage || "") });
    d({ type: "set_pending_focus_comment_id", id: s.pendingFocusCommentId });
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

    // Board preview (variation move FEN override)
    const bp = s.boardPreview as { fen?: string; lastMove?: [string, string] | null } | null;
    d({
      type: "set_board_preview",
      preview: bp?.fen ? { fen: String(bp.fen), lastMove: bp.lastMove ?? null } : null,
    });
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

  // Register the listGamesForResource service for ResourceViewer.tsx.
  setResourceLoaderService(
    resources.listGamesForResource as Parameters<typeof setResourceLoaderService>[0],
  );

  // ── Resource viewer ───────────────────────────────────────────────────
  const resourceViewer: ResourceViewer = createResourceViewerCapabilities({
    state: legacyState as Parameters<typeof createResourceViewerCapabilities>[0]["state"],
    t: getTranslator(),
    listGamesForResource: resources.listGamesForResource,
  });

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
    ensureSourceForActiveSession: async (_session: unknown, pgnText: string): Promise<{ sourceRef?: unknown; revisionToken?: string } | null> => {
      // Save to the currently active resource tab (if any).
      const rawTabs = Array.isArray(legacyState.resourceViewerTabs) ? legacyState.resourceViewerTabs : [];
      const activeTab = rawTabs.find(
        (t: unknown) => (t as { tabId?: string }).tabId === legacyState.activeResourceTabId,
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
      const pos = legacyState.movePositionById?.[moveId] as
        | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
        | undefined;
      if (!pos) return false;
      legacyState.selectedMoveId = moveId;
      if (pos.mainlinePly != null && Number.isFinite(pos.mainlinePly)) {
        legacyState.boardPreview = null;
      } else {
        legacyState.boardPreview = pos.fen
          ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../board/runtime").BoardPreviewLike)
          : null;
      }
      render();
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
    render,
    legacyState,
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
