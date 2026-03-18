import "chessground/assets/chessground.base.css";
import "./board/styles.css";
import "./editor/styles.css";
import "./panels/styles.css";
import "./styles.css";
import {
  text_editor,
  parsePgnToModel,
  serializeModelToPgn,
  applyDefaultIndentDirectives,
  findExistingCommentIdAroundMove,
  getHeaderValue,
  insertCommentAroundMove,
  removeCommentById,
  setHeaderValue,
  setCommentTextById,
} from "./editor";
import { createEditorHistoryCapabilities } from "./editor/history";
import { createPgnRuntimeCapabilities } from "./editor/pgn_runtime";
import { createSelectionRuntimeCapabilities } from "./editor/selection_runtime";
import { createBoardCapabilities } from "./board";
import {
  buildMainlinePlyByMoveId,
  buildMovePositionById,
  resolveMovePositionById,
  stripAnnotationsForBoardParser,
} from "./board/move_position";
import { createMoveSoundPlayer } from "./board/move_sound";
import { createBoardNavigationCapabilities } from "./board/navigation";
import { createBoardRuntimeCapabilities } from "./board/runtime";
import { createMoveLookupCapabilities } from "./board/move_lookup";
import { hydrateVisualAssets } from "./assets/visual_assets";
import { createResourcesCapabilities } from "./resources";
import { createAppShellCapabilities } from "./app_shell";
import { createAppWiringCapabilities } from "./app_shell/wiring";
import { createAppRenderPipeline } from "./app_shell/render_pipeline";
import { createRuntimeConfigCapabilities } from "./app_shell/runtime_config";
import { createAppLayout } from "./app_shell/layout";
import { resolveBuildTimestampLabel } from "./app_shell/build_info";
import { createUiAdapters } from "./app_shell/ui_adapters";
import {
  renderGameInfoSummary,
  syncGameInfoEditorUi,
  syncGameInfoEditorValues,
} from "./app_shell/game_info";
import {
  APP_TRANSLATIONS,
  DEFAULT_PGN,
  createInitialAppState,
  createTranslator,
} from "./app_shell/app_state";
import {
  ast_panel,
  renderDomPanel,
  renderMovesPanel,
  renderPgnGameSelect,
  setPgnSaveStatus,
} from "./panels";

const t = createTranslator(APP_TRANSLATIONS);

const state = createInitialAppState(parsePgnToModel, DEFAULT_PGN);
const boardCapabilities = createBoardCapabilities(state);

const BUILD_TIMESTAMP_RAW = typeof __X2CHESS_BUILD_TIMESTAMP__ !== "undefined"
  ? String(__X2CHESS_BUILD_TIMESTAMP__)
  : "";
const BUILD_TIMESTAMP_LABEL = resolveBuildTimestampLabel(BUILD_TIMESTAMP_RAW);

// 1) Layout + static DOM references.
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
  btnDefaultIndent,
  btnCommentLeft,
  btnCommentRight,
  btnLinebreak,
  btnIndent,
  speedInput,
  speedValue,
  soundInput,
  gameSelect,
  btnPickGamesFolder,
  saveStatusEl,
  astWrapEl,
  domWrapEl,
  btnMenu,
  btnMenuClose,
  menuPanel,
  menuBackdrop,
  btnGameInfoEdit,
  gameInfoEditorEl,
  gameInfoPlayersValueEl,
  gameInfoEventValueEl,
  gameInfoDateValueEl,
  gameInfoOpeningValueEl,
  gameInfoInputs,
  textEditorEl,
  astViewEl,
  domViewEl,
} = createAppLayout({
  t,
  buildTimestampLabel: BUILD_TIMESTAMP_LABEL,
});

const moveSoundPlayer = createMoveSoundPlayer({
  isSoundEnabled: () => state.soundEnabled,
});

let historyCapabilities = null;
let resourcesCapabilities = null;
let pgnRuntimeCapabilities = null;
let selectionRuntimeCapabilities = null;
let renderPipelineCapabilities = null;
let boardRuntimeCapabilities = null;
let moveLookupCapabilities = null;
let runtimeConfigCapabilities = null;

// 2) UI adapter helpers shared by runtime components.
const uiAdapters = createUiAdapters({
  saveStatusEl,
  gameSelect,
  domViewEl,
  textEditorEl,
  state,
  t,
  setPgnSaveStatusFn: setPgnSaveStatus,
  renderPgnGameSelectFn: renderPgnGameSelect,
  renderDomPanelFn: renderDomPanel,
});

