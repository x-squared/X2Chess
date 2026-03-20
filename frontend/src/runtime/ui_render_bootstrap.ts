import { createUiAdapters } from "../app_shell/ui_adapters";
import { setPgnSaveStatus, renderDomPanel } from "../panels";
import { createRuntimeRenderCycle } from "./render_cycle";
import { publishRuntimeSnapshots } from "./publish_snapshots";
import { syncBoardEditorPaneMaxHeight } from "./board_editor_layout";

type UiRenderBootstrapDeps = {
  state: Parameters<typeof publishRuntimeSnapshots>[0];
  saveStatusEl: Parameters<typeof createUiAdapters>[0]["saveStatusEl"];
  domViewEl: Parameters<typeof createUiAdapters>[0]["domViewEl"];
  textEditorEl: Parameters<typeof createUiAdapters>[0]["textEditorEl"];
  boardEl: Element | null;
  boardEditorPaneEl: Element | null;
  getRenderPipeline: () => { renderFull: () => void } | null;
  getGameSessionStore: () => { persistActiveSession: () => void; listSessions: () => unknown[] } | null;
  getGameTabsUi: () => { render: () => void } | null;
};

type UiRenderBootstrapResult = {
  uiAdapters: ReturnType<typeof createUiAdapters>;
  render: () => void;
};

export const createUiRenderBootstrap = ({
  state,
  saveStatusEl,
  domViewEl,
  textEditorEl,
  boardEl,
  boardEditorPaneEl,
  getRenderPipeline,
  getGameSessionStore,
  getGameTabsUi,
}: UiRenderBootstrapDeps): UiRenderBootstrapResult => {
  const uiAdapters = createUiAdapters({
    saveStatusEl,
    domViewEl,
    textEditorEl,
    setPgnSaveStatusFn: setPgnSaveStatus,
    renderDomPanelFn: renderDomPanel,
  });

  const render = createRuntimeRenderCycle({
    getRenderPipeline,
    getGameSessionStore,
    getGameTabsUi,
    publishSnapshots: (): void => {
      publishRuntimeSnapshots(state, getGameSessionStore() || null);
    },
    syncBoardEditorPaneMaxHeight: (): void => {
      syncBoardEditorPaneMaxHeight(boardEl, boardEditorPaneEl);
    },
  });

  return {
    uiAdapters,
    render,
  };
};
