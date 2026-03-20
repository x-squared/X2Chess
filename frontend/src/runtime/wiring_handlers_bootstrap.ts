import {
  createApplyDefaultIndentHandler,
  createHandleLivePgnInputHandler,
  createInitializeDefaultPgnHandler,
  createSelectDevTabHandler,
  createSetPgnLayoutModeHandler,
  createUpdateGameInfoHeaderHandler,
} from "./app_wiring_handlers";

type ApplyDefaultIndentDeps = Parameters<typeof createApplyDefaultIndentHandler>[0];
type SetPgnLayoutModeDeps = Parameters<typeof createSetPgnLayoutModeHandler>[0];
type SelectDevTabDeps = Parameters<typeof createSelectDevTabHandler>[0];
type UpdateGameInfoHeaderDeps = Parameters<typeof createUpdateGameInfoHeaderHandler>[0];
type HandleLivePgnInputDeps = Parameters<typeof createHandleLivePgnInputHandler>[0];
type InitializeDefaultPgnDeps = Parameters<typeof createInitializeDefaultPgnHandler>[0];

type WiringHandlersBootstrapDeps = {
  applyDefaultIndentDeps: ApplyDefaultIndentDeps;
  setPgnLayoutModeDeps: SetPgnLayoutModeDeps;
  selectDevTabDeps: SelectDevTabDeps;
  updateGameInfoHeaderDeps: UpdateGameInfoHeaderDeps;
  handleLivePgnInputDeps: HandleLivePgnInputDeps;
  initializeDefaultPgnDeps: InitializeDefaultPgnDeps;
};

type WiringHandlersBootstrapResult = {
  applyDefaultIndentHandler: ReturnType<typeof createApplyDefaultIndentHandler>;
  setPgnLayoutModeHandler: ReturnType<typeof createSetPgnLayoutModeHandler>;
  selectDevTabHandler: ReturnType<typeof createSelectDevTabHandler>;
  updateGameInfoHeaderHandler: ReturnType<typeof createUpdateGameInfoHeaderHandler>;
  handleLivePgnInputHandler: ReturnType<typeof createHandleLivePgnInputHandler>;
  initializeDefaultPgnHandler: ReturnType<typeof createInitializeDefaultPgnHandler>;
};

export const createWiringHandlersBootstrap = ({
  applyDefaultIndentDeps,
  setPgnLayoutModeDeps,
  selectDevTabDeps,
  updateGameInfoHeaderDeps,
  handleLivePgnInputDeps,
  initializeDefaultPgnDeps,
}: WiringHandlersBootstrapDeps): WiringHandlersBootstrapResult => {
  const applyDefaultIndentHandler = createApplyDefaultIndentHandler(applyDefaultIndentDeps);
  const setPgnLayoutModeHandler = createSetPgnLayoutModeHandler(setPgnLayoutModeDeps);
  const selectDevTabHandler = createSelectDevTabHandler(selectDevTabDeps);
  const updateGameInfoHeaderHandler = createUpdateGameInfoHeaderHandler(updateGameInfoHeaderDeps);
  const handleLivePgnInputHandler = createHandleLivePgnInputHandler(handleLivePgnInputDeps);
  const initializeDefaultPgnHandler = createInitializeDefaultPgnHandler(initializeDefaultPgnDeps);
  return {
    applyDefaultIndentHandler,
    setPgnLayoutModeHandler,
    selectDevTabHandler,
    updateGameInfoHeaderHandler,
    handleLivePgnInputHandler,
    initializeDefaultPgnHandler,
  };
};
