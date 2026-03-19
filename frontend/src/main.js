import "chessground/assets/chessground.base.css";
import "./board/styles.css";
import "./editor/styles.css";
import "./panels/styles.css";
import "./styles.css";
import bundledPlayers from "../data/players.json";
import {
  text_editor,
  parsePgnToModel,
  serializeModelToPgn,
  applyDefaultIndentDirectives,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getFirstCommentMetadata,
  getHeaderValue,
  insertCommentAroundMove,
  resolveEcoOpeningName,
  resolveOwningMoveIdForCommentId,
  removeCommentById,
  setHeaderValue,
  setCommentTextById,
  toggleFirstCommentIntroRole,
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
import { createTranslator, resolveLocale } from "./app_shell/i18n";
import {
  PLAYER_NAME_HEADER_KEYS,
  buildPlayerNameSuggestions,
  normalizePlayerRecords,
  parsePlayerRecord,
  normalizeGameInfoHeaderValue,
  renderGameInfoSummary,
  syncGameInfoEditorUi,
  syncGameInfoEditorValues,
} from "./app_shell/game_info";
import { createPlayerAutocompleteCapabilities } from "./app_shell/player_autocomplete";
import {
  DEFAULT_APP_MODE,
  DEFAULT_LOCALE,
  DEFAULT_PGN,
  createInitialAppState,
} from "./app_shell/app_state";
import {
  ast_panel,
  renderDomPanel,
  renderMovesPanel,
  setPgnSaveStatus,
} from "./panels";
import { createGameSessionModel } from "./game_sessions/session_model";
import { createGameSessionStore } from "./game_sessions/session_store";
import { createSessionPersistenceService } from "./game_sessions/session_persistence";
import { createGameTabsUi } from "./game_sessions/tabs_ui";
import { createGameIngressHandlers } from "./game_sessions/ingress_handlers";
import { createResourceViewerCapabilities } from "./resources_viewer";

/**
 * Main composition root.
 *
 * Integration API:
 * - Initializes the full app by composing components and binding events.
 *
 * Configuration API:
 * - Build/runtime mode, locale, and defaults are read during startup.
 *
 * Communication API:
 * - Delegates feature behavior to Game-Viewer/resources/session services.
 */

const initialLocale = resolveLocale(window.localStorage?.getItem("x2chess.locale") || navigator.language || DEFAULT_LOCALE);
const t = createTranslator(initialLocale);
const MODE_STORAGE_KEY = "x2chess.developerTools";
const BUILD_APP_MODE = (() => {
  const raw = typeof __X2CHESS_MODE__ !== "undefined" ? String(__X2CHESS_MODE__) : DEFAULT_APP_MODE;
  return raw === "PROD" ? "PROD" : "DEV";
})();
const readPersistedDeveloperToolsPreference = () => {
  const raw = window.localStorage?.getItem(MODE_STORAGE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
};

const isLikelyPgnText = (value) => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\s*\[[A-Za-z0-9_]+\s+".*"\]\s*$/m.test(trimmed) || /\d+\.(?:\.\.)?\s*[^\s]+/.test(trimmed);
};

const state = createInitialAppState(parsePgnToModel, DEFAULT_PGN);
state.locale = initialLocale;
state.appMode = BUILD_APP_MODE;
state.isDeveloperToolsEnabled = (() => {
  const persisted = readPersistedDeveloperToolsPreference();
  if (persisted !== null) return persisted;
  return state.appMode === "DEV";
})();
state.pgnModel = ensureRequiredPgnHeaders(state.pgnModel);
state.pgnText = serializeModelToPgn(state.pgnModel);
const boardCapabilities = createBoardCapabilities(state);

const BUILD_TIMESTAMP_RAW = typeof __X2CHESS_BUILD_TIMESTAMP__ !== "undefined"
  ? String(__X2CHESS_BUILD_TIMESTAMP__)
  : "";
const BUILD_TIMESTAMP_LABEL = resolveBuildTimestampLabel(BUILD_TIMESTAMP_RAW);

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
  btnFirstCommentIntro,
  speedInput,
  speedValue,
  soundInput,
  localeInput,
  saveModeInput,
  btnSaveActiveGame,
  saveStatusEl,
  gameTabsEl,
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
} = createAppLayout({
  t,
  buildTimestampLabel: BUILD_TIMESTAMP_LABEL,
  currentLocale: state.locale,
  isDeveloperToolsEnabled: state.isDeveloperToolsEnabled,
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
let playerAutocompleteCapabilities = null;
let gameSessionStore = null;
let gameSessionModel = null;
let sessionPersistenceService = null;
let gameTabsUi = null;
let resourceViewerCapabilities = null;

state.playerStore = bundledPlayers;

const uiAdapters = createUiAdapters({
  saveStatusEl,
  domViewEl,
  textEditorEl,
  setPgnSaveStatusFn: setPgnSaveStatus,
  renderDomPanelFn: renderDomPanel,
});

const applyPgnModelUpdate = (nextModel, focusCommentId = null, options = {}) => (
  pgnRuntimeCapabilities.applyPgnModelUpdate(nextModel, focusCommentId, options)
);

const render = () => {
  if (!renderPipelineCapabilities) return;
  if (gameSessionStore) gameSessionStore.persistActiveSession();
  renderPipelineCapabilities.renderFull();
  if (gameTabsUi) gameTabsUi.render();
};

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
  resolveOwningMoveIdForCommentFn: resolveOwningMoveIdForCommentId,
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
    btnFirstCommentIntro,
    getFirstCommentMetadata: () => getFirstCommentMetadata(state.pgnModel),
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
  renderResourceViewer: () => {
    if (resourceViewerCapabilities) resourceViewerCapabilities.render();
  },
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

playerAutocompleteCapabilities = createPlayerAutocompleteCapabilities({
  state,
  gameInfoSuggestionEls,
  gameInfoInputs,
  playerNameHeaderKeys: PLAYER_NAME_HEADER_KEYS,
  normalizePlayerRecordsFn: (records) => normalizePlayerRecords(records),
  parsePlayerRecordFn: (value) => parsePlayerRecord(value),
  buildPlayerNameSuggestionsFn: (records, query) => buildPlayerNameSuggestions(records, query),
  normalizeGameInfoHeaderValueFn: (key, value) => normalizeGameInfoHeaderValue(key, value),
  getHeaderValueFn: (model, key, fallback) => getHeaderValue(model, key, fallback),
  setHeaderValueFn: (model, key, value) => setHeaderValue(model, key, value),
  ensureRequiredPgnHeadersFn: (model) => ensureRequiredPgnHeaders(model),
  applyPgnModelUpdate: (nextModel) => applyPgnModelUpdate(nextModel),
  loadPlayerStore: async () => {
    if (!resourcesCapabilities) return;
    state.playerStore = await resourcesCapabilities.loadPlayerStoreFromClientData(bundledPlayers);
  },
  savePlayerStore: async () => {
    if (!resourcesCapabilities) return;
    await resourcesCapabilities.savePlayerStoreToClientData(state.playerStore);
  },
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

resourcesCapabilities = createResourcesCapabilities({
  state,
  t,
  onSetSaveStatus: (message, kind) => uiAdapters.setSaveStatus(message, kind),
  onApplyRuntimeConfig: (config) => runtimeConfigCapabilities.applyRuntimeConfig(config),
  onLoadPgn: () => pgnRuntimeCapabilities.loadPgn(),
  onInitializeWithDefaultPgn: () => pgnRuntimeCapabilities.initializeWithDefaultPgn(),
  pgnInput,
});

resourceViewerCapabilities = createResourceViewerCapabilities({
  state,
  t,
  resourceTabsEl,
  resourceTableWrapEl,
  listGamesForResource: (resourceRef) => resourcesCapabilities.listGamesForResource(resourceRef),
});

const initializeResourceViewerTabs = async () => {
  const kinds = resourcesCapabilities.getAvailableSourceKinds();
  const tabs = kinds.map((kind) => ({
    title: t(`resources.tab.${kind}`, kind.toUpperCase()),
    resourceRef: {
      kind,
      locator: kind === "file" ? (state.gameDirectoryPath || "local-files") : `local-${kind}`,
    },
  }));
  resourceViewerCapabilities.setTabs(tabs);
  await resourceViewerCapabilities.refreshActiveTabRows();
};

gameSessionModel = createGameSessionModel({
  state,
  pgnInput,
  parsePgnToModelFn: parsePgnToModel,
  serializeModelToPgnFn: serializeModelToPgn,
  ensureRequiredPgnHeadersFn: ensureRequiredPgnHeaders,
  buildMovePositionByIdFn: buildMovePositionById,
  stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
  getHeaderValueFn: getHeaderValue,
  t,
});

gameSessionStore = createGameSessionStore({
  state,
  captureActiveSessionSnapshot: () => gameSessionModel.captureActiveSessionSnapshot(),
  applySessionSnapshotToState: (snapshot) => gameSessionModel.applySessionSnapshotToState(snapshot),
  disposeSessionSnapshot: (snapshot) => gameSessionModel.disposeSessionSnapshot(snapshot),
});

sessionPersistenceService = createSessionPersistenceService({
  state,
  t,
  getActiveSession: () => gameSessionStore.getActiveSession(),
  updateActiveSessionMeta: (patch) => gameSessionStore.updateActiveSessionMeta(patch),
  getPgnText: () => state.pgnText,
  saveBySourceRef: (sourceRef, pgnText, revisionToken, options) => (
    resourcesCapabilities.saveGameBySourceRef(sourceRef, pgnText, revisionToken, options)
  ),
  onSetSaveStatus: (message, kind) => uiAdapters.setSaveStatus(message, kind),
});

pgnRuntimeCapabilities = createPgnRuntimeCapabilities({
  state,
  pgnInput,
  t,
  defaultPgn: DEFAULT_PGN,
  parsePgnToModelFn: (source) => ensureRequiredPgnHeaders(parsePgnToModel(source)),
  serializeModelToPgnFn: serializeModelToPgn,
  buildMovePositionByIdFn: buildMovePositionById,
  stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
  onRender: () => render(),
  onRecordHistory: () => {
    if (!historyCapabilities) return;
    historyCapabilities.pushUndoSnapshot(historyCapabilities.captureEditorSnapshot());
    state.redoStack = [];
    if (gameSessionStore) gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
  },
  onScheduleAutosave: () => {
    sessionPersistenceService.scheduleAutosaveForActiveSession();
  },
});

const openSessionFromSnapshot = ({
  snapshot,
  title,
  sourceRef = null,
  revisionToken = "",
  saveMode = state.defaultSaveMode,
}) => {
  gameSessionStore.openSession({
    snapshot,
    title,
    sourceRef,
    revisionToken,
    saveMode,
  });
  state.defaultSaveMode = saveMode;
  render();
};

const openSessionFromPgnText = (pgnText, preferredTitle = "", sourceRef = null, revisionToken = "") => {
  const snapshot = gameSessionModel.createSessionFromPgnText(String(pgnText || ""));
  const fallbackTitle = preferredTitle || `${t("games.tabFallback", "Game")} ${state.nextSessionSeq}`;
  const title = gameSessionModel.deriveSessionTitle(snapshot.pgnModel, fallbackTitle);
  openSessionFromSnapshot({
    snapshot,
    title,
    sourceRef,
    revisionToken,
    saveMode: state.defaultSaveMode,
  });
};

const openSessionFromSourceRef = async (sourceRef, preferredTitle = "") => {
  const loaded = await resourcesCapabilities.loadGameBySourceRef(sourceRef);
  openSessionFromPgnText(
    loaded.pgnText,
    preferredTitle || loaded.titleHint,
    sourceRef,
    loaded.revisionToken,
  );
};

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
  localeInput,
  developerToolsInput,
  btnDevDockToggle,
  btnDevDockClose,
  saveModeInput,
  btnSaveActiveGame,
  developerDockEl,
  devDockResizeHandleEl,
  onHandleSelectedMoveArrowHotkey: (event) => boardNavigationCapabilities.handleSelectedMoveArrowHotkey(event),
  onUndo: () => historyCapabilities.performUndo(),
  onRedo: () => historyCapabilities.performRedo(),
  onChangeLocale: (localeCode) => {
    const nextLocale = resolveLocale(localeCode);
    if (nextLocale === state.locale) return;
    window.localStorage?.setItem("x2chess.locale", nextLocale);
    window.location.reload();
  },
  onChangeDeveloperTools: (enabled) => {
    window.localStorage?.setItem(MODE_STORAGE_KEY, enabled ? "true" : "false");
    if (!enabled) state.isDevDockOpen = false;
    runtimeConfigCapabilities.applyRuntimeConfig(state.appConfig || {});
    render();
  },
  onChangeDeveloperDockOpen: () => {
    runtimeConfigCapabilities.applyRuntimeConfig(state.appConfig || {});
    render();
  },
  onSwitchDeveloperDockTab: (tabId) => {
    const normalized = tabId === "dom" || tabId === "pgn" ? tabId : "ast";
    state.activeDevTab = normalized;
    appShellCapabilities.setDevDockOpen(true);
  },
  onChangeActiveSaveMode: (mode) => {
    sessionPersistenceService.setActiveSessionSaveMode(mode);
    render();
  },
  onSaveActiveGameNow: () => sessionPersistenceService.persistActiveSessionNow(),
});

const handleLivePgnInput = () => {
  if (!pgnInput) return;
  state.pgnText = pgnInput.value;
  state.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(state.pgnText));
  pgnRuntimeCapabilities.syncChessParseState(state.pgnText.trim(), { clearOnFailure: true });
  if (renderPipelineCapabilities) renderPipelineCapabilities.renderLiveInput();
  gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
  sessionPersistenceService.scheduleAutosaveForActiveSession();
  if (gameTabsUi) gameTabsUi.render();
};

const appWiringCapabilities = createAppWiringCapabilities({
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
    btnFirstCommentIntro,
    btnDefaultIndent,
    pgnInput,
    devTabBtnAst,
    devTabBtnDom,
    devTabBtnPgn,
    btnGameInfoEdit,
    gameInfoSuggestionEls,
    gameInfoInputs,
  },
  actions: {
    gotoPly: (nextPly, options) => boardNavigationCapabilities.gotoPly(nextPly, options),
    gotoRelativeStep: (direction) => boardNavigationCapabilities.gotoRelativeStep(direction),
    loadPgn: () => pgnRuntimeCapabilities.loadPgn(),
    performUndo: () => historyCapabilities.performUndo(),
    performRedo: () => historyCapabilities.performRedo(),
    formatCommentStyle: (style) => {
      selectionRuntimeCapabilities.formatFocusedComment(style);
    },
    insertAroundSelectedMove: (position, rawText) => selectionRuntimeCapabilities.insertAroundSelectedMove(position, rawText),
    applyDefaultIndent: () => {
      const nextModel = applyDefaultIndentDirectives(state.pgnModel);
      applyPgnModelUpdate(nextModel);
    },
    toggleFirstCommentIntro: () => {
      const nextModel = toggleFirstCommentIntroRole(state.pgnModel);
      if (nextModel !== state.pgnModel) applyPgnModelUpdate(nextModel);
    },
    setSaveStatus: (message, kind) => uiAdapters.setSaveStatus(message, kind),
    handleLivePgnInput: () => handleLivePgnInput(),
    selectDevTab: (tabId) => {
      const normalized = tabId === "dom" || tabId === "pgn" ? tabId : "ast";
      state.activeDevTab = normalized;
      appShellCapabilities.setDevDockOpen(true);
    },
    hydrateVisualAssets: () => hydrateVisualAssets(),
    loadRuntimeConfigFromClientDataAndDefaults: () => resourcesCapabilities.loadRuntimeConfigFromClientDataAndDefaults(),
    ensureBoard: () => boardRuntimeCapabilities.ensureBoard(),
    initializeWithDefaultPgn: () => {
      const run = async () => {
        const listed = await resourcesCapabilities.listSourceGames("file");
        if (listed.length > 0) {
          await openSessionFromSourceRef(
            listed[0].sourceRef,
            listed[0].titleHint || String(listed[0].sourceRef?.recordId || ""),
          );
          await resourceViewerCapabilities.refreshActiveTabRows();
          return;
        }
        pgnRuntimeCapabilities.initializeWithDefaultPgn();
        if (!gameSessionStore.getActiveSession()) {
          openSessionFromPgnText(state.pgnText, t("games.new", "New game"));
        }
        await resourceViewerCapabilities.refreshActiveTabRows();
      };
      void run();
    },
    toggleGameInfoEditor: () => {
      state.isGameInfoEditorOpen = !state.isGameInfoEditorOpen;
      render();
    },
    updateGameInfoHeader: (key, value) => {
      const normalizedValue = normalizeGameInfoHeaderValue(key, value);
      const currentValue = normalizeGameInfoHeaderValue(key, getHeaderValue(state.pgnModel, key, ""));
      if (currentValue === normalizedValue) return;
      let nextModel = setHeaderValue(state.pgnModel, key, normalizedValue);
      if (key === "ECO") {
        const currentOpening = getHeaderValue(nextModel, "Opening", "");
        if (!currentOpening.trim()) {
          const fallbackOpening = resolveEcoOpeningName(normalizedValue);
          if (fallbackOpening) {
            nextModel = setHeaderValue(nextModel, "Opening", fallbackOpening);
          }
        }
      }
      nextModel = ensureRequiredPgnHeaders(nextModel);
      applyPgnModelUpdate(nextModel);
    },
    isPlayerNameField: (key) => playerAutocompleteCapabilities.isPlayerNameField(key),
    loadPlayerStore: () => playerAutocompleteCapabilities.loadPlayerStore(),
    handlePlayerNameInput: (key, input, event) => playerAutocompleteCapabilities.handlePlayerNameInput(key, input, event),
    handlePlayerNameKeydown: (event, key, input) => playerAutocompleteCapabilities.handlePlayerNameKeydown(event, key, input),
    commitPlayerNameInput: (key, value) => playerAutocompleteCapabilities.commitPlayerNameInput(key, value),
    pickPlayerNameSuggestion: (key, playerName) => playerAutocompleteCapabilities.pickPlayerNameSuggestion(key, playerName),
  },
});

