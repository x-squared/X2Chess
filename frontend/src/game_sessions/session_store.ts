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
import type { ActiveSessionRef, GameSessionState } from "./game_session_state";

type SaveMode = "auto" | "manual";

type DirtyState = "clean" | "dirty" | "saving" | "error" | (string & Record<never, never>);

type GameSession = {
  sessionId: string;
  title: string;
  sourceRef: SourceRefLike | null;
  pendingResourceRef: SourceRefLike | null;
  revisionToken: string;
  dirtyState: DirtyState;
  saveMode: SaveMode;
  /** Live state object owned by this session. The activeSessionRef points here when active. */
  ownState: GameSessionState;
};

type SessionStoreState = {
  gameSessions: unknown[];
  activeSessionId: string | null;
  nextSessionSeq: number;
};

type OpenSessionInput = {
  ownState: GameSessionState;
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
  /** Ref whose `current` is swapped to the active session's ownState on every switch. */
  activeSessionRef: ActiveSessionRef;
};

export const createGameSessionStore = <TState extends SessionStoreState>({
  state,
  activeSessionRef,
}: SessionStoreDeps<TState>) => {
  const getSessions = (): GameSession[] => (Array.isArray(state.gameSessions) ? state.gameSessions : []) as GameSession[];

  const getActiveSession = (): GameSession | null =>
    getSessions().find((session: GameSession): boolean => session.sessionId === state.activeSessionId) || null;

  const openSession = ({
    ownState,
    title,
    sourceRef = null,
    pendingResourceRef = null,
    revisionToken = "",
    saveMode = "auto",
  }: OpenSessionInput): GameSession => {
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
      ownState,
    };
    getSessions().push(session);
    state.activeSessionId = session.sessionId;
    activeSessionRef.current = ownState;
    return session;
  };

  const switchToSession = (sessionId: string): boolean => {
    if (!sessionId || sessionId === state.activeSessionId) return false;
    const target: GameSession | undefined = getSessions().find(
      (session: GameSession): boolean => session.sessionId === sessionId,
    );
    if (!target) return false;
    state.activeSessionId = target.sessionId;
    activeSessionRef.current = target.ownState;
    return true;
  };

  const closeSession = (sessionId: string): { closed: boolean; emptyAfterClose: boolean } => {
    const sessions = getSessions();
    const index: number = sessions.findIndex((session: GameSession): boolean => session.sessionId === sessionId);
    if (index < 0) return { closed: false, emptyAfterClose: getSessions().length === 0 };
    sessions.splice(index, 1);
    if (sessions.length === 0) {
      state.activeSessionId = null;
      return { closed: true, emptyAfterClose: true };
    }
    const nextIndex: number = Math.min(index, sessions.length - 1);
    const next: GameSession = sessions[nextIndex];
    state.activeSessionId = next.sessionId;
    activeSessionRef.current = next.ownState;
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
    switchToSession,
    updateActiveSessionMeta,
  };
};
