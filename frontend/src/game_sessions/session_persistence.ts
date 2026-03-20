/**
 * Session Persistence module.
 *
 * Integration API:
 * - Primary exports from this module: `createSessionPersistenceService`.
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

type DirtyState = "clean" | "dirty" | "saving" | "error" | string;

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

type SessionPersistenceState = {
  saveRequestSeq: number;
  isHydratingGame: boolean;
  defaultSaveMode: SaveMode;
  autosaveTimer: ReturnType<typeof setTimeout> | null;
};

type SessionPersistenceDeps = {
  state: Record<string, unknown>;
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
  state,
  t,
  getActiveSession,
  updateActiveSessionMeta,
  getPgnText,
  saveBySourceRef,
  ensureSourceForActiveSession,
  onSetSaveStatus,
  autosaveDebounceMs = 700,
}: SessionPersistenceDeps) => {
  const runtimeState: SessionPersistenceState = state as SessionPersistenceState;
  const persistActiveSessionNow = async (): Promise<void> => {
    const session: SessionLike | null = getActiveSession();
    if (!session) return;
    let activeSourceRef: SourceRefLike | null = session.sourceRef || null;
    if (!activeSourceRef && typeof ensureSourceForActiveSession === "function") {
      try {
        const ensured: EnsureSourceResult = (await ensureSourceForActiveSession(session, getPgnText())) as EnsureSourceResult;
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
        const detail: string = error instanceof Error ? error.message : String(error);
        onSetSaveStatus(
          `${t("pgn.save.error", "Autosave failed")}: ${detail}`.trim(),
          "error",
        );
        return;
      }
    }
    if (!activeSourceRef) return;
    const requestId: number = ++runtimeState.saveRequestSeq;
    updateActiveSessionMeta({ dirtyState: "saving" });
    onSetSaveStatus(t("pgn.save.saving", "Saving..."), "saving");
    try {
      const saveResult: SaveResult = await saveBySourceRef(
        activeSourceRef,
        getPgnText(),
        String(session.revisionToken || ""),
        { sessionId: session.sessionId },
      );
      if (requestId !== runtimeState.saveRequestSeq) return;
      updateActiveSessionMeta({
        dirtyState: "clean",
        revisionToken: String(saveResult.revisionToken || Date.now()),
      });
      onSetSaveStatus(t("pgn.save.saved", "Saved"), "saved");
      return;
    } catch (error: unknown) {
      if (requestId !== runtimeState.saveRequestSeq) return;
      updateActiveSessionMeta({ dirtyState: "error" });
      const detail: string = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(
        `${t("pgn.save.error", "Autosave failed")}: ${detail}`.trim(),
        "error",
      );
      return;
    }
  };

  const scheduleAutosaveForActiveSession = (): void => {
    if (runtimeState.isHydratingGame) return;
    const session: SessionLike | null = getActiveSession();
    if (!session) return;
    const sessionMode: SaveMode = session.saveMode || runtimeState.defaultSaveMode;
    if (sessionMode !== "auto") return;
    updateActiveSessionMeta({ dirtyState: "dirty" });
    if (runtimeState.autosaveTimer) {
      window.clearTimeout(runtimeState.autosaveTimer);
      runtimeState.autosaveTimer = null;
    }
    runtimeState.autosaveTimer = window.setTimeout((): void => {
      runtimeState.autosaveTimer = null;
      void persistActiveSessionNow();
    }, autosaveDebounceMs);
  };

  const setActiveSessionSaveMode = (mode: string): void => {
    const nextMode: SaveMode = mode === "manual" ? "manual" : "auto";
    updateActiveSessionMeta({ saveMode: nextMode });
    runtimeState.defaultSaveMode = nextMode;
  };

  return {
    persistActiveSessionNow,
    scheduleAutosaveForActiveSession,
    setActiveSessionSaveMode,
  };
};
