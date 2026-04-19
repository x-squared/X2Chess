/**
 * Session Persistence module.
 *
 * Integration API:
 * - Primary exports from this module: `createSessionPersistenceService`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - State changes are reported via `onSetSaveStatus`; this module holds its own
 *   runtime state in a closure (no injected mutable state object).
 */

import type { SourceRefLike } from "../../../runtime/bootstrap_shared";
import type { DirtyState } from "./session_store";

type SaveMode = "auto" | "manual";

type SessionLike = {
  sessionId: string;
  sourceRef?: SourceRefLike | null;
  revisionToken?: string;
  saveMode?: SaveMode;
};

type SaveResult = {
  revisionToken?: string;
};

type EnsureSourceResult = {
  sourceRef?: SourceRefLike;
  revisionToken?: string;
} | null;

type SessionPersistenceDeps = {
  defaultSaveMode?: SaveMode;
  t: (key: string, fallback?: string) => string;
  getActiveSession: () => SessionLike | null;
  updateActiveSessionMeta: (patch: {
    sourceRef?: SourceRefLike | null;
    pendingResourceRef?: SourceRefLike | null;
    revisionToken?: string;
    dirtyState?: DirtyState;
    saveMode?: SaveMode;
  }) => void;
  getPgnText: () => string;
  saveBySourceRef: (
    sourceRef: SourceRefLike,
    pgnText: string,
    revisionToken: string,
    options: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  ensureSourceForActiveSession?: (session: unknown, pgnText: string) => Promise<unknown | null>;
  onSetSaveStatus: (message?: string, kind?: string) => void;
  autosaveDebounceMs?: number;
};

export const createSessionPersistenceService = ({
  defaultSaveMode: initialDefaultSaveMode = "auto",
  t,
  getActiveSession,
  updateActiveSessionMeta,
  getPgnText,
  saveBySourceRef,
  ensureSourceForActiveSession,
  onSetSaveStatus,
  autosaveDebounceMs = 700,
}: SessionPersistenceDeps) => {
  let saveRequestSeq = 0;
  let isHydratingGame = false;
  let defaultSaveMode: SaveMode = initialDefaultSaveMode;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  const reportSaveError = (error: unknown): void => {
    updateActiveSessionMeta({ dirtyState: "error" });
    const detail: string = error instanceof Error ? error.message : String(error);
    onSetSaveStatus(`${t("pgn.save.error", "Autosave failed")}: ${detail}`.trim(), "error");
  };

  /**
   * Resolve a source ref for a session that has none yet, creating a new resource
   * record if possible. Returns the resolved ref, or null when unavailable.
   * Bails (returns undefined sentinel) when the session is no longer active after the await.
   */
  const resolveSourceRef = async (
    session: SessionLike,
    isStillActive: () => boolean,
  ): Promise<SourceRefLike | null | "stale"> => {
    if (typeof ensureSourceForActiveSession !== "function") return null;
    try {
      const ensured: EnsureSourceResult = (await ensureSourceForActiveSession(session, getPgnText())) as EnsureSourceResult;
      if (!isStillActive()) return "stale";
      if (!ensured?.sourceRef) return null;
      updateActiveSessionMeta({
        sourceRef: ensured.sourceRef,
        pendingResourceRef: null,
        revisionToken: String(ensured.revisionToken || ""),
      });
      return ensured.sourceRef;
    } catch (error: unknown) {
      if (!isStillActive()) return "stale";
      reportSaveError(error);
      return null;
    }
  };

  /**
   * Write pgnText to sourceRef. Applies metadata updates only when the originating
   * session is still active and this is the latest save request.
   */
  const executeSave = async (
    sourceRef: SourceRefLike,
    session: SessionLike,
    requestId: number,
    isStillActive: () => boolean,
  ): Promise<void> => {
    try {
      const saveResult: SaveResult = await saveBySourceRef(
        sourceRef,
        getPgnText(),
        String(session.revisionToken || ""),
        { sessionId: session.sessionId },
      );
      if (requestId !== saveRequestSeq || !isStillActive()) return;
      updateActiveSessionMeta({
        dirtyState: "clean",
        revisionToken: String(saveResult.revisionToken || Date.now()),
      });
      onSetSaveStatus(t("pgn.save.saved", "Saved"), "saved");
    } catch (error: unknown) {
      if (requestId !== saveRequestSeq || !isStillActive()) return;
      reportSaveError(error);
    }
  };

  const persistActiveSessionNow = async (): Promise<void> => {
    const session: SessionLike | null = getActiveSession();
    if (!session) return;
    const capturedSessionId: string = session.sessionId;
    const isStillActive = (): boolean => getActiveSession()?.sessionId === capturedSessionId;
    let activeSourceRef: SourceRefLike | null = session.sourceRef || null;
    if (!activeSourceRef) {
      const resolved = await resolveSourceRef(session, isStillActive);
      if (resolved === "stale" || resolved === null) return;
      activeSourceRef = resolved;
    }
    const requestId: number = ++saveRequestSeq;
    updateActiveSessionMeta({ dirtyState: "saving" });
    onSetSaveStatus(t("pgn.save.saving", "Saving..."), "saving");
    await executeSave(activeSourceRef, session, requestId, isStillActive);
  };

  const cancelPendingAutosave = (): void => {
    if (autosaveTimer) {
      globalThis.clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  };

  const scheduleAutosaveForActiveSession = (): void => {
    if (isHydratingGame) return;
    const session: SessionLike | null = getActiveSession();
    if (!session) return;
    const sessionMode: SaveMode = session.saveMode || defaultSaveMode;
    if (sessionMode !== "auto") return;
    updateActiveSessionMeta({ dirtyState: "dirty" });
    cancelPendingAutosave();
    autosaveTimer = globalThis.setTimeout((): void => {
      autosaveTimer = null;
      void persistActiveSessionNow();
    }, autosaveDebounceMs);
  };

  const setActiveSessionSaveMode = (mode: string): void => {
    const nextMode: SaveMode = mode === "manual" ? "manual" : "auto";
    updateActiveSessionMeta({ saveMode: nextMode });
    defaultSaveMode = nextMode;
  };

  const setIsHydratingGame = (value: boolean): void => {
    isHydratingGame = value;
  };

  return {
    persistActiveSessionNow,
    cancelPendingAutosave,
    scheduleAutosaveForActiveSession,
    setActiveSessionSaveMode,
    setIsHydratingGame,
  };
};
