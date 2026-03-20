/**
 * Session Store module.
 *
 * Integration API:
 * - Primary exports from this module: `createGameSessionStore`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import type { SourceRefLike } from "../runtime/bootstrap_shared";

type SaveMode = "auto" | "manual";

type DirtyState = "clean" | "dirty" | string;

type SessionSnapshot = unknown;

type GameSession = {
  sessionId: string;
  title: string;
  sourceRef: SourceRefLike | null;
  pendingResourceRef: SourceRefLike | null;
  revisionToken: string;
  dirtyState: DirtyState;
  saveMode: SaveMode;
  snapshot: SessionSnapshot;
};

type SessionStoreState = {
  gameSessions: unknown[];
  activeSessionId: string | null;
  nextSessionSeq: number;
};

type OpenSessionInput = {
  snapshot: SessionSnapshot;
  title: string;
  sourceRef?: SourceRefLike | null;
  pendingResourceRef?: SourceRefLike | null;
  revisionToken?: string;
  saveMode?: string;
};

type ActiveSessionPatch = {
  title?: string;
  sourceRef?: SourceRefLike | null;
  pendingResourceRef?: SourceRefLike | null;
  revisionToken?: string;
  dirtyState?: DirtyState;
  saveMode?: string;
};

type SessionStoreDeps<TState extends SessionStoreState> = {
  state: TState;
  captureActiveSessionSnapshot: () => SessionSnapshot;
  applySessionSnapshotToState: (snapshot: unknown) => void;
  disposeSessionSnapshot: (snapshot: unknown) => void;
};

export const createGameSessionStore = <TState extends SessionStoreState>({
  state,
  captureActiveSessionSnapshot,
  applySessionSnapshotToState,
  disposeSessionSnapshot,
}: SessionStoreDeps<TState>) => {
  const getSessions = (): GameSession[] => (Array.isArray(state.gameSessions) ? state.gameSessions : []) as GameSession[];

  const getActiveSession = (): GameSession | null =>
    getSessions().find((session: GameSession): boolean => session.sessionId === state.activeSessionId) || null;

  const persistActiveSession = (): void => {
    const active: GameSession | null = getActiveSession();
    if (!active) return;
    active.snapshot = captureActiveSessionSnapshot();
  };

  const openSession = ({
    snapshot,
    title,
    sourceRef = null,
    pendingResourceRef = null,
    revisionToken = "",
    saveMode = "auto",
  }: OpenSessionInput): GameSession => {
    persistActiveSession();
    const currentSessionSeq: number = state.nextSessionSeq;
    state.nextSessionSeq += 1;
    const session: GameSession = {
      sessionId: `session-${currentSessionSeq}`,
      title: String(title || "").trim() || `Game ${currentSessionSeq}`,
      sourceRef,
      pendingResourceRef,
      revisionToken: String(revisionToken || ""),
      dirtyState: "clean",
      saveMode: saveMode === "manual" ? "manual" : "auto",
      snapshot,
    };
    getSessions().push(session);
    state.activeSessionId = session.sessionId;
    applySessionSnapshotToState(snapshot);
    return session;
  };

  const switchToSession = (sessionId: string): boolean => {
    if (!sessionId || sessionId === state.activeSessionId) return false;
    const target: GameSession | undefined = getSessions().find(
      (session: GameSession): boolean => session.sessionId === sessionId,
    );
    if (!target) return false;
    persistActiveSession();
    state.activeSessionId = target.sessionId;
    applySessionSnapshotToState(target.snapshot);
    return true;
  };

  const closeSession = (sessionId: string): { closed: boolean; emptyAfterClose: boolean } => {
    const sessions = getSessions();
    const index: number = sessions.findIndex((session: GameSession): boolean => session.sessionId === sessionId);
    if (index < 0) return { closed: false, emptyAfterClose: getSessions().length === 0 };
    const removed: GameSession | undefined = sessions.splice(index, 1)[0];
    if (removed) {
      disposeSessionSnapshot(removed.snapshot);
    }
    if (sessions.length === 0) {
      state.activeSessionId = null;
      return { closed: true, emptyAfterClose: true };
    }
    const nextIndex: number = Math.min(index, sessions.length - 1);
    const next: GameSession = sessions[nextIndex];
    state.activeSessionId = next.sessionId;
    applySessionSnapshotToState(next.snapshot);
    return { closed: true, emptyAfterClose: false };
  };

  const updateActiveSessionMeta = (patch: ActiveSessionPatch): void => {
    const active: GameSession | null = getActiveSession();
    if (!active || !patch || typeof patch !== "object") return;
    if ("title" in patch) active.title = String(patch.title || active.title);
    if ("sourceRef" in patch) active.sourceRef = patch.sourceRef || null;
    if ("pendingResourceRef" in patch) active.pendingResourceRef = patch.pendingResourceRef || null;
    if ("revisionToken" in patch) active.revisionToken = String(patch.revisionToken || "");
    if ("dirtyState" in patch) active.dirtyState = String(patch.dirtyState || active.dirtyState);
    if ("saveMode" in patch) active.saveMode = patch.saveMode === "manual" ? "manual" : "auto";
  };

  return {
    closeSession,
    getActiveSession,
    listSessions: (): GameSession[] => [...getSessions()],
    openSession,
    persistActiveSession,
    switchToSession,
    updateActiveSessionMeta,
  };
};
