import { createAppRenderPipeline } from "../app_shell/render_pipeline";

type RenderPipelineDeps = Parameters<typeof createAppRenderPipeline>[0];

type RenderPipelineBootstrapDeps = {
  state: RenderPipelineDeps["state"];
  t: RenderPipelineDeps["t"];
  boardCapabilities: RenderPipelineDeps["boardCapabilities"];
  selectionRuntimeCapabilities: RenderPipelineDeps["selectionRuntimeCapabilities"];
  els: RenderPipelineDeps["els"];
  buildGameAtPly: RenderPipelineDeps["buildGameAtPly"];
  renderBoard: RenderPipelineDeps["renderBoard"];
  renderMovesPanel: RenderPipelineDeps["renderMovesPanel"];
  renderTextEditor: RenderPipelineDeps["renderTextEditor"];
  renderAstPanel: RenderPipelineDeps["renderAstPanel"];
  renderDomView: RenderPipelineDeps["renderDomView"];
  renderResourceViewer: RenderPipelineDeps["renderResourceViewer"];
  renderGameInfoSummary: RenderPipelineDeps["renderGameInfoSummary"];
  syncGameInfoEditorValues: RenderPipelineDeps["syncGameInfoEditorValues"];
  syncGameInfoEditorUi: RenderPipelineDeps["syncGameInfoEditorUi"];
};

export const createRenderPipelineBootstrap = ({
  state,
  t,
  boardCapabilities,
  selectionRuntimeCapabilities,
  els,
  buildGameAtPly,
  renderBoard,
  renderMovesPanel,
  renderTextEditor,
  renderAstPanel,
  renderDomView,
  renderResourceViewer,
  renderGameInfoSummary,
  syncGameInfoEditorValues,
  syncGameInfoEditorUi,
}: RenderPipelineBootstrapDeps): ReturnType<typeof createAppRenderPipeline> => {
  return createAppRenderPipeline({
    state,
    t,
    boardCapabilities,
    selectionRuntimeCapabilities,
    els,
    buildGameAtPly,
    renderBoard,
    renderMovesPanel,
    renderTextEditor,
    renderAstPanel,
    renderDomView,
    renderResourceViewer,
    renderGameInfoSummary,
    syncGameInfoEditorValues,
    syncGameInfoEditorUi,
  });
};
