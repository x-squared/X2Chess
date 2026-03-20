type TabResourceRef = {
  kind: string;
  locator: string;
};

type ResourceViewerInitTab = {
  title: string;
  resourceRef: TabResourceRef;
};

type ResourceViewerCapabilitiesLike = {
  setTabs: (tabs: ResourceViewerInitTab[]) => void;
  refreshActiveTabRows: () => Promise<void>;
};

type ResourcesCapabilitiesLike = {
  getAvailableSourceKinds: () => string[];
};

type ResourceViewerInitState = {
  gameRootPath: string;
  gameDirectoryPath: string;
};

type ResourceViewerInitDeps = {
  resourcesCapabilities: ResourcesCapabilitiesLike;
  resourceViewerCapabilities: ResourceViewerCapabilitiesLike;
  state: ResourceViewerInitState;
  t: (key: string, fallback?: string) => string;
};

const buildInitialTabs = ({
  resourcesCapabilities,
  state,
  t,
}: Pick<ResourceViewerInitDeps, "resourcesCapabilities" | "state" | "t">): ResourceViewerInitTab[] => {
  const kinds: string[] = resourcesCapabilities
    .getAvailableSourceKinds()
    .filter((kind: string): boolean => kind !== "pgn-db");

  return kinds.map((kind: string): ResourceViewerInitTab => ({
    title: t(`resources.tab.${kind}`, kind.toUpperCase()),
    resourceRef: {
      kind,
      locator: kind === "directory"
        ? (state.gameRootPath || state.gameDirectoryPath || "local-files")
        : `local-${kind}`,
    },
  }));
};

export const initializeResourceViewerTabs = async ({
  resourcesCapabilities,
  resourceViewerCapabilities,
  state,
  t,
}: ResourceViewerInitDeps): Promise<void> => {
  const tabs: ResourceViewerInitTab[] = buildInitialTabs({ resourcesCapabilities, state, t });
  resourceViewerCapabilities.setTabs(tabs);
  await resourceViewerCapabilities.refreshActiveTabRows();
};
