/**
 * createAppServicesBundle — constructs and wires all application service
 * instances once.
 *
 * Integration API:
 * - `createAppServicesBundle(dispatchRef, stateRef)` — call once from `useAppStartup`.
 *   Uses closure over `dispatchRef`/`stateRef` so callbacks always use the latest
 *   React dispatch and state without recreating service instances.
 *
 * Configuration API:
 * - All configuration comes from `localStorage` and compile-time constants.
 *
 * Communication API:
 * - Inbound: `dispatchRef.current` is updated by `useAppStartup` on every render.
 * - Outbound: Service callbacks dispatch fine-grained actions directly.
 *   Session-list changes are dispatched by `onSessionsChanged`.
 *   Resource-viewer changes are dispatched by `onTabsChanged`.
 *   PGN/session state is dispatched by `onPgnChange` via a canonical session
 *   snapshot helper; navigation-only updates are dispatched by `onNavigationChange`.
 *   Undo/redo depth-only updates are dispatched by `onUndoRedoDepthChange`.
 *   Workspace persistence is handled by a `useEffect` in `useAppStartup`.
 */

import bundledPlayers from "../../../data/players.json";
import {
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getHeaderValue,
  normalizeX2StyleValue,
  setHeaderValue,
  lookupEco,
} from "../../model";
import { toSessionItem, toResourceTab } from "./app_state_mappers";
import { emitAfterSuccessfulSave, createEnsureSourceForActiveSession } from "./session_save_ops";
import { parsePgnToModel } from "../../../../parts/pgnparser/src/pgn_model";
import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import {
  serializeModelToPgn,
  serializeXsqrHeadMovetext,
  XSQR_HEAD_HEADER_KEY,
} from "../../../../parts/pgnparser/src/pgn_serialize";
import {
  buildMovePositionById,
  resolveMovePositionById,
  stripAnnotationsForBoardParser,
} from "../../board/move_position";
import { createMoveSoundPlayer } from "../../board/move_sound";
import type { MoveSoundPlayer } from "../../board/move_sound";
import { createBoardNavigationCapabilities } from "../../board/navigation";
import { createMoveLookupCapabilities } from "../../board/move_lookup";
import { createPgnRuntimeCapabilities } from "../../features/editor/model/pgn_runtime";
import { createEditorHistoryCapabilities } from "../../features/editor/model/history";
import { createApplyPgnModelUpdate } from "../../runtime/pgn_model_update";
import { createResourcesCapabilities } from "../../resources";
import { createResourceViewerCapabilities } from "../../features/resources/services";
import { createGameSessionModel } from "../../features/sessions/services/session_model";
import { createGameSessionStore } from "../../features/sessions/services/session_store";
import { createSessionPersistenceService } from "../../features/sessions/services/session_persistence";
import { createTranslator } from "../../app/i18n";
import { DEFAULT_LOCALE, DEFAULT_APP_MODE, type PlayerRecord } from "../../app/shell/model/app_state";
import { resolveBuildAppMode } from "../../runtime/bootstrap_prefs";
import {
  createEmptyGameSessionState,
  type ActiveSessionRef,
} from "../../features/sessions/services/game_session_state";
import { setResourceLoaderService } from "../../services/resource_loader";
import type { AppAction } from "../state/actions";
import type { AppStoreState, SessionItemState, ResourceTabSnapshot } from "../state/app_reducer";
import type { Dispatch } from "react";
import type { MovePositionRecord } from "../../board/move_position";
import { dispatchNavigationState, dispatchSessionStateSnapshot } from "../../hooks/session_state_sync";
import { log } from "../../logger";

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

type BoardPreviewValue = { fen: string; lastMove?: [string, string] | null } | null;


// ── Services bundle ─────────────────────────────────────────────────────────────

export type ServicesBundle = {
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
  moveSoundPlayer: MoveSoundPlayer;
};

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create and wire all service instances once.
 *
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param stateRef Mutable ref mirroring the latest React state (updated on every render).
 * @returns Fully wired services bundle.
 */
