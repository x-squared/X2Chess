/**
 * Session Store module.
 *
 * Integration API:
 * - Primary exports from this module: `createGameSessionStore`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - State changes are reported via `onSessionsChanged` rather than a shared mutable
 *   state object. Callers do not need to poll; the callback fires after every mutation.
 */

import type { SourceRefLike } from "../runtime/bootstrap_shared";
import type { SessionSnap } from "../runtime/workspace_snapshot_store";
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

type SessionStoreDeps = {
  /** Ref whose `current` is swapped to the active session's ownState on every switch. */
  activeSessionRef: ActiveSessionRef;
  /** Called after any change to the session list or active session. */
  onSessionsChanged?: (sessions: GameSession[], activeSessionId: string | null) => void;
};

export const createGameSessionStore = ({
  activeSessionRef,
  onSessionsChanged,
}: SessionStoreDeps) => {
  let gameSessions: GameSession[] = [];
  let activeSessionId: string | null = null;
  let nextSessionSeq = 1;

  const getSessions = (): GameSession[] => gameSessions;

  const getActiveSession = (): GameSession | null =>
    getSessions().find((session: GameSession): boolean => session.sessionId === activeSessionId) || null;

  const notifyChanged = (): void => {
    onSessionsChanged?.(getSessions(), activeSessionId);
  };

  const openSession = ({
    ownState,
    title,
    sourceRef = null,
    pendingResourceRef = null,
    revisionToken = "",
    saveMode = "auto",
  }: OpenSessionInput): GameSession => {
    const currentSessionSeq: number = nextSessionSeq;
    nextSessionSeq += 1;
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
    activeSessionId = session.sessionId;
    activeSessionRef.current = ownState;
    notifyChanged();
    return session;
  };

  const switchToSession = (sessionId: string): boolean => {
    if (!sessionId || sessionId === activeSessionId) return false;
    const target: GameSession | undefined = getSessions().find(
      (session: GameSession): boolean => session.sessionId === sessionId,
    );
    if (!target) return false;
    activeSessionId = target.sessionId;
    activeSessionRef.current = target.ownState;
    notifyChanged();
    return true;
  };

  const closeSession = (sessionId: string): { closed: boolean; emptyAfterClose: boolean } => {
    const sessions = getSessions();
    const index: number = sessions.findIndex((session: GameSession): boolean => session.sessionId === sessionId);
    if (index < 0) return { closed: false, emptyAfterClose: sessions.length === 0 };
    sessions.splice(index, 1);
    if (sessions.length === 0) {
      activeSessionId = null;
      notifyChanged();
      return { closed: true, emptyAfterClose: true };
    }
    const nextIndex: number = Math.min(index, sessions.length - 1);
    const next: GameSession = sessions[nextIndex];
    activeSessionId = next.sessionId;
    activeSessionRef.current = next.ownState;
    notifyChanged();
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
    notifyChanged();
  };

  const getActiveSessionId = (): string | null => activeSessionId;

  const buildSessionSnapshots = (): SessionSnap[] =>
    getSessions().map((session: GameSession): SessionSnap | null => {
      const ownState = session.ownState;
      const sourceRef = session.sourceRef;
      const hasLocator = typeof sourceRef?.locator === "string" && sourceRef.locator !== "";
      return {
        sessionId: session.sessionId,
        title: session.title,
        pgnText: typeof ownState.pgnText === "string" ? ownState.pgnText : "",
        sourceRef: hasLocator
          ? {
              kind: String(sourceRef?.kind || ""),
              locator: String(sourceRef?.locator),
              ...(typeof sourceRef?.recordId === "string" && sourceRef.recordId
                ? { recordId: sourceRef.recordId }
                : {}),
            }
          : null,
        dirtyState: session.dirtyState,
        saveMode: session.saveMode,
        currentPly: typeof ownState.currentPly === "number" ? ownState.currentPly : 0,
        selectedMoveId: typeof ownState.selectedMoveId === "string" ? ownState.selectedMoveId : null,
        pgnLayoutMode: typeof ownState.pgnLayoutMode === "string" ? ownState.pgnLayoutMode : "plain",
      };
    }).filter((s): s is SessionSnap => s !== null);

  const hasUnsavedSessions = (): boolean =>
    getSessions().some((session: GameSession): boolean => {
      const sourceRef = session.sourceRef;
      const hasSource = typeof sourceRef?.locator === "string" && sourceRef.locator !== "";
      return !hasSource || session.dirtyState === "dirty" || session.dirtyState === "error";
    });

  return {
    closeSession,
    getActiveSession,
    getActiveSessionId,
    buildSessionSnapshots,
    hasUnsavedSessions,
    listSessions: (): GameSession[] => [...getSessions()],
    openSession,
    switchToSession,
    updateActiveSessionMeta,
  };
};
