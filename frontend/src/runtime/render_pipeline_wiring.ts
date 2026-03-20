import { text_editor } from "../editor";
import { ast_panel, renderMovesPanel } from "../panels";
import {
  renderGameInfoSummary,
  syncGameInfoEditorUi,
  syncGameInfoEditorValues,
} from "../app_shell/game_info";
import { createRenderPipelineBootstrap } from "./render_pipeline_bootstrap";

type RenderPipelineBootstrapDeps = Parameters<typeof createRenderPipelineBootstrap>[0];

type RenderPipelineWiringDeps = {
  state: RenderPipelineBootstrapDeps["state"];
  t: RenderPipelineBootstrapDeps["t"];
  boardCapabilities: RenderPipelineBootstrapDeps["boardCapabilities"];
  selectionRuntimeCapabilities: {
    getTextEditorOptions: () => Record<string, unknown>;
  };
  boardRuntimeCapabilities: {
    buildGameAtPly: RenderPipelineBootstrapDeps["buildGameAtPly"];
    renderBoard: (game: Parameters<RenderPipelineBootstrapDeps["renderBoard"]>[0]) => void;
  };
  resourceViewerCapabilities: { render: () => void } | null;
  uiAdapters: {
    renderDomView: RenderPipelineBootstrapDeps["renderDomView"];
  };
  els: RenderPipelineBootstrapDeps["els"];
  astViewEl: Element | null;
  textEditorEl: Element | null;
  gameInfoInputs: Array<HTMLInputElement | HTMLSelectElement>;
  gameInfoPlayersValueEl: HTMLElement | null;
  gameInfoEventValueEl: HTMLElement | null;
  gameInfoDateValueEl: HTMLElement | null;
  gameInfoOpeningValueEl: HTMLElement | null;
  gameInfoEditorEl: HTMLElement | null;
  btnGameInfoEdit: HTMLElement | null;
};

export const createRenderPipelineWiring = ({
  state,
  t,
  boardCapabilities,
  selectionRuntimeCapabilities,
  boardRuntimeCapabilities,
  resourceViewerCapabilities,
  uiAdapters,
  els,
  astViewEl,
  textEditorEl,
  gameInfoInputs,
  gameInfoPlayersValueEl,
  gameInfoEventValueEl,
  gameInfoDateValueEl,
  gameInfoOpeningValueEl,
  gameInfoEditorEl,
  btnGameInfoEdit,
}: RenderPipelineWiringDeps): ReturnType<typeof createRenderPipelineBootstrap> => {
  return createRenderPipelineBootstrap({
    state,
    t,
    boardCapabilities,
    selectionRuntimeCapabilities,
    els,
    buildGameAtPly: boardRuntimeCapabilities.buildGameAtPly,
    renderBoard: (game: Parameters<RenderPipelineBootstrapDeps["renderBoard"]>[0]): void => {
      boardRuntimeCapabilities.renderBoard(game);
    },
    renderMovesPanel,
    renderTextEditor: (): void => {
      text_editor.render(textEditorEl, state.pgnModel, selectionRuntimeCapabilities.getTextEditorOptions());
    },
    renderAstPanel: (): void => {
      ast_panel.render(astViewEl, state.pgnModel);
    },
    renderDomView: uiAdapters.renderDomView,
    renderResourceViewer: (): void => {
      if (resourceViewerCapabilities) {
        resourceViewerCapabilities.render();
      }
    },
    renderGameInfoSummary: (): void => {
      renderGameInfoSummary({
        pgnModel: state.pgnModel,
        t,
        els: {
          gameInfoPlayersValueEl,
          gameInfoEventValueEl,
          gameInfoDateValueEl,
          gameInfoOpeningValueEl,
        },
      });
    },
    syncGameInfoEditorValues: (): void => {
      syncGameInfoEditorValues({
        pgnModel: state.pgnModel,
        els: { gameInfoInputs },
      });
    },
    syncGameInfoEditorUi: (): void => {
      syncGameInfoEditorUi({
        state: state as unknown as Parameters<typeof syncGameInfoEditorUi>[0]["state"],
        els: {
          gameInfoEditorEl,
          btnGameInfoEdit,
        },
      });
    },
  });
};
