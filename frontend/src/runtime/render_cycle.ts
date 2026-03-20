type RenderPipelineLike = {
  renderFull: () => void;
};

type GameSessionStoreLike = {
  persistActiveSession: () => void;
};

type GameTabsUiLike = {
  render: () => void;
};

type CreateRuntimeRenderCycleDeps = {
  getRenderPipeline: () => RenderPipelineLike | null;
  getGameSessionStore: () => GameSessionStoreLike | null;
  getGameTabsUi: () => GameTabsUiLike | null;
  publishSnapshots: () => void;
  syncBoardEditorPaneMaxHeight: () => void;
};

export const createRuntimeRenderCycle = ({
  getRenderPipeline,
  getGameSessionStore,
  getGameTabsUi,
  publishSnapshots,
  syncBoardEditorPaneMaxHeight,
}: CreateRuntimeRenderCycleDeps) => {
  return (): void => {
    const renderPipeline = getRenderPipeline();
    if (!renderPipeline) return;

    const sessionStore = getGameSessionStore();
    if (sessionStore) sessionStore.persistActiveSession();

    renderPipeline.renderFull();
    publishSnapshots();
    syncBoardEditorPaneMaxHeight();

    const gameTabs = getGameTabsUi();
    if (gameTabs) gameTabs.render();
  };
};