const applyPgnModelUpdate = (nextModel, focusCommentId = null, options = {}) => (
  pgnRuntimeCapabilities.applyPgnModelUpdate(nextModel, focusCommentId, options)
);

const render = () => {
  if (!renderPipelineCapabilities) return;
  renderPipelineCapabilities.renderFull();
};

// 3) Compose runtime capabilities (order matters for dependencies).
boardRuntimeCapabilities = createBoardRuntimeCapabilities({
  state,
  boardEl,
});

runtimeConfigCapabilities = createRuntimeConfigCapabilities({
  state,
  astWrapEl,
  domWrapEl,
});

moveLookupCapabilities = createMoveLookupCapabilities({
  state,
  buildMovePositionByIdFn: buildMovePositionById,
  resolveMovePositionByIdFn: resolveMovePositionById,
});

selectionRuntimeCapabilities = createSelectionRuntimeCapabilities({
  state,
  textEditorEl,
  getMovePositionById: (moveId, options) => moveLookupCapabilities.getMovePositionById(moveId, options),
  buildMainlinePlyByMoveIdFn: buildMainlinePlyByMoveId,
  findExistingCommentIdAroundMoveFn: findExistingCommentIdAroundMove,
  insertCommentAroundMoveFn: insertCommentAroundMove,
  removeCommentByIdFn: removeCommentById,
  setCommentTextByIdFn: setCommentTextById,
  applyPgnModelUpdate: (nextModel, focusCommentId, options) => applyPgnModelUpdate(nextModel, focusCommentId, options),
  onRender: () => render(),
});

renderPipelineCapabilities = createAppRenderPipeline({
  state,
  t,
  boardCapabilities,
  selectionRuntimeCapabilities,
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
    speedValue,
  },
  buildGameAtPly: (ply) => boardRuntimeCapabilities.buildGameAtPly(ply),
  renderBoard: (game) => boardRuntimeCapabilities.renderBoard(game),
  renderMovesPanel: ({ movesEl: targetMovesEl, moves, pgnModel, t: translate }) => renderMovesPanel({
    movesEl: targetMovesEl,
    moves,
    pgnModel,
    t: translate,
  }),
  renderTextEditor: () => text_editor.render(textEditorEl, state.pgnModel, selectionRuntimeCapabilities.getTextEditorOptions()),
  renderAstPanel: () => ast_panel.render(astViewEl, state.pgnModel),
  renderDomView: () => uiAdapters.renderDomView(),
  renderGameInfoSummary: () => renderGameInfoSummary({
    pgnModel: state.pgnModel,
    t,
    els: {
      gameInfoPlayersValueEl,
      gameInfoEventValueEl,
      gameInfoDateValueEl,
      gameInfoOpeningValueEl,
    },
  }),
  syncGameInfoEditorValues: () => syncGameInfoEditorValues({
    pgnModel: state.pgnModel,
    els: { gameInfoInputs },
  }),
  syncGameInfoEditorUi: () => syncGameInfoEditorUi({
    state,
    els: {
      gameInfoEditorEl,
      btnGameInfoEdit,
    },
  }),
});

const boardNavigationCapabilities = createBoardNavigationCapabilities({
  state,
  getMovePositionById: (moveId, options) => moveLookupCapabilities.getMovePositionById(moveId, options),
  selectMoveById: (moveId) => selectionRuntimeCapabilities.selectMoveById(moveId),
  findCommentIdAroundMove: (moveId, position) => findExistingCommentIdAroundMove(state.pgnModel, moveId, position),
  focusCommentById: (commentId) => selectionRuntimeCapabilities.focusCommentById(commentId),
  playMoveSound: (soundType) => moveSoundPlayer.playMoveSound(soundType),
  render: () => render(),
});

historyCapabilities = createEditorHistoryCapabilities({
  state,
  pgnInput,
  onSyncChessParseState: (source) => pgnRuntimeCapabilities.syncChessParseState(source),
  onRender: () => render(),
});

const appShellCapabilities = createAppShellCapabilities({
  state,
  t,
  btnMenu,
  btnMenuClose,
  menuPanel,
  menuBackdrop,
  speedInput,
  speedValue,
  soundInput,
  onHandleSelectedMoveArrowHotkey: (event) => boardNavigationCapabilities.handleSelectedMoveArrowHotkey(event),
  onUndo: () => historyCapabilities.performUndo(),
  onRedo: () => historyCapabilities.performRedo(),
});