export function createAppServicesBundle(
  dispatchRef: { current: Dispatch<AppAction> },
  stateRef: { current: AppStoreState },
): ServicesBundle {
  // ── Active session ref ────────────────────────────────────────────────────
  const activeSessionRef: ActiveSessionRef = {
    current: createEmptyGameSessionState(),
  };

  // ── Forward references ────────────────────────────────────────────────────
  let historyRef: HistoryCapabilities | null = null;
  let sessionStoreRef: SessionStore | null = null;
  let sessionPersistenceRef: SessionPersistence | null = null;
  let moveLookupRef: MoveLookup | null = null;
  let resourcesRef: ResourcesCapabilities | null = null;

  // ── Translator (lazy: uses latest locale from React state) ──────────────
  const getTranslator = (): ((key: string, fallback?: string) => string) =>
    createTranslator(stateRef.current.locale || DEFAULT_LOCALE);

  // ── Shared typed dispatch callbacks ──────────────────────────────────────

  const onPgnChange = (_pgnText: string, _pgnModel: unknown, _moves: string[]): void => {
    dispatchSessionStateSnapshot(activeSessionRef.current, dispatchRef.current);
  };

  const onNavigationChange = (
    currentPly: number,
    selectedMoveId: string | null,
    boardPreview: BoardPreviewValue,
  ): void => {
    dispatchNavigationState({
      currentPly,
      selectedMoveId,
      boardPreview: boardPreview ? { fen: boardPreview.fen } : null,
      movePositionById: activeSessionRef.current.movePositionById as Record<string, { mainlinePly?: unknown }> | null,
    }, dispatchRef.current);
  };

  const onUndoRedoDepthChange = (undoDepth: number, redoDepth: number): void => {
    dispatchRef.current({ type: "set_undo_redo_depth", undoDepth, redoDepth });
  };

  const onStatusChange = (message: string): void => {
    dispatchRef.current({ type: "set_status_message", message });
  };

  const onErrorChange = (message: string): void => {
    dispatchRef.current({ type: "set_error_message", message });
  };

  // ── PGN runtime ──────────────────────────────────────────────────────────
  //
  // The *runtime capability model*: `createPgnRuntimeCapabilities` is a pure-logic
  // factory — it has no access to React, the DOM, or any concrete I/O.  It returns
  // a bundle of operations (`applyPgnModelUpdate`, `loadPgn`, `syncChessParseState`,
  // `initializeWithDefaultPgn`) that share state exclusively through `activeSessionRef`
  // and the injected dependency callbacks below.  There is no class, no `this`, and
  // no global state: the only "instance" is the closure formed by this call.
  //
  // *Registering a method* (e.g. `buildMovePositionByIdFn`, `parsePgnToModelFn`):
  // Each `…Fn` parameter is a capability slot — a single concrete implementation
  // wired in here and called by the runtime whenever the corresponding operation is
  // needed.  Registering `buildMovePositionByIdFn: buildMovePositionById` means that
  // every time the runtime re-parses PGN (inside `syncChessParseState`), it invokes
  // `buildMovePositionById` to do a full depth-first walk of the PGN tree and write
  // a fresh `MovePositionIndex` to `activeSessionRef.current.movePositionById`.
  // Swapping the registered function entirely replaces the indexing strategy without
  // touching the runtime module.
  //
  // *Callback slots* (`onPgnChange`, `onNavigationChange`, `onRecordHistory`, …)
  // are the outbound half of the same pattern: the runtime calls them to report state
  // changes and the host (this file) wires them to React dispatch.  The runtime never
  // imports React; the host never re-implements parsing logic.
  const pgnRuntime: PgnRuntime = createPgnRuntimeCapabilities({
    sessionRef: activeSessionRef,
    pgnInput: null,
    t: getTranslator(),
    defaultPgn: "",
    parsePgnToModelFn: (source: string): unknown =>
      ensureRequiredPgnHeaders(parsePgnToModel(source)),
    serializeModelToPgnFn: (model: unknown): string => serializeModelToPgn(model as PgnModel),
    buildMovePositionByIdFn: (model: unknown): Record<string, unknown> =>
      buildMovePositionById(
        model as Parameters<typeof buildMovePositionById>[0],
      ) as Record<string, unknown>,
    stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
    onPgnChange,
    onStatusChange,
    onErrorChange,
    onRecordHistory: (): void => {
      const h: HistoryCapabilities | null = historyRef;
      if (!h) return;
      h.pushUndoSnapshot(h.captureEditorSnapshot());
      h.clearRedoStack();
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
    onPgnChange,
    onUndoRedoDepthChange,
  });
  historyRef = history;

  // ── Resources ─────────────────────────────────────────────────────────────
  const resources: ResourcesCapabilities = createResourcesCapabilities({
    appMode: resolveBuildAppMode(DEFAULT_APP_MODE),
    initialPlayerStore: bundledPlayers as PlayerRecord[],
    t: getTranslator(),
    onSetSaveStatus: (status?: string, _kind?: string): void => {
      onStatusChange(status ?? "");
    },
    onApplyRuntimeConfig: (config: Record<string, unknown>): void => {
      resources.setAppConfig(config);
    },
    onLoadPgn: pgnRuntime.loadPgn,
    onInitializeWithDefaultPgn: pgnRuntime.initializeWithDefaultPgn,
    pgnInput: null,
  });
  resourcesRef = resources;

  setResourceLoaderService(
    resources.listGamesForResource as Parameters<typeof setResourceLoaderService>[0],
  );

  // ── Resource viewer ───────────────────────────────────────────────────────
  const resourceViewer: ResourceViewer = createResourceViewerCapabilities({
    t: getTranslator(),
    listGamesForResource: resources.listGamesForResource,
    onTabsChanged: (rawTabs, activeTabId, activeRowCount, activeTabError): void => {
      const tabs: ResourceTabSnapshot[] = rawTabs
        .map(toResourceTab)
        .filter((t: ResourceTabSnapshot | null): t is ResourceTabSnapshot => t !== null);
      dispatchRef.current({
        type: "set_resource_viewer",
        resourceTabs: tabs,
        activeResourceTabId: activeTabId,
        activeResourceRowCount: activeRowCount,
        activeResourceErrorMessage: activeTabError,
        activeSourceKind: resourcesRef?.getActiveSourceKind() ?? "directory",
      });
    },
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
      getHeaderValue(model as PgnModel | null | undefined, key, fallback),
    t: getTranslator(),
  });

  // ── Session store ─────────────────────────────────────────────────────────
  const sessionStore: SessionStore = createGameSessionStore({
    activeSessionRef,
    onSessionsChanged: (sessions, activeSessionId): void => {
      const g = activeSessionRef.current;
      const sessionItems: SessionItemState[] = sessions
        .map((raw: unknown): SessionItemState =>
          toSessionItem(raw, activeSessionId, g.pgnModel ?? null),
        )
        .filter((item: SessionItemState): boolean => item.sessionId !== "");
      const activeItem: SessionItemState | undefined = sessionItems.find(
        (item: SessionItemState): boolean => item.sessionId === activeSessionId,
      );
      log.info(
        "createAppServices",
        `onSessionsChanged: count=${sessionItems.length} active="${activeSessionId ?? "null"}" ` +
          `activeHeaders=White:"${activeItem?.white ?? ""}" Black:"${activeItem?.black ?? ""}" ` +
          `Event:"${activeItem?.event ?? ""}" Date:"${activeItem?.date ?? ""}"`,
      );
      dispatchRef.current({ type: "set_sessions", sessions: sessionItems, activeSessionId });
    },
  });
  sessionStoreRef = sessionStore;

  // ── Session persistence ───────────────────────────────────────────────────
  const sessionPersistence: SessionPersistence = createSessionPersistenceService({
    t: getTranslator(),
    getActiveSession: sessionStore.getActiveSession as Parameters<
      typeof createSessionPersistenceService
    >[0]["getActiveSession"],
    updateActiveSessionMeta: sessionStore.updateActiveSessionMeta as Parameters<
      typeof createSessionPersistenceService
    >[0]["updateActiveSessionMeta"],
    getPgnText: (): string => {
      const g = activeSessionRef.current;
      const model = g.pgnModel;
      if (!model) return g.pgnText || "";
      try {
        const headFragment: string = serializeXsqrHeadMovetext(model);
        let working = setHeaderValue(model, XSQR_HEAD_HEADER_KEY, headFragment);
        // Auto-stamp ECO/Opening headers when absent and the opening is recognised.
        if (!getHeaderValue(model, "ECO", "") && !getHeaderValue(model, "Opening", "")) {
          const match = lookupEco(g.moves);
          if (match) {
            working = setHeaderValue(working, "ECO", match.eco);
            working = setHeaderValue(working, "Opening", match.name);
          }
        }
        return serializeModelToPgn(working);
      } catch (error: unknown) {
        log.error("createAppServices", "getPgnText: serialization failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        return g.pgnText || "";
      }
    },
    saveBySourceRef: resources.saveGameBySourceRef as Parameters<
      typeof createSessionPersistenceService
    >[0]["saveBySourceRef"],
    ensureSourceForActiveSession: createEnsureSourceForActiveSession({
      getActiveTabId: () => resourceViewer.getActiveTabId(),
      getActiveResourceRef: () => resourceViewer.getActiveResourceRef() as { kind?: string; locator?: string } | null,
      getTranslator,
      createSessionFromPgnText: (pgnText: string) => sessionModel.createSessionFromPgnText(pgnText),
      deriveSessionTitle: (pgnModel: unknown, kind: string) => sessionModel.deriveSessionTitle(pgnModel, kind),
      createGameInResource: (ref, pgnText, titleHint) =>
        resources.createGameInResource(ref, pgnText, titleHint) as Promise<{ sourceRef?: { kind?: unknown; locator?: unknown; recordId?: unknown }; revisionToken?: unknown }>,
    }),
    onSetSaveStatus: (status?: string, _kind?: string): void => {
      onStatusChange(status ?? "");
    },
    onAfterSuccessfulSave: emitAfterSuccessfulSave,
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
    isSoundEnabled: (): boolean => Boolean(stateRef.current.soundEnabled),
  });

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigation: Navigation = createBoardNavigationCapabilities({
    sessionRef: activeSessionRef,
    getDelayMs: (): number => Number(stateRef.current.moveDelayMs) || 220,
    getMovePositionById: (
      moveId: string | null,
      options: { allowResolve: boolean },
    ): MovePositionRecord | null =>
      (moveLookupRef?.getMovePositionById(moveId, options) as MovePositionRecord | null) ?? null,
    selectMoveById: (moveId: string): boolean => {
      const g = activeSessionRef.current;
      const pos = g.movePositionById?.[moveId] as
        | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
        | undefined;
      if (!pos) return false;
      g.selectedMoveId = moveId;
      if (pos.mainlinePly != null && Number.isFinite(pos.mainlinePly)) {
        g.currentPly = pos.mainlinePly;
        g.boardPreview = null;
      } else {
        g.boardPreview = pos.fen
          ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../../board/runtime").BoardPreviewLike)
          : null;
      }
      const bp = g.boardPreview as BoardPreviewValue;
      onNavigationChange(g.currentPly, g.selectedMoveId, bp);
      return true;
    },
    findCommentIdAroundMove: (moveId: string, position: "before" | "after"): string | null =>
      activeSessionRef.current.pgnModel
        ? findExistingCommentIdAroundMove(activeSessionRef.current.pgnModel, moveId, position)
        : null,
    focusCommentById: (commentId: string): boolean => {
      activeSessionRef.current.pendingFocusCommentId = commentId;
      dispatchSessionStateSnapshot(activeSessionRef.current, dispatchRef.current);
      return true;
    },
    playMoveSound: moveSoundPlayer.playMoveSound,
    onNavigationChange,
  });

  return {
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
    moveSoundPlayer,
  };
}
