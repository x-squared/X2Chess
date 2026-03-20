import type { SourceRefLike } from "./bootstrap_shared";

type SessionLike = {
  title?: string;
  pendingResourceRef?: SourceRefLike | null;
};

type SessionOpenState = {
  defaultSaveMode: string;
  nextSessionSeq: number;
  activeSourceKind: string;
  gameDirectoryPath: string;
  gameDirectoryHandle: unknown;
};

type GameSessionModelLike = {
  createSessionFromPgnText: (pgnText: string) => { pgnModel: unknown };
  deriveSessionTitle: (model: unknown, fallbackTitle: string) => string;
};

type GameSessionStoreLike = {
  openSession: (input: {
    snapshot: unknown;
    title: string;
    sourceRef?: SourceRefLike | null;
    pendingResourceRef?: SourceRefLike | null;
    revisionToken?: string;
    saveMode?: string;
  }) => void;
  updateActiveSessionMeta: (patch: { dirtyState?: string; saveMode?: "auto" | "manual" }) => void;
};

type ResourcesCapabilitiesLike = {
  loadGameBySourceRef: (sourceRef: SourceRefLike) => Promise<{ pgnText: string; revisionToken: string; titleHint: string }>;
};

type ResourceViewerCapabilitiesLike = {
  getActiveResourceRef: () => SourceRefLike | null;
};

type SessionOpenFlowDeps = {
  state: SessionOpenState;
  t: (key: string, fallback?: string) => string;
  gameSessionModel: GameSessionModelLike;
  gameSessionStore: GameSessionStoreLike;
  resourcesCapabilities: ResourcesCapabilitiesLike;
  resourceViewerCapabilities: ResourceViewerCapabilitiesLike;
  normalizeResourceRefForInsert: (resourceRef: SourceRefLike | null, state: SessionOpenState) => SourceRefLike | null;
  ensureResourceTabVisible: (resourceRef: SourceRefLike | null, select?: boolean) => Promise<void>;
  render: () => void;
};

type OpenSessionFromSnapshotInput = {
  snapshot: unknown;
  title: string;
  sourceRef?: SourceRefLike | null;
  pendingResourceRef?: SourceRefLike | null;
  revisionToken?: string;
  saveMode?: string;
};

export const createSessionOpenFlow = ({
  state,
  t,
  gameSessionModel,
  gameSessionStore,
  resourcesCapabilities,
  resourceViewerCapabilities,
  normalizeResourceRefForInsert,
  ensureResourceTabVisible,
  render,
}: SessionOpenFlowDeps) => {
  const openSessionFromSnapshot = ({
    snapshot,
    title,
    sourceRef = null,
    pendingResourceRef = null,
    revisionToken = "",
    saveMode = state.defaultSaveMode,
  }: OpenSessionFromSnapshotInput): void => {
    gameSessionStore.openSession({
      snapshot,
      title,
      sourceRef,
      pendingResourceRef,
      revisionToken,
      saveMode,
    });
    state.defaultSaveMode = saveMode;
    render();
  };

  const openSessionFromPgnText = (
    pgnText: string,
    preferredTitle: string = "",
    sourceRef: SourceRefLike | null = null,
    revisionToken: string = "",
  ): void => {
    const snapshot = gameSessionModel.createSessionFromPgnText(String(pgnText || ""));
    const fallbackTitle = preferredTitle || `${t("games.tabFallback", "Game")} ${state.nextSessionSeq}`;
    const title = gameSessionModel.deriveSessionTitle(snapshot.pgnModel, fallbackTitle);
    openSessionFromSnapshot({
      snapshot,
      title,
      sourceRef,
      revisionToken,
      saveMode: state.defaultSaveMode,
    });
  };

  const openUnsavedSessionFromPgnText = (
    pgnText: string,
    preferredTitle: string = "",
    pendingResourceRef: SourceRefLike | null = null,
  ): void => {
    const snapshot = gameSessionModel.createSessionFromPgnText(String(pgnText || ""));
    openSessionFromSnapshot({
      snapshot,
      title: preferredTitle || t("games.new", "New game"),
      sourceRef: null,
      pendingResourceRef,
      revisionToken: "",
      saveMode: "auto",
    });
    gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
  };

  const openSessionFromSourceRef = async (
    sourceRef: SourceRefLike,
    preferredTitle: string = "",
  ): Promise<void> => {
    const loaded = await resourcesCapabilities.loadGameBySourceRef(sourceRef);
    openSessionFromPgnText(
      loaded.pgnText,
      preferredTitle || loaded.titleHint,
      sourceRef,
      loaded.revisionToken,
    );
    if (sourceRef?.kind && sourceRef.kind === "file") {
      gameSessionStore.updateActiveSessionMeta({ saveMode: "manual" });
    }
  };

  const resolvePendingResourceRefForInsert = (session: SessionLike | null | undefined): SourceRefLike | null => {
    return normalizeResourceRefForInsert(
      session?.pendingResourceRef || resourceViewerCapabilities.getActiveResourceRef() || {
        kind: state.activeSourceKind || "directory",
        locator: state.gameDirectoryPath || "",
      },
      state,
    );
  };

  return {
    openSessionFromSnapshot,
    openSessionFromPgnText,
    openUnsavedSessionFromPgnText,
    openSessionFromSourceRef,
    resolvePendingResourceRefForInsert,
    ensureResourceTabVisible,
  };
};
