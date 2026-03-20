import { createAppShellCapabilities } from "../app_shell";

type AppShellDeps = Parameters<typeof createAppShellCapabilities>[0];

type AppShellBootstrapDeps = {
  state: AppShellDeps["state"];
  t: AppShellDeps["t"];
  els: {
    btnMenu: AppShellDeps["btnMenu"];
    btnMenuClose: AppShellDeps["btnMenuClose"];
    menuPanel: AppShellDeps["menuPanel"];
    menuBackdrop: AppShellDeps["menuBackdrop"];
    speedInput: AppShellDeps["speedInput"];
    speedValue: AppShellDeps["speedValue"];
    soundInput: AppShellDeps["soundInput"];
    localeInput: AppShellDeps["localeInput"];
    developerToolsInput: AppShellDeps["developerToolsInput"];
    btnDevDockToggle: AppShellDeps["btnDevDockToggle"];
    btnDevDockClose: AppShellDeps["btnDevDockClose"];
    saveModeInput: AppShellDeps["saveModeInput"];
    btnSaveActiveGame: AppShellDeps["btnSaveActiveGame"];
    developerDockEl: AppShellDeps["developerDockEl"];
    devDockResizeHandleEl: AppShellDeps["devDockResizeHandleEl"];
    boardEditorBoxEl: AppShellDeps["boardEditorBoxEl"];
    boardEditorResizeHandleEl: AppShellDeps["boardEditorResizeHandleEl"];
    resourceViewerResizeHandleEl: AppShellDeps["resourceViewerResizeHandleEl"];
    resourceViewerCardEl: AppShellDeps["resourceViewerCardEl"];
  };
  boardNavigationCapabilities: {
    handleSelectedMoveArrowHotkey: AppShellDeps["onHandleSelectedMoveArrowHotkey"];
  };
  historyCapabilities: {
    performUndo: AppShellDeps["onUndo"];
    performRedo: AppShellDeps["onRedo"];
  };
  appShellHandlers: {
    onChangeLocale: AppShellDeps["onChangeLocale"];
    onChangeDeveloperTools: AppShellDeps["onChangeDeveloperTools"];
    onChangeDeveloperDockOpen: AppShellDeps["onChangeDeveloperDockOpen"];
    onSwitchDeveloperDockTab: AppShellDeps["onSwitchDeveloperDockTab"];
    onChangeActiveSaveMode: AppShellDeps["onChangeActiveSaveMode"];
    onChangeBoardColumnWidth: AppShellDeps["onChangeBoardColumnWidth"];
    onChangeResourceViewerHeight: AppShellDeps["onChangeResourceViewerHeight"];
  };
  onSaveActiveGameNow: AppShellDeps["onSaveActiveGameNow"];
};

export const createAppShellBootstrap = ({
  state,
  t,
  els,
  boardNavigationCapabilities,
  historyCapabilities,
  appShellHandlers,
  onSaveActiveGameNow,
}: AppShellBootstrapDeps): ReturnType<typeof createAppShellCapabilities> => {
  return createAppShellCapabilities({
    state,
    t,
    btnMenu: els.btnMenu,
    btnMenuClose: els.btnMenuClose,
    menuPanel: els.menuPanel,
    menuBackdrop: els.menuBackdrop,
    speedInput: els.speedInput,
    speedValue: els.speedValue,
    soundInput: els.soundInput,
    localeInput: els.localeInput,
    developerToolsInput: els.developerToolsInput,
    btnDevDockToggle: els.btnDevDockToggle,
    btnDevDockClose: els.btnDevDockClose,
    saveModeInput: els.saveModeInput,
    btnSaveActiveGame: els.btnSaveActiveGame,
    developerDockEl: els.developerDockEl,
    devDockResizeHandleEl: els.devDockResizeHandleEl,
    boardEditorBoxEl: els.boardEditorBoxEl,
    boardEditorResizeHandleEl: els.boardEditorResizeHandleEl,
    resourceViewerResizeHandleEl: els.resourceViewerResizeHandleEl,
    resourceViewerCardEl: els.resourceViewerCardEl,
    onHandleSelectedMoveArrowHotkey: boardNavigationCapabilities.handleSelectedMoveArrowHotkey,
    onUndo: historyCapabilities.performUndo,
    onRedo: historyCapabilities.performRedo,
    onChangeLocale: appShellHandlers.onChangeLocale,
    onChangeDeveloperTools: appShellHandlers.onChangeDeveloperTools,
    onChangeDeveloperDockOpen: appShellHandlers.onChangeDeveloperDockOpen,
    onSwitchDeveloperDockTab: appShellHandlers.onSwitchDeveloperDockTab,
    onChangeActiveSaveMode: appShellHandlers.onChangeActiveSaveMode,
    onChangeBoardColumnWidth: appShellHandlers.onChangeBoardColumnWidth,
    onChangeResourceViewerHeight: appShellHandlers.onChangeResourceViewerHeight,
    onSaveActiveGameNow,
  });
};
