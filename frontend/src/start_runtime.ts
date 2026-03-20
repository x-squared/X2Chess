import "chessground/assets/chessground.base.css";
import "./board/styles.css";
import "./editor/styles.css";
import "./panels/styles.css";
import "./styles.css";
import bundledPlayers from "../data/players.json";
import {
  parsePgnToModel,
  serializeModelToPgn,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getHeaderValue,
  getX2StyleFromModel,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  resolveOwningMoveIdForCommentId,
  removeCommentById,
  setCommentTextById,
} from "./editor";
import { createBoardCapabilities } from "./board";
import {
  buildMainlinePlyByMoveId,
  buildMovePositionById,
  resolveMovePositionById,
  stripAnnotationsForBoardParser,
} from "./board/move_position";
import { hydrateVisualAssets } from "./assets/visual_assets";
import { createTranslator, resolveLocale } from "./app_shell/i18n";
import {
  DEFAULT_APP_MODE,
  DEFAULT_LOCALE,
  DEFAULT_PGN,
  createInitialAppState,
  type PlayerRecord,
} from "./app_shell/app_state";
import {
  EMPTY_GAME_PGN,
  isLikelyPgnText,
  type SessionLike,
  type SourceRefLike,
} from "./runtime/bootstrap_shared";
import {
  BOARD_COLUMN_WIDTH_STORAGE_KEY,
  MODE_STORAGE_KEY,
  RESOURCE_VIEWER_HEIGHT_STORAGE_KEY,
  readBootstrapUiPrefs,
  resolveBuildAppMode,
  resolveInitialLocale,
} from "./runtime/bootstrap_prefs";
import {
  normalizeResourceRefForInsert,
  toResourceTabTitle,
} from "./runtime/resource_ref_utils";
import { createSessionBootstrapCapabilities } from "./runtime/session_bootstrap";
import { createResourceViewerBootstrap } from "./runtime/resource_viewer_bootstrap";
import { createPlayerAutocompleteWiring } from "./runtime/player_autocomplete_wiring";
import { createBoardNavigationBootstrap } from "./runtime/board_navigation_bootstrap";
import { createRenderPipelineWiring } from "./runtime/render_pipeline_wiring";
import { initializeCorePgnCapabilities } from "./runtime/core_pgn_bootstrap";
import { createCorePgnRuntimeBootstrap } from "./runtime/core_pgn_runtime_bootstrap";
import { initializeCoreRuntimeCapabilities } from "./runtime/core_runtime_bootstrap";
import { createCoreRuntimePipelineBootstrap } from "./runtime/core_runtime_pipeline_bootstrap";
import { createWiringHandlersBootstrap } from "./runtime/wiring_handlers_bootstrap";
import { createAppShellRuntimeBootstrap } from "./runtime/app_shell_runtime_bootstrap";
import { createSessionResourceFlowBootstrap } from "./runtime/session_resource_flow_bootstrap";
import { createAppStartupFinalizeBootstrap } from "./runtime/app_startup_finalize_bootstrap";
import { createStartupContextLayoutBootstrap } from "./runtime/startup_context_layout_bootstrap";
import { createUiRenderBootstrap } from "./runtime/ui_render_bootstrap";
import { syncBoardEditorPaneMaxHeight } from "./runtime/board_editor_layout";
import { createNormalizeResourceRefAdapter } from "./runtime/normalize_resource_ref_adapter";

/**
 * Runtime startup module.
 *
 * Integration API:
 * - Primary export from this module: `startRuntime`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM, browser storage; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */
export function startRuntime(): void {

const {
  initialLocale,
  t,
  buildAppMode: BUILD_APP_MODE,
  state,
  boardCapabilities,
  layout,
  moveSoundPlayer,
} = createStartupContextLayoutBootstrap({
  contextDeps: {
    resolveLocale,
    createTranslator,
    defaultLocale: DEFAULT_LOCALE,
    defaultAppMode: DEFAULT_APP_MODE,
    parsePgnToModel,
    defaultPgn: DEFAULT_PGN,
    createInitialAppState,
    ensureRequiredPgnHeaders,
    serializeModelToPgn,
    getX2StyleFromModel,
    createBoardCapabilities,
    resolveInitialLocale,
    resolveBuildAppMode,
    readBootstrapUiPrefs,
  },
});

const {
  boardEl,
  statusEl,
  movesEl,
  errorEl,
  pgnInput,
  btnFirst,
  btnPrev,
  btnNext,
  btnLast,
  btnUndo,
  btnRedo,
  btnLoad,
  btnCommentBold,
  btnCommentItalic,
  btnCommentUnderline,
  btnDefaultIndent,
  btnCommentLeft,
  btnCommentRight,
  btnLinebreak,
  btnIndent,
  btnPgnLayoutPlain,
  btnPgnLayoutText,
  btnPgnLayoutTree,
  speedInput,
  speedValue,
  soundInput,
  localeInput,
  saveModeInput,
  btnSaveActiveGame,
  saveStatusEl,
  gameTabsEl,
  gameDropOverlayEl,
  boardEditorBoxEl,
  boardEditorResizeHandleEl,
  boardEditorPaneEl,
  resourceViewerCardEl,
  resourceViewerResizeHandleEl,
  btnOpenResource,
  btnResourceMetadata,
  resourceMetadataDialogEl,
  resourceMetadataFieldsEl,
  resourceMetadataApplyAllEl,
  btnResourceMetadataReset,
  btnResourceMetadataCancel,
  btnResourceMetadataSave,
  resourceTabsEl,
  resourceTableWrapEl,
  astWrapEl,
  domWrapEl,
  runtimeBuildBadgeEl,
  btnMenu,
  btnMenuClose,
  menuPanel,
  menuBackdrop,
  developerToolsInput,
  btnDevDockToggle,
  btnDevDockClose,
  developerDockEl,
  devDockResizeHandleEl,
  devTabBtnAst,
  devTabBtnDom,
  devTabBtnPgn,
  devTabAstEl,
  devTabDomEl,
  devTabPgnEl,
  btnGameInfoEdit,
  gameInfoEditorEl,
  gameInfoPlayersValueEl,
  gameInfoEventValueEl,
  gameInfoDateValueEl,
  gameInfoOpeningValueEl,
  gameInfoSuggestionEls,
  gameInfoInputs,
  textEditorEl,
  astViewEl,
  domViewEl,
} = layout;

type CorePgnCapabilities = ReturnType<typeof initializeCorePgnCapabilities>;
type CoreRuntimeCapabilities = ReturnType<typeof initializeCoreRuntimeCapabilities>;

type SessionBootstrapCapabilities = ReturnType<typeof createSessionBootstrapCapabilities>;
let historyCapabilities!: CorePgnCapabilities["historyCapabilities"];
let resourcesCapabilities!: CorePgnCapabilities["resourcesCapabilities"];
let pgnRuntimeCapabilities!: CorePgnCapabilities["pgnRuntimeCapabilities"];
let selectionRuntimeCapabilities!: CoreRuntimeCapabilities["selectionRuntimeCapabilities"];
let renderPipelineCapabilities!: ReturnType<typeof createRenderPipelineWiring>;
let boardRuntimeCapabilities!: CoreRuntimeCapabilities["boardRuntimeCapabilities"];
let moveLookupCapabilities!: CoreRuntimeCapabilities["moveLookupCapabilities"];
let runtimeConfigCapabilities!: CoreRuntimeCapabilities["runtimeConfigCapabilities"];
let playerAutocompleteCapabilities!: ReturnType<typeof createPlayerAutocompleteWiring>;
let gameSessionStore!: SessionBootstrapCapabilities["gameSessionStore"];
let gameSessionModel!: SessionBootstrapCapabilities["gameSessionModel"];
let sessionPersistenceService!: SessionBootstrapCapabilities["sessionPersistenceService"];
let gameTabsUi!: ReturnType<typeof createAppStartupFinalizeBootstrap>["gameTabsUi"];
let resourceViewerCapabilities!: ReturnType<typeof createResourceViewerBootstrap>;

state.playerStore = bundledPlayers as PlayerRecord[];

let applyPgnModelUpdate: (nextModel: unknown, focusCommentId?: string | null, options?: Record<string, unknown>) => void = () => {};

const {
  uiAdapters,
  render,
} = createUiRenderBootstrap({
  state,
  saveStatusEl,
  domViewEl,
  textEditorEl,
  boardEl,
  boardEditorPaneEl,
  getRenderPipeline: (): { renderFull: () => void } | null => (renderPipelineCapabilities || null),
  getGameSessionStore: (): { persistActiveSession: () => void; listSessions: () => unknown[] } | null => (gameSessionStore || null),
  getGameTabsUi: (): { render: () => void } | null => (gameTabsUi || null),
});

const {
  boardRuntimeCapabilities: wiredBoardRuntimeCapabilities,
  runtimeConfigCapabilities: wiredRuntimeConfigCapabilities,
  moveLookupCapabilities: wiredMoveLookupCapabilities,
  selectionRuntimeCapabilities: wiredSelectionRuntimeCapabilities,
  renderPipelineCapabilities: wiredRenderPipelineCapabilities,
  playerAutocompleteCapabilities: wiredPlayerAutocompleteCapabilities,
  boardNavigationCapabilities,
} = createCoreRuntimePipelineBootstrap({
  coreRuntimeDeps: {
    state,
    boardEl,
    astWrapEl,
    domWrapEl,
    textEditorEl,
    buildMovePositionByIdFn: buildMovePositionById,
    resolveMovePositionByIdFn: resolveMovePositionById,
    buildMainlinePlyByMoveIdFn: buildMainlinePlyByMoveId,
    findExistingCommentIdAroundMoveFn: findExistingCommentIdAroundMove,
    insertCommentAroundMoveFn: insertCommentAroundMove,
    removeCommentByIdFn: removeCommentById,
    setCommentTextByIdFn: setCommentTextById,
    resolveOwningMoveIdForCommentFn: resolveOwningMoveIdForCommentId,
    applyPgnModelUpdate,
    onRender: render,
  },
  renderPipelineDeps: {
    state,
    t,
    boardCapabilities,
    resourceViewerCapabilities,
    uiAdapters,
    els: {
      movesEl,
      errorEl,
      statusEl,
      textEditorEl,
      btnFirst,
      btnPrev,
      btnNext,
      btnLast,
      btnUndo,
      btnRedo,
      btnCommentLeft,
      btnCommentRight,
      btnLinebreak,
      btnIndent,
      btnPgnLayoutPlain,
      btnPgnLayoutText,
      btnPgnLayoutTree,
      developerDockEl,
      devTabBtnAst,
      devTabBtnDom,
      devTabBtnPgn,
      devTabAstEl,
      devTabDomEl,
      devTabPgnEl,
      runtimeBuildBadgeEl,
      speedValue,
    },
    astViewEl,
    textEditorEl,
    gameInfoInputs,
    gameInfoPlayersValueEl,
    gameInfoEventValueEl,
    gameInfoDateValueEl,
    gameInfoOpeningValueEl,
    gameInfoEditorEl,
    btnGameInfoEdit,
  },
  playerAutocompleteDeps: {
    state,
    gameInfoSuggestionEls,
    gameInfoInputs,
    applyPgnModelUpdate,
    getResourcesCapabilities: () => (resourcesCapabilities || null),
    bundledPlayers,
  },
  boardNavigationDeps: {
    state,
    pgnModel: state.pgnModel,
    findExistingCommentIdAroundMoveFn: findExistingCommentIdAroundMove,
    playMoveSound: moveSoundPlayer.playMoveSound,
    render,
  },
});
boardRuntimeCapabilities = wiredBoardRuntimeCapabilities;
runtimeConfigCapabilities = wiredRuntimeConfigCapabilities;
moveLookupCapabilities = wiredMoveLookupCapabilities;
selectionRuntimeCapabilities = wiredSelectionRuntimeCapabilities;
renderPipelineCapabilities = wiredRenderPipelineCapabilities;
playerAutocompleteCapabilities = wiredPlayerAutocompleteCapabilities;

({
  pgnRuntimeCapabilities,
  applyPgnModelUpdate,
  historyCapabilities,
  resourcesCapabilities,
} = createCorePgnRuntimeBootstrap({
  state,
  pgnInput,
  t,
  defaultPgn: DEFAULT_PGN,
  parsePgnToModelFn: (source: string): unknown => ensureRequiredPgnHeaders(parsePgnToModel(source)),
  serializeModelToPgnFn: serializeModelToPgn,
  buildMovePositionByIdFn: (model: unknown): Record<string, unknown> =>
    buildMovePositionById(model as Parameters<typeof buildMovePositionById>[0]) as Record<string, unknown>,
  stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
  onRender: render,
  getGameSessionStore: (): { updateActiveSessionMeta: (patch: { dirtyState: string }) => void } | null => (gameSessionStore || null),
  onScheduleAutosave: (): void => {
    sessionPersistenceService.scheduleAutosaveForActiveSession();
  },
  normalizeX2StyleValue,
  getX2StyleFromModel,
  onSetSaveStatus: uiAdapters.setSaveStatus,
  onApplyRuntimeConfig: runtimeConfigCapabilities.applyRuntimeConfig,
}));

const normalizeResourceRefForInsertAdapter = createNormalizeResourceRefAdapter(normalizeResourceRefForInsert);

const {
  resourceViewerCapabilities: wiredResourceViewerCapabilities,
  ensureResourceTabVisible,
  gameSessionModel: wiredGameSessionModel,
  gameSessionStore: wiredGameSessionStore,
  sessionPersistenceService: wiredSessionPersistenceService,
  sessionOpenFlow,
} = createSessionResourceFlowBootstrap({
  state,
  t,
  pgnInput,
  parsePgnToModelFn: parsePgnToModel,
  serializeModelToPgnFn: serializeModelToPgn,
  ensureRequiredPgnHeadersFn: ensureRequiredPgnHeaders,
  buildMovePositionByIdFn: (model: unknown): Record<string, unknown> =>
    buildMovePositionById(model as Parameters<typeof buildMovePositionById>[0]) as Record<string, unknown>,
  stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
  getHeaderValueFn: getHeaderValue,
  resourcesCapabilities,
  normalizeResourceRefForInsertFn: normalizeResourceRefForInsertAdapter,
  onSetSaveStatus: uiAdapters.setSaveStatus,
  render,
  viewerEls: {
    btnResourceMetadata,
    btnOpenResource,
    resourceMetadataDialogEl,
    resourceMetadataFieldsEl,
    resourceMetadataApplyAllEl,
    btnResourceMetadataReset,
    btnResourceMetadataCancel,
    btnResourceMetadataSave,
    resourceTabsEl,
    resourceTableWrapEl,
  },
});
resourceViewerCapabilities = wiredResourceViewerCapabilities;
gameSessionModel = wiredGameSessionModel;
gameSessionStore = wiredGameSessionStore;
sessionPersistenceService = wiredSessionPersistenceService;

const appShellCapabilities = createAppShellRuntimeBootstrap({
  handlersDeps: {
    state,
    resolveLocale,
    modeStorageKey: MODE_STORAGE_KEY,
    boardColumnWidthStorageKey: BOARD_COLUMN_WIDTH_STORAGE_KEY,
    resourceViewerHeightStorageKey: RESOURCE_VIEWER_HEIGHT_STORAGE_KEY,
    runtimeConfigCapabilities,
    sessionPersistenceService,
    render,
  },
  bootstrapDeps: {
    state,
    t,
    els: {
      btnMenu,
      btnMenuClose,
      menuPanel,
      menuBackdrop,
      speedInput,
      speedValue,
      soundInput,
      localeInput,
      developerToolsInput,
      btnDevDockToggle,
      btnDevDockClose,
      saveModeInput,
      btnSaveActiveGame,
      developerDockEl,
      devDockResizeHandleEl,
      boardEditorBoxEl,
      boardEditorResizeHandleEl,
      resourceViewerResizeHandleEl,
      resourceViewerCardEl,
    },
    boardNavigationCapabilities,
    historyCapabilities,
    onSaveActiveGameNow: sessionPersistenceService.persistActiveSessionNow,
  },
});

const {
  applyDefaultIndentHandler,
  setPgnLayoutModeHandler,
  selectDevTabHandler,
  updateGameInfoHeaderHandler,
  handleLivePgnInputHandler,
  initializeDefaultPgnHandler,
} = createWiringHandlersBootstrap({
  applyDefaultIndentDeps: {
    state,
    applyPgnModelUpdate,
  },
  setPgnLayoutModeDeps: {
    state,
    applyPgnModelUpdate,
  },
  selectDevTabDeps: {
    state,
    setDevDockOpen: appShellCapabilities.setDevDockOpen,
  },
  updateGameInfoHeaderDeps: {
    state,
    applyPgnModelUpdate,
  },
  handleLivePgnInputDeps: {
    state,
    pgnInput,
    parsePgnToModel,
    ensureRequiredPgnHeaders,
    pgnRuntimeCapabilities,
    renderPipelineCapabilities,
    gameSessionStore,
    sessionPersistenceService,
    gameTabsUi,
  },
  initializeDefaultPgnDeps: {
    resourcesCapabilities,
    sessionOpenFlow,
    resourceViewerCapabilities,
    pgnRuntimeCapabilities,
    gameSessionStore,
    state,
    t,
    render,
  },
});

const appPanelEl = document.querySelector(".app-panel");
const {
  appWiringCapabilities,
  gameTabsUi: wiredGameTabsUi,
} = createAppStartupFinalizeBootstrap({
  appWiringDeps: {
    state,
    t,
    els: {
      btnFirst,
      btnPrev,
      btnNext,
      btnLast,
      btnLoad,
      btnCommentBold,
      btnCommentItalic,
      btnCommentUnderline,
      btnUndo,
      btnRedo,
      btnCommentLeft,
      btnCommentRight,
      btnLinebreak,
      btnIndent,
      btnPgnLayoutPlain,
      btnPgnLayoutText,
      btnPgnLayoutTree,
      btnDefaultIndent,
      pgnInput,
      devTabBtnAst,
      devTabBtnDom,
      devTabBtnPgn,
      btnGameInfoEdit,
      gameInfoSuggestionEls,
      gameInfoInputs,
    },
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
  },
  postWiringDeps: {
    gameTabsDeps: {
      gameTabsEl,
      t,
      state,
      gameSessionStore,
      resourceViewerCapabilities,
      sessionOpenFlow,
      normalizeResourceRefForInsertFn: normalizeResourceRefForInsertAdapter,
      render,
    },
    ingressDeps: {
      appPanelEl,
      gameDropOverlayEl,
      state,
      t,
      render,
      isLikelyPgnTextFn: isLikelyPgnText,
      sessionOpenFlow,
      ensureResourceTabVisible,
      resourceViewerCapabilities,
      resourcesCapabilities,
      normalizeResourceRefForInsertFn: normalizeResourceRefForInsertAdapter,
      uiAdapters,
    },
  },
  appShellCapabilities,
  finalizeDeps: {
    resourcesCapabilities,
    resourceViewerCapabilities,
    state,
    t,
    setSaveStatus: uiAdapters.setSaveStatus,
    render,
    boardEl,
    boardEditorPaneEl,
    syncBoardEditorPaneMaxHeight,
  },
});
gameTabsUi = wiredGameTabsUi;
void appWiringCapabilities;

}