pgnRuntimeCapabilities = createPgnRuntimeCapabilities({
  state,
  pgnInput,
  t,
  defaultPgn: DEFAULT_PGN,
  parsePgnToModelFn: parsePgnToModel,
  serializeModelToPgnFn: serializeModelToPgn,
  buildMovePositionByIdFn: buildMovePositionById,
  stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
  onRender: () => render(),
  onRecordHistory: () => {
    if (!historyCapabilities) return;
    historyCapabilities.pushUndoSnapshot(historyCapabilities.captureEditorSnapshot());
    state.redoStack = [];
  },
  onScheduleAutosave: () => {
    if (!resourcesCapabilities) return;
    resourcesCapabilities.scheduleAutosave();
  },
});

resourcesCapabilities = createResourcesCapabilities({
  state,
  t,
  onRenderGameSelect: () => uiAdapters.renderGameSelect(),
  onSetSaveStatus: (message, kind) => uiAdapters.setSaveStatus(message, kind),
  onApplyRuntimeConfig: (config) => runtimeConfigCapabilities.applyRuntimeConfig(config),
  onLoadPgn: () => pgnRuntimeCapabilities.loadPgn(),
  onInitializeWithDefaultPgn: () => pgnRuntimeCapabilities.initializeWithDefaultPgn(),
  getPgnText: () => state.pgnText,
  pgnInput,
  gameSelect,
});

// 4) Event-level input handler delegated from wiring component.
const handleLivePgnInput = () => {
  if (!pgnInput) return;
  state.pgnText = pgnInput.value;
  state.pgnModel = parsePgnToModel(state.pgnText);
  // Do not keep stale parse errors while user is actively editing.
  pgnRuntimeCapabilities.syncChessParseState(state.pgnText.trim(), { clearOnFailure: true });
  if (renderPipelineCapabilities) renderPipelineCapabilities.renderLiveInput();
  resourcesCapabilities.scheduleAutosave();
};

// 5) Wire DOM events and startup orchestration.
const appWiringCapabilities = createAppWiringCapabilities({
  state,
  t,
  els: {
    btnFirst,
    btnPrev,
    btnNext,
    btnLast,
    btnLoad,
    btnUndo,
    btnRedo,
    btnCommentLeft,
    btnCommentRight,
    btnLinebreak,
    btnIndent,
    btnDefaultIndent,
    btnPickGamesFolder,
    gameSelect,
    pgnInput,
    btnGameInfoEdit,
    gameInfoInputs,
  },
  actions: {
    gotoPly: (nextPly, options) => boardNavigationCapabilities.gotoPly(nextPly, options),
    gotoRelativeStep: (direction) => boardNavigationCapabilities.gotoRelativeStep(direction),
    loadPgn: () => pgnRuntimeCapabilities.loadPgn(),
    performUndo: () => historyCapabilities.performUndo(),
    performRedo: () => historyCapabilities.performRedo(),
    insertAroundSelectedMove: (position, rawText) => selectionRuntimeCapabilities.insertAroundSelectedMove(position, rawText),
    applyDefaultIndent: () => {
      const nextModel = applyDefaultIndentDirectives(state.pgnModel);
      applyPgnModelUpdate(nextModel);
    },
    chooseClientGamesFolder: () => resourcesCapabilities.chooseClientGamesFolder(),
    loadGameByName: (fileName) => resourcesCapabilities.loadGameByName(fileName),
    setSaveStatus: (message, kind) => uiAdapters.setSaveStatus(message, kind),
    handleLivePgnInput: () => handleLivePgnInput(),
    fetchGameFilesFromClientData: () => resourcesCapabilities.fetchGameFilesFromClientData(),
    hydrateVisualAssets: () => hydrateVisualAssets(),
    loadRuntimeConfigFromClientDataAndDefaults: () => resourcesCapabilities.loadRuntimeConfigFromClientDataAndDefaults(),
    ensureBoard: () => boardRuntimeCapabilities.ensureBoard(),
    initializeWithDefaultPgn: () => pgnRuntimeCapabilities.initializeWithDefaultPgn(),
    toggleGameInfoEditor: () => {
      state.isGameInfoEditorOpen = !state.isGameInfoEditorOpen;
      render();
    },
    updateGameInfoHeader: (key, value) => {
      const currentValue = getHeaderValue(state.pgnModel, key, "");
      if (currentValue === String(value ?? "").trim()) return;
      const nextModel = setHeaderValue(state.pgnModel, key, value);
      applyPgnModelUpdate(nextModel);
    },
  },
});

appShellCapabilities.bindShellEvents();
appWiringCapabilities.bindDomEvents();

appWiringCapabilities.startApp();
