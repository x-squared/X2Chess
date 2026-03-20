type LivePgnState = {
  pgnText: string;
  pgnModel: unknown;
};

type PgnRuntimeLike = {
  syncChessParseState: (source: string, options?: { clearOnFailure?: boolean }) => void;
};

type RenderPipelineLike = {
  renderLiveInput: () => void;
};

type SessionStoreLike = {
  updateActiveSessionMeta: (patch: { dirtyState: string }) => void;
};

type SessionPersistenceLike = {
  scheduleAutosaveForActiveSession: () => void;
};

type GameTabsUiLike = {
  render: () => void;
};

type HandleLivePgnInputDeps = {
  state: LivePgnState;
  pgnInput: Element | null;
  parsePgnToModel: (source: string) => unknown;
  ensureRequiredPgnHeaders: (model: unknown) => unknown;
  pgnRuntimeCapabilities: PgnRuntimeLike;
  renderPipelineCapabilities: RenderPipelineLike | null;
  gameSessionStore: SessionStoreLike;
  sessionPersistenceService: SessionPersistenceLike;
  gameTabsUi: GameTabsUiLike;
};

export const handleLivePgnInputFromRuntime = ({
  state,
  pgnInput,
  parsePgnToModel,
  ensureRequiredPgnHeaders,
  pgnRuntimeCapabilities,
  renderPipelineCapabilities,
  gameSessionStore,
  sessionPersistenceService,
  gameTabsUi,
}: HandleLivePgnInputDeps): void => {
  if (!(pgnInput instanceof HTMLTextAreaElement)) return;
  state.pgnText = pgnInput.value;
  state.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(state.pgnText));
  pgnRuntimeCapabilities.syncChessParseState(state.pgnText.trim(), { clearOnFailure: true });
  if (renderPipelineCapabilities) renderPipelineCapabilities.renderLiveInput();
  gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
  sessionPersistenceService.scheduleAutosaveForActiveSession();
  gameTabsUi.render();
};
