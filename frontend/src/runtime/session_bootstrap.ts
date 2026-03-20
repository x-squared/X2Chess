import { createGameSessionModel } from "../game_sessions/session_model";
import { createGameSessionStore } from "../game_sessions/session_store";
import { createSessionPersistenceService } from "../game_sessions/session_persistence";
import type { SessionLike, SourceRefLike } from "./bootstrap_shared";

/**
 * Session bootstrap wiring module.
 *
 * Integration API:
 * - Primary export: `createSessionBootstrapCapabilities`.
 *
 * Configuration API:
 * - Accepts typed dependencies for model/store/persistence creation.
 *
 * Communication API:
 * - Coordinates session model, session store, persistence service, and resource visibility callbacks.
 */
type SessionBootstrapState = {
  pgnText: string;
  activeSourceKind: string;
  gameDirectoryPath: string;
  gameSessions: unknown[];
  activeSessionId: string | null;
  nextSessionSeq: number;
};

type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult;
}["bivarianceHack"];

type SessionPersistenceDeps = Parameters<typeof createSessionPersistenceService>[0];

type SessionBootstrapDeps<TState extends SessionBootstrapState> = {
  state: TState;
  t: (key: string, fallback?: string) => string;
  pgnInput: Element | null;
  parsePgnToModelFn: (source: string) => unknown;
  serializeModelToPgnFn: BivariantCallback<[model: unknown], string>;
  ensureRequiredPgnHeadersFn: BivariantCallback<[model: unknown], unknown>;
  buildMovePositionByIdFn: BivariantCallback<[model: unknown], Record<string, unknown>>;
  stripAnnotationsForBoardParserFn: (source: string) => string;
  getHeaderValueFn: BivariantCallback<[model: unknown, key: string, fallback: string], string>;
  resourcesCapabilities: {
    saveGameBySourceRef: SessionPersistenceDeps["saveBySourceRef"];
    createGameInResource: (resourceRef: SourceRefLike, pgnText: string, title: string) => Promise<Record<string, unknown>>;
  };
  resourceViewerCapabilities: {
    getActiveResourceRef: () => SourceRefLike | null;
  };
  normalizeResourceRefForInsertFn: (resourceRef: SourceRefLike, state: TState) => SourceRefLike | null;
  ensureResourceTabVisible: (resourceRef: SourceRefLike | null, select?: boolean) => Promise<void>;
  onSetSaveStatus: SessionPersistenceDeps["onSetSaveStatus"];
};

type SessionBootstrapCapabilities = {
  gameSessionModel: ReturnType<typeof createGameSessionModel>;
  gameSessionStore: ReturnType<typeof createGameSessionStore>;
  sessionPersistenceService: ReturnType<typeof createSessionPersistenceService>;
};

export const createSessionBootstrapCapabilities = <TState extends SessionBootstrapState>({
  state,
  t,
  pgnInput,
  parsePgnToModelFn,
  serializeModelToPgnFn,
  ensureRequiredPgnHeadersFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  getHeaderValueFn,
  resourcesCapabilities,
  resourceViewerCapabilities,
  normalizeResourceRefForInsertFn,
  ensureResourceTabVisible,
  onSetSaveStatus,
}: SessionBootstrapDeps<TState>): SessionBootstrapCapabilities => {
  const gameSessionModel = createGameSessionModel({
    state,
    pgnInput,
    parsePgnToModelFn,
    serializeModelToPgnFn,
    ensureRequiredPgnHeadersFn,
    buildMovePositionByIdFn,
    stripAnnotationsForBoardParserFn,
    getHeaderValueFn,
    t,
  });

  const gameSessionStore = createGameSessionStore({
    state,
    captureActiveSessionSnapshot: gameSessionModel.captureActiveSessionSnapshot,
    applySessionSnapshotToState: gameSessionModel.applySessionSnapshotToState,
    disposeSessionSnapshot: gameSessionModel.disposeSessionSnapshot,
  });

  const sessionPersistenceService = createSessionPersistenceService({
    state,
    t,
    getActiveSession: gameSessionStore.getActiveSession,
    updateActiveSessionMeta: gameSessionStore.updateActiveSessionMeta,
    getPgnText: (): string => state.pgnText,
    saveBySourceRef: resourcesCapabilities.saveGameBySourceRef,
    ensureSourceForActiveSession: async (session: unknown, pgnText: string): Promise<unknown | null> => {
      const sessionLike: SessionLike | null | undefined = session as SessionLike | null | undefined;
      const fallbackResourceRef: SourceRefLike = {
        kind: state.activeSourceKind || "directory",
        locator: state.gameDirectoryPath || "",
      };
      const pendingResourceRef = normalizeResourceRefForInsertFn(
        sessionLike?.pendingResourceRef || resourceViewerCapabilities.getActiveResourceRef() || fallbackResourceRef,
        state,
      );
      if (!pendingResourceRef) return null;

      const created = await resourcesCapabilities.createGameInResource(
        pendingResourceRef,
        pgnText,
        sessionLike?.title || "new-game",
      );

      const createdSourceRef = (created.sourceRef || null) as SourceRefLike | null;
      const resourceToSelect: SourceRefLike = {
        kind: createdSourceRef?.kind || pendingResourceRef.kind,
        locator: createdSourceRef?.locator || pendingResourceRef.locator,
      };
      await ensureResourceTabVisible(resourceToSelect, true);
      return created;
    },
    onSetSaveStatus,
  });

  return {
    gameSessionModel,
    gameSessionStore,
    sessionPersistenceService,
  };
};
