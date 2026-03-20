import type { SourceRefLike } from "./bootstrap_shared";

type ListedGame = {
  sourceRef: SourceRefLike;
  titleHint?: string;
};

type ResourcesCapabilitiesLike = {
  listSourceGames: (kind: string) => Promise<ListedGame[]>;
};

type SessionOpenFlowLike = {
  openSessionFromSourceRef: (sourceRef: SourceRefLike, preferredTitle?: string) => Promise<void>;
  openSessionFromPgnText: (pgnText: string, preferredTitle?: string) => void;
};

type ResourceViewerCapabilitiesLike = {
  refreshActiveTabRows: () => Promise<void>;
};

type PgnRuntimeCapabilitiesLike = {
  initializeWithDefaultPgn: () => void;
};

type GameSessionStoreLike = {
  getActiveSession: () => unknown | null;
};

type DefaultPgnInitState = {
  pgnText: string;
};

type InitializeDefaultPgnFlowDeps = {
  resourcesCapabilities: ResourcesCapabilitiesLike;
  sessionOpenFlow: SessionOpenFlowLike;
  resourceViewerCapabilities: ResourceViewerCapabilitiesLike;
  pgnRuntimeCapabilities: PgnRuntimeCapabilitiesLike;
  gameSessionStore: GameSessionStoreLike;
  state: DefaultPgnInitState;
  t: (key: string, fallback?: string) => string;
  render: () => void;
};

export const initializeDefaultPgnFlow = ({
  resourcesCapabilities,
  sessionOpenFlow,
  resourceViewerCapabilities,
  pgnRuntimeCapabilities,
  gameSessionStore,
  state,
  t,
  render,
}: InitializeDefaultPgnFlowDeps): void => {
  const run = async (): Promise<void> => {
    const listed = await resourcesCapabilities.listSourceGames("directory");
    if (listed.length > 0) {
      await sessionOpenFlow.openSessionFromSourceRef(
        listed[0].sourceRef,
        listed[0].titleHint || String(listed[0].sourceRef?.recordId || ""),
      );
      await resourceViewerCapabilities.refreshActiveTabRows();
      render();
      return;
    }

    pgnRuntimeCapabilities.initializeWithDefaultPgn();
    if (!gameSessionStore.getActiveSession()) {
      sessionOpenFlow.openSessionFromPgnText(state.pgnText, t("games.new", "New game"));
    }
    await resourceViewerCapabilities.refreshActiveTabRows();
    render();
  };

  void run();
};
