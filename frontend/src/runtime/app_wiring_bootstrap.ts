import { createAppWiringCapabilities } from "../app_shell/wiring";

type AppWiringDeps = Parameters<typeof createAppWiringCapabilities>[0];
type AppWiringElements = AppWiringDeps["els"];
type AppWiringActions = AppWiringDeps["actions"];

type AppWiringState = AppWiringDeps["state"] & {
  isGameInfoEditorOpen: boolean;
};

type AppWiringBootstrapDeps = {
  state: AppWiringState;
  t: AppWiringDeps["t"];
  els: AppWiringElements;
  render: () => void;
  uiAdapters: {
    setSaveStatus: AppWiringActions["setSaveStatus"];
  };
  boardNavigationCapabilities: {
    gotoPly: AppWiringActions["gotoPly"];
    gotoRelativeStep: AppWiringActions["gotoRelativeStep"];
  };
  pgnRuntimeCapabilities: {
    loadPgn: AppWiringActions["loadPgn"];
  };
  historyCapabilities: {
    performUndo: AppWiringActions["performUndo"];
    performRedo: AppWiringActions["performRedo"];
  };
  selectionRuntimeCapabilities: {
    formatFocusedComment: AppWiringActions["formatCommentStyle"];
    insertAroundSelectedMove: AppWiringActions["insertAroundSelectedMove"];
  };
  applyDefaultIndentHandler: AppWiringActions["applyDefaultIndent"];
  setPgnLayoutModeHandler: AppWiringActions["setPgnLayoutMode"];
  handleLivePgnInputHandler: AppWiringActions["handleLivePgnInput"];
  selectDevTabHandler: AppWiringActions["selectDevTab"];
  hydrateVisualAssets: AppWiringActions["hydrateVisualAssets"];
  resourcesCapabilities: {
    loadRuntimeConfigFromClientDataAndDefaults: AppWiringActions["loadRuntimeConfigFromClientDataAndDefaults"];
  };
  boardRuntimeCapabilities: {
    ensureBoard: () => Promise<boolean> | Promise<void>;
  };
  initializeDefaultPgnHandler: AppWiringActions["initializeWithDefaultPgn"];
  updateGameInfoHeaderHandler: AppWiringActions["updateGameInfoHeader"];
  playerAutocompleteCapabilities: {
    isPlayerNameField: AppWiringActions["isPlayerNameField"];
    loadPlayerStore: AppWiringActions["loadPlayerStore"];
    handlePlayerNameInput: AppWiringActions["handlePlayerNameInput"];
    handlePlayerNameKeydown: AppWiringActions["handlePlayerNameKeydown"];
    commitPlayerNameInput: AppWiringActions["commitPlayerNameInput"];
    pickPlayerNameSuggestion: AppWiringActions["pickPlayerNameSuggestion"];
  };
};

export const createAppWiringBootstrap = ({
  state,
  t,
  els,
  render,
  uiAdapters,
  boardNavigationCapabilities,
  pgnRuntimeCapabilities,
  historyCapabilities,
  selectionRuntimeCapabilities,
  applyDefaultIndentHandler,
  setPgnLayoutModeHandler,
  handleLivePgnInputHandler,
  selectDevTabHandler,
  hydrateVisualAssets,
  resourcesCapabilities,
  boardRuntimeCapabilities,
  initializeDefaultPgnHandler,
  updateGameInfoHeaderHandler,
  playerAutocompleteCapabilities,
}: AppWiringBootstrapDeps): ReturnType<typeof createAppWiringCapabilities> => {
  const actions: AppWiringActions = {
    gotoPly: boardNavigationCapabilities.gotoPly,
    gotoRelativeStep: boardNavigationCapabilities.gotoRelativeStep,
    loadPgn: pgnRuntimeCapabilities.loadPgn,
    performUndo: historyCapabilities.performUndo,
    performRedo: historyCapabilities.performRedo,
    formatCommentStyle: selectionRuntimeCapabilities.formatFocusedComment,
    insertAroundSelectedMove: selectionRuntimeCapabilities.insertAroundSelectedMove,
    applyDefaultIndent: applyDefaultIndentHandler,
    setPgnLayoutMode: setPgnLayoutModeHandler,
    setSaveStatus: uiAdapters.setSaveStatus,
    handleLivePgnInput: handleLivePgnInputHandler,
    selectDevTab: selectDevTabHandler,
    hydrateVisualAssets,
    loadRuntimeConfigFromClientDataAndDefaults: resourcesCapabilities.loadRuntimeConfigFromClientDataAndDefaults,
    ensureBoard: async (): Promise<void> => {
      await boardRuntimeCapabilities.ensureBoard();
    },
    initializeWithDefaultPgn: initializeDefaultPgnHandler,
    toggleGameInfoEditor: (): void => {
      state.isGameInfoEditorOpen = !state.isGameInfoEditorOpen;
      render();
    },
    updateGameInfoHeader: updateGameInfoHeaderHandler,
    isPlayerNameField: playerAutocompleteCapabilities.isPlayerNameField,
    loadPlayerStore: playerAutocompleteCapabilities.loadPlayerStore,
    handlePlayerNameInput: playerAutocompleteCapabilities.handlePlayerNameInput,
    handlePlayerNameKeydown: playerAutocompleteCapabilities.handlePlayerNameKeydown,
    commitPlayerNameInput: playerAutocompleteCapabilities.commitPlayerNameInput,
    pickPlayerNameSuggestion: playerAutocompleteCapabilities.pickPlayerNameSuggestion,
  };

  return createAppWiringCapabilities({
    state,
    t,
    els,
    actions,
  });
};