gameTabsUi = createGameTabsUi({
  gameTabsEl,
  t,
  getSessions: () => gameSessionStore.listSessions(),
  getActiveSessionId: () => state.activeSessionId,
  onSelectSession: (sessionId) => {
    if (gameSessionStore.switchToSession(sessionId)) {
      const active = gameSessionStore.getActiveSession();
      if (active) state.defaultSaveMode = active.saveMode || state.defaultSaveMode;
      render();
    }
  },
  onCloseSession: (sessionId) => {
    const result = gameSessionStore.closeSession(sessionId);
    if (result.emptyAfterClose) {
      pgnRuntimeCapabilities.initializeWithDefaultPgn();
      openSessionFromPgnText(state.pgnText, t("games.new", "New game"));
      return;
    }
    render();
  },
});

const appPanelEl = document.querySelector(".app-panel");
const ingressHandlers = createGameIngressHandlers({
  appPanelEl,
  isLikelyPgnText,
  openGameFromIncomingText: (sourceText, preferredTitle = "") => {
    const pgnText = String(sourceText || "").trim();
    if (!isLikelyPgnText(pgnText)) return false;
    openSessionFromPgnText(pgnText, preferredTitle);
    return true;
  },
});

appShellCapabilities.bindShellEvents();
appWiringCapabilities.bindDomEvents();
gameTabsUi.bindEvents();
resourceViewerCapabilities.bindEvents();
ingressHandlers.bindEvents();

void initializeResourceViewerTabs().then(() => render());
appWiringCapabilities.startApp();

