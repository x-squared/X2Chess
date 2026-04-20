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
import { log } from "../../../logger";
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
  /**
   * Called after a save completes successfully (clean revision applied).
   * Used by callers to emit domain events and refresh dependent views.
   */
  onAfterSuccessfulSave?: (details: {
    sourceRef: SourceRefLike;
    sessionId: string;
    revisionToken: string;
    wasCreate: boolean;
  }) => void;
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
  onAfterSuccessfulSave,
  autosaveDebounceMs = 700,
}: SessionPersistenceDeps) => {
  let saveRequestSeq = 0;
  let isHydratingGame = false;
  let defaultSaveMode: SaveMode = initialDefaultSaveMode;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  const reportSaveError = (error: unknown): void => {
    updateActiveSessionMeta({ dirtyState: "error" });
    const detail: string = error instanceof Error ? error.message : String(error);
    log.error("session_persistence", "save failed", { detail });
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
    if (typeof ensureSourceForActiveSession !== "function") {
      log.warn("session_persistence", "resolveSourceRef: ensureSourceForActiveSession not wired");
      return null;
    }
    try {
      log.info("session_persistence", "resolveSourceRef: calling ensureSourceForActiveSession", {
        sessionId: session.sessionId,
      });
      const ensured: EnsureSourceResult = (await ensureSourceForActiveSession(session, getPgnText())) as EnsureSourceResult;
      if (!isStillActive()) {
        log.info("session_persistence", "resolveSourceRef: abandoned — session no longer active", {
          sessionId: session.sessionId,
        });
        return "stale";
      }
      if (!ensured?.sourceRef) {
        log.warn("session_persistence", "resolveSourceRef: ensure returned no sourceRef", {
          sessionId: session.sessionId,
        });
        return null;
      }
      updateActiveSessionMeta({
        sourceRef: ensured.sourceRef,
        pendingResourceRef: null,
        revisionToken: String(ensured.revisionToken || ""),
      });
      log.info("session_persistence", "resolveSourceRef: ensured new sourceRef", {
        sessionId: session.sessionId,
        kind: typeof ensured.sourceRef.kind === "string" ? ensured.sourceRef.kind : "",
        hasLocator: typeof ensured.sourceRef.locator === "string" && ensured.sourceRef.locator.length > 0,
        hasRecordId: typeof ensured.sourceRef.recordId === "string" && ensured.sourceRef.recordId.length > 0,
      });
      return ensured.sourceRef;
    } catch (error: unknown) {
      if (!isStillActive()) {
        log.info("session_persistence", "resolveSourceRef: error path abandoned — session no longer active", {
          sessionId: session.sessionId,
        });
        return "stale";
      }
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
    wasCreate: boolean,
  ): Promise<void> => {
    try {
      log.info("session_persistence", "executeSave: invoking saveBySourceRef", {
        sessionId: session.sessionId,
        requestId,
        kind: typeof sourceRef.kind === "string" ? sourceRef.kind : "",
        hasLocator: typeof sourceRef.locator === "string" && sourceRef.locator.length > 0,
        hasRecordId: typeof sourceRef.recordId === "string" && sourceRef.recordId.length > 0,
      });
      const saveResult: SaveResult = await saveBySourceRef(
        sourceRef,
        getPgnText(),
        String(session.revisionToken || ""),
        { sessionId: session.sessionId },
      );
      if (requestId !== saveRequestSeq || !isStillActive()) {
        log.info("session_persistence", "executeSave: result ignored — stale request or inactive session", {
          sessionId: session.sessionId,
          requestId,
          latestRequestId: saveRequestSeq,
        });
        return;
      }
      updateActiveSessionMeta({
        dirtyState: "clean",
        revisionToken: String(saveResult.revisionToken || Date.now()),
      });
      const persistedRevisionToken: string = String(saveResult.revisionToken || Date.now());
      onSetSaveStatus(t("pgn.save.saved", "Saved"), "saved");
      log.info("session_persistence", "executeSave: completed", { sessionId: session.sessionId, requestId });
      if (typeof onAfterSuccessfulSave === "function") {
        onAfterSuccessfulSave({
          sourceRef,
          sessionId: session.sessionId,
          revisionToken: persistedRevisionToken,
          wasCreate,
        });
      }
    } catch (error: unknown) {
      if (requestId !== saveRequestSeq || !isStillActive()) {
        log.info("session_persistence", "executeSave: error ignored — stale request or inactive session", {
          sessionId: session.sessionId,
          requestId,
        });
        return;
      }
      reportSaveError(error);
    }
  };

  const persistActiveSessionNow = async (): Promise<void> => {
    const session: SessionLike | null = getActiveSession();
    if (!session) {
      log.warn("session_persistence", "persistActiveSessionNow: no active session");
      return;
    }
    const capturedSessionId: string = session.sessionId;
    const isStillActive = (): boolean => getActiveSession()?.sessionId === capturedSessionId;
    const initialRef = session.sourceRef || null;
    log.info("session_persistence", "persistActiveSessionNow: start", {
      sessionId: capturedSessionId,
      saveMode: session.saveMode || defaultSaveMode,
      hasInitialSourceRef: Boolean(initialRef),
      initialKind: typeof initialRef?.kind === "string" ? initialRef.kind : "",
    });
    let activeSourceRef: SourceRefLike | null = session.sourceRef || null;
    let wasCreate: boolean = false;
    if (!activeSourceRef) {
      const resolved = await resolveSourceRef(session, isStillActive);
      if (resolved === "stale") {
        log.info("session_persistence", "persistActiveSessionNow: aborted after resolve (stale)", {
          sessionId: capturedSessionId,
        });
        return;
      }
      if (resolved === null) {
        log.warn("session_persistence", "persistActiveSessionNow: aborted — could not resolve sourceRef", {
          sessionId: capturedSessionId,
        });
        return;
      }
      activeSourceRef = resolved;
      wasCreate = true;
    }
    const requestId: number = ++saveRequestSeq;
    updateActiveSessionMeta({ dirtyState: "saving" });
    onSetSaveStatus(t("pgn.save.saving", "Saving..."), "saving");
    await executeSave(activeSourceRef, session, requestId, isStillActive, wasCreate);
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
