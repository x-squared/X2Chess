/**
 * Game session store.
 *
 * Integration API:
 * - Create once with `createGameSessionStore(deps)`.
 * - Use public methods to manage session lifecycle:
 *   `openSession`, `switchToSession`, `closeSession`, `persistActiveSession`.
 *
 * Configuration API:
 * - Store behavior is configured by injected snapshot handlers:
 *   `captureActiveSessionSnapshot`, `applySessionSnapshotToState`,
 *   `disposeSessionSnapshot`.
 * - Session IDs/titles/counters are derived from shared state fields.
 *
 * Communication API:
 * - Mutates `state.gameSessions`, `state.activeSessionId`, and metadata fields.
 * - Applies snapshots when switching/opening/closing sessions.
 * - Disposes removed snapshots to release in-memory resources.
 */

/**
 * Create game session store.
 *
 * @param {object} deps - Store dependencies.
 * @param {object} deps.state - Shared app state.
 * @param {Function} deps.captureActiveSessionSnapshot - Snapshot capture callback.
 * @param {Function} deps.applySessionSnapshotToState - Snapshot apply callback.
 * @param {Function} deps.disposeSessionSnapshot - Snapshot dispose callback.
 * @returns {{closeSession: Function, getActiveSession: Function, listSessions: Function, openSession: Function, persistActiveSession: Function, switchToSession: Function, updateActiveSessionMeta: Function}} Store API.
 */
export const createGameSessionStore = ({
  state,
  captureActiveSessionSnapshot,
  applySessionSnapshotToState,
  disposeSessionSnapshot,
}) => {
  /**
   * Read active session object.
   *
   * @returns {object|null} Active session.
   */
  const getActiveSession = () => (
    state.gameSessions.find((session) => session.sessionId === state.activeSessionId) || null
  );

  /**
   * Persist active state back into active session snapshot.
   */
  const persistActiveSession = () => {
    const active = getActiveSession();
    if (!active) return;
    active.snapshot = captureActiveSessionSnapshot();
  };

  /**
   * Open session and activate it.
   *
   * @param {object} input - Session creation payload.
   * @param {object} input.snapshot - Session snapshot.
   * @param {string} input.title - Tab title.
   * @param {object|null} [input.sourceRef=null] - Source reference.
   * @param {object|null} [input.pendingResourceRef=null] - Preferred resource for first save when source is missing.
   * @param {string} [input.revisionToken=""] - Source revision token.
   * @param {"auto"|"manual"} [input.saveMode="auto"] - Session save mode.
   * @returns {object} Opened session.
   */
  const openSession = ({
    snapshot,
    title,
    sourceRef = null,
    pendingResourceRef = null,
    revisionToken = "",
    saveMode = "auto",
  }) => {
    persistActiveSession();
    const session = {
      sessionId: `session-${state.nextSessionSeq++}`,
      title: String(title || "").trim() || `Game ${state.nextSessionSeq - 1}`,
      sourceRef,
      pendingResourceRef,
      revisionToken: String(revisionToken || ""),
      dirtyState: "clean",
      saveMode: saveMode === "manual" ? "manual" : "auto",
      snapshot,
    };
    state.gameSessions.push(session);
    state.activeSessionId = session.sessionId;
    applySessionSnapshotToState(snapshot);
    return session;
  };

  /**
   * Switch active session.
   *
   * @param {string} sessionId - Target session id.
   * @returns {boolean} True when switch succeeded.
   */
  const switchToSession = (sessionId) => {
    if (!sessionId || sessionId === state.activeSessionId) return false;
    const target = state.gameSessions.find((session) => session.sessionId === sessionId);
    if (!target) return false;
    persistActiveSession();
    state.activeSessionId = target.sessionId;
    applySessionSnapshotToState(target.snapshot);
    return true;
  };

  /**
   * Close session and activate adjacent session if needed.
   *
   * @param {string} sessionId - Session id to close.
   * @returns {{closed: boolean, emptyAfterClose: boolean}} Close result.
   */
  const closeSession = (sessionId) => {
    const index = state.gameSessions.findIndex((session) => session.sessionId === sessionId);
    if (index < 0) return { closed: false, emptyAfterClose: state.gameSessions.length === 0 };
    const [removed] = state.gameSessions.splice(index, 1);
    disposeSessionSnapshot(removed.snapshot);
    if (state.gameSessions.length === 0) {
      state.activeSessionId = null;
      return { closed: true, emptyAfterClose: true };
    }
    const nextIndex = Math.min(index, state.gameSessions.length - 1);
    const next = state.gameSessions[nextIndex];
    state.activeSessionId = next.sessionId;
    applySessionSnapshotToState(next.snapshot);
    return { closed: true, emptyAfterClose: false };
  };

  /**
   * Update active session metadata.
   *
   * @param {object} patch - Partial metadata update.
   */
  const updateActiveSessionMeta = (patch) => {
    const active = getActiveSession();
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
    listSessions: () => [...state.gameSessions],
    openSession,
    persistActiveSession,
    switchToSession,
    updateActiveSessionMeta,
  };
};

