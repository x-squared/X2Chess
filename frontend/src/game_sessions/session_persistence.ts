/**
 * Session persistence service.
 *
 * Integration API:
 * - Create with `createSessionPersistenceService(deps)`.
 * - Drive persistence through:
 *   - `scheduleAutosaveForActiveSession()`
 *   - `persistActiveSessionNow()`
 *   - `setActiveSessionSaveMode(mode)`
 *
 * Configuration API:
 * - Autosave timing is configured via `autosaveDebounceMs`.
 * - Save policy defaults come from `state.defaultSaveMode` and can be overridden
 *   per session (`session.saveMode`).
 * - Concrete storage backend is configured by injected `saveBySourceRef(...)`.
 *
 * Communication API:
 * - Reads active session + PGN via injected getters.
 * - Writes session metadata (`dirtyState`, `revisionToken`, `saveMode`) through
 *   `updateActiveSessionMeta`.
 * - Emits user-facing save status through `onSetSaveStatus(...)`.
 */

/**
 * Create session persistence service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.state - Shared app state.
 * @param {Function} deps.t - Translation callback.
 * @param {Function} deps.getActiveSession - `() => session|null`.
 * @param {Function} deps.updateActiveSessionMeta - `(patch) => void`.
 * @param {Function} deps.getPgnText - `() => string`.
 * @param {Function} deps.saveBySourceRef - `(sourceRef, pgnText, revisionToken, options) => Promise<{revisionToken: string}>`.
 * @param {Function} [deps.ensureSourceForActiveSession] - Optional callback `(session, pgnText) => Promise<{sourceRef: object, revisionToken?: string}|null>`.
 * @param {Function} deps.onSetSaveStatus - `(message, kind) => void`.
 * @param {number} [deps.autosaveDebounceMs=700] - Debounce delay.
 * @returns {{persistActiveSessionNow: Function, scheduleAutosaveForActiveSession: Function, setActiveSessionSaveMode: Function}} Service API.
 */
export const createSessionPersistenceService = ({
  state,
  t,
  getActiveSession,
  updateActiveSessionMeta,
  getPgnText,
  saveBySourceRef,
  ensureSourceForActiveSession,
  onSetSaveStatus,
  autosaveDebounceMs = 700,
}) => {
  /**
   * Persist active session immediately.
   *
   * @returns {Promise<boolean>} True when save ran and succeeded.
   */
  const persistActiveSessionNow = async () => {
    const session = getActiveSession();
    if (!session) return false;
    let activeSourceRef = session.sourceRef || null;
    if (!activeSourceRef && typeof ensureSourceForActiveSession === "function") {
      try {
        const ensured = await ensureSourceForActiveSession(session, getPgnText());
        if (ensured?.sourceRef) {
          activeSourceRef = ensured.sourceRef;
          updateActiveSessionMeta({
            sourceRef: ensured.sourceRef,
            pendingResourceRef: null,
            revisionToken: String(ensured.revisionToken || ""),
          });
        }
      } catch (error: unknown) {
        updateActiveSessionMeta({ dirtyState: "error" });
        const detail = error instanceof Error ? error.message : String(error);
        onSetSaveStatus(
          `${t("pgn.save.error", "Autosave failed")}: ${detail}`.trim(),
          "error",
        );
        return false;
      }
    }
    if (!activeSourceRef) return false;
    const requestId = ++state.saveRequestSeq;
    updateActiveSessionMeta({ dirtyState: "saving" });
    onSetSaveStatus(t("pgn.save.saving", "Saving..."), "saving");
    try {
      const saveResult = await saveBySourceRef(
        activeSourceRef,
        getPgnText(),
        session.revisionToken,
        { sessionId: session.sessionId },
      );
      if (requestId !== state.saveRequestSeq) return false;
      updateActiveSessionMeta({
        dirtyState: "clean",
        revisionToken: String(saveResult?.revisionToken || Date.now()),
      });
      onSetSaveStatus(t("pgn.save.saved", "Saved"), "saved");
      return true;
    } catch (error: unknown) {
      if (requestId !== state.saveRequestSeq) return false;
      updateActiveSessionMeta({ dirtyState: "error" });
      const detail = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(
        `${t("pgn.save.error", "Autosave failed")}: ${detail}`.trim(),
        "error",
      );
      return false;
    }
  };

  /**
   * Schedule autosave for active session when policy allows.
   */
  const scheduleAutosaveForActiveSession = () => {
    if (state.isHydratingGame) return;
    const session = getActiveSession();
    if (!session) return;
    const sessionMode = session.saveMode || state.defaultSaveMode;
    if (sessionMode !== "auto") return;
    updateActiveSessionMeta({ dirtyState: "dirty" });
    if (state.autosaveTimer) {
      window.clearTimeout(state.autosaveTimer);
      state.autosaveTimer = null;
    }
    state.autosaveTimer = window.setTimeout(() => {
      state.autosaveTimer = null;
      void persistActiveSessionNow();
    }, autosaveDebounceMs);
  };

  /**
   * Set save mode for active session.
   *
   * @param {"auto"|"manual"} mode - Session save mode.
   */
  const setActiveSessionSaveMode = (mode) => {
    const nextMode = mode === "manual" ? "manual" : "auto";
    updateActiveSessionMeta({ saveMode: nextMode });
    state.defaultSaveMode = nextMode;
  };

  return {
    persistActiveSessionNow,
    scheduleAutosaveForActiveSession,
    setActiveSessionSaveMode,
  };
};

