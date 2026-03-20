import { createSessionOpenFlow } from "./session_open_flow";
import { createEnsureResourceTabVisible } from "./resource_tab_visibility";
import { createResourceViewerBootstrap } from "./resource_viewer_bootstrap";
import { createSessionBootstrapCapabilities } from "./session_bootstrap";
import type { SourceRefLike } from "./bootstrap_shared";

type SessionBootstrapDeps = Parameters<typeof createSessionBootstrapCapabilities>[0];
type SessionOpenFlowDeps = Parameters<typeof createSessionOpenFlow>[0];
type ResourceViewerBootstrapDeps = Parameters<typeof createResourceViewerBootstrap>[0];

type SessionResourceFlowBootstrapDeps = {
  state: SessionBootstrapDeps["state"] & ResourceViewerBootstrapDeps["state"] & SessionOpenFlowDeps["state"];
  t: SessionBootstrapDeps["t"];
  pgnInput: SessionBootstrapDeps["pgnInput"];
  parsePgnToModelFn: SessionBootstrapDeps["parsePgnToModelFn"];
  serializeModelToPgnFn: SessionBootstrapDeps["serializeModelToPgnFn"];
  ensureRequiredPgnHeadersFn: SessionBootstrapDeps["ensureRequiredPgnHeadersFn"];
  buildMovePositionByIdFn: SessionBootstrapDeps["buildMovePositionByIdFn"];
  stripAnnotationsForBoardParserFn: SessionBootstrapDeps["stripAnnotationsForBoardParserFn"];
  getHeaderValueFn: SessionBootstrapDeps["getHeaderValueFn"];
  resourcesCapabilities: SessionBootstrapDeps["resourcesCapabilities"] & SessionOpenFlowDeps["resourcesCapabilities"] & {
    listGamesForResource: ResourceViewerBootstrapDeps["resourcesCapabilities"]["listGamesForResource"];
    chooseResourceByPicker: ResourceViewerBootstrapDeps["resourcesCapabilities"]["chooseResourceByPicker"];
  };
  normalizeResourceRefForInsertFn: (resourceRef: SourceRefLike | null, state: unknown) => SourceRefLike | null;
  onSetSaveStatus: SessionBootstrapDeps["onSetSaveStatus"];
  render: () => void;
  viewerEls: {
    btnResourceMetadata: ResourceViewerBootstrapDeps["btnResourceMetadata"];
    btnOpenResource: ResourceViewerBootstrapDeps["btnOpenResource"];
    resourceMetadataDialogEl: ResourceViewerBootstrapDeps["resourceMetadataDialogEl"];
    resourceMetadataFieldsEl: ResourceViewerBootstrapDeps["resourceMetadataFieldsEl"];
    resourceMetadataApplyAllEl: ResourceViewerBootstrapDeps["resourceMetadataApplyAllEl"];
    btnResourceMetadataReset: ResourceViewerBootstrapDeps["btnResourceMetadataReset"];
    btnResourceMetadataCancel: ResourceViewerBootstrapDeps["btnResourceMetadataCancel"];
    btnResourceMetadataSave: ResourceViewerBootstrapDeps["btnResourceMetadataSave"];
    resourceTabsEl: ResourceViewerBootstrapDeps["resourceTabsEl"];
    resourceTableWrapEl: ResourceViewerBootstrapDeps["resourceTableWrapEl"];
  };
};

type SessionResourceFlowBootstrapResult = ReturnType<typeof createSessionBootstrapCapabilities> & {
  resourceViewerCapabilities: ReturnType<typeof createResourceViewerBootstrap>;
  ensureResourceTabVisible: (resourceRef: SourceRefLike | null, select?: boolean) => Promise<void>;
  sessionOpenFlow: ReturnType<typeof createSessionOpenFlow>;
};

export const createSessionResourceFlowBootstrap = ({
  state,
  t,
  pgnInput,
  parsePgnToModelFn,
  serializeModelToPgnFn,
  ensureRequiredPgnHeadersFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  getHeaderValueFn,
  resourcesCapabilities,
  normalizeResourceRefForInsertFn,
  onSetSaveStatus,
  render,
  viewerEls,
}: SessionResourceFlowBootstrapDeps): SessionResourceFlowBootstrapResult => {
  let gameSessionModel!: ReturnType<typeof createSessionBootstrapCapabilities>["gameSessionModel"];
  let gameSessionStore!: ReturnType<typeof createSessionBootstrapCapabilities>["gameSessionStore"];
  let sessionPersistenceService!: ReturnType<typeof createSessionBootstrapCapabilities>["sessionPersistenceService"];

  let ensureResourceTabVisible: (resourceRef: SourceRefLike | null, select?: boolean) => Promise<void> = async () => {};
  let sessionOpenFlow: ReturnType<typeof createSessionOpenFlow> = {
    openSessionFromSnapshot: () => {},
    openSessionFromPgnText: () => {},
    openUnsavedSessionFromPgnText: () => {},
    openSessionFromSourceRef: async () => {},
    resolvePendingResourceRefForInsert: () => null,
    ensureResourceTabVisible: async () => {},
  };

  const resourceViewerCapabilities = createResourceViewerBootstrap({
    state,
    t,
    btnResourceMetadata: viewerEls.btnResourceMetadata,
    btnOpenResource: viewerEls.btnOpenResource,
    resourceMetadataDialogEl: viewerEls.resourceMetadataDialogEl,
    resourceMetadataFieldsEl: viewerEls.resourceMetadataFieldsEl,
    resourceMetadataApplyAllEl: viewerEls.resourceMetadataApplyAllEl,
    btnResourceMetadataReset: viewerEls.btnResourceMetadataReset,
    btnResourceMetadataCancel: viewerEls.btnResourceMetadataCancel,
    btnResourceMetadataSave: viewerEls.btnResourceMetadataSave,
    resourceTabsEl: viewerEls.resourceTabsEl,
    resourceTableWrapEl: viewerEls.resourceTableWrapEl,
    resourcesCapabilities,
    gameSessionStore,
    sessionOpenFlow,
    ensureResourceTabVisible,
    render,
  });

  ensureResourceTabVisible = createEnsureResourceTabVisible({
    resourceViewerCapabilities,
    t,
  });

  ({
    gameSessionModel,
    gameSessionStore,
    sessionPersistenceService,
  } = createSessionBootstrapCapabilities({
    state,
    t,
    pgnInput,
    parsePgnToModelFn,
    serializeModelToPgnFn,
    ensureRequiredPgnHeadersFn,
    buildMovePositionByIdFn,
    stripAnnotationsForBoardParserFn,
    getHeaderValueFn,
    resourcesCapabilities,
    resourceViewerCapabilities,
    normalizeResourceRefForInsertFn: (resourceRef, runtimeState): SourceRefLike | null =>
      normalizeResourceRefForInsertFn(resourceRef, runtimeState as unknown),
    ensureResourceTabVisible,
    onSetSaveStatus,
  }));

  sessionOpenFlow = createSessionOpenFlow({
    state,
    t,
    gameSessionModel,
    gameSessionStore,
    resourcesCapabilities,
    resourceViewerCapabilities,
    normalizeResourceRefForInsert: (resourceRef, runtimeState): SourceRefLike | null =>
      normalizeResourceRefForInsertFn(resourceRef, runtimeState as unknown),
    ensureResourceTabVisible,
    render,
  });

  return {
    resourceViewerCapabilities,
    ensureResourceTabVisible,
    gameSessionModel,
    gameSessionStore,
    sessionPersistenceService,
    sessionOpenFlow,
  };
};
