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
  getHeaderValue,
  getX2StyleFromModel,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  resolveEcoOpeningName,
  resolveOwningMoveIdForCommentId,
  removeCommentById,
  setHeaderValue,
  setCommentTextById,
  X2_STYLE_HEADER_KEY,
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
  type PlayerRecord,
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

export function bootstrap(): void {

/**
 * Bootstrap module.
 *
 * Integration API:
 * - Primary exports from this module: `bootstrap`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM, browser storage; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

const initialLocale = resolveLocale(window.localStorage?.getItem("x2chess.locale") || navigator.language || DEFAULT_LOCALE);
const t = createTranslator(initialLocale);
const MODE_STORAGE_KEY = "x2chess.developerTools";
const RESOURCE_VIEWER_HEIGHT_STORAGE_KEY = "x2chess.resourceViewerHeightPx";
const BOARD_COLUMN_WIDTH_STORAGE_KEY = "x2chess.boardColumnWidthPx";
const BUILD_APP_MODE = ((): "DEV" | "PROD" => {
  const raw = typeof __X2CHESS_MODE__ !== "undefined" ? String(__X2CHESS_MODE__) : DEFAULT_APP_MODE;
  return raw === "PROD" ? "PROD" : "DEV";
})();
const readPersistedDeveloperToolsPreference = (): boolean | null => {
  const raw = window.localStorage?.getItem(MODE_STORAGE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
};
const readPersistedResourceViewerHeight = (): number | null => {
  const raw = window.localStorage?.getItem(RESOURCE_VIEWER_HEIGHT_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};
const readPersistedBoardColumnWidth = (): number | null => {
  const raw = window.localStorage?.getItem(BOARD_COLUMN_WIDTH_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const isLikelyPgnText = (value: unknown): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\s*\[[A-Za-z0-9_]+\s+".*"\]\s*$/m.test(trimmed) || /\d+\.(?:\.\.)?\s*[^\s]+/.test(trimmed);
};

type SourceRefLike = {
  kind?: string;
  locator?: string;
  recordId?: string | number;
};

type SessionLike = {
  sessionId: string;
  sourceRef?: SourceRefLike | null;
  pendingResourceRef?: SourceRefLike | null;
  title?: string;
};

const EMPTY_GAME_PGN = `[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]
`;

const state = createInitialAppState(parsePgnToModel, DEFAULT_PGN);
state.locale = initialLocale;
state.appMode = BUILD_APP_MODE;
state.isDeveloperToolsEnabled = ((): boolean => {
  const persisted = readPersistedDeveloperToolsPreference();
  if (persisted !== null) return persisted;
  return state.appMode === "DEV";
})();
const persistedResourceViewerHeight = readPersistedResourceViewerHeight();
if (typeof persistedResourceViewerHeight === "number" && Number.isFinite(persistedResourceViewerHeight)) {
  state.resourceViewerHeightPx = persistedResourceViewerHeight;
}
const persistedBoardColumnWidth = readPersistedBoardColumnWidth();
if (typeof persistedBoardColumnWidth === "number" && Number.isFinite(persistedBoardColumnWidth)) {
  state.boardColumnWidthPx = persistedBoardColumnWidth;
}
// Developer dock always starts closed; users open it explicitly.
state.isDevDockOpen = false;
state.pgnModel = ensureRequiredPgnHeaders(state.pgnModel);
state.pgnText = serializeModelToPgn(state.pgnModel);
state.pgnLayoutMode = getX2StyleFromModel(state.pgnModel);
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
} = createAppLayout({
  t,
  buildTimestampLabel: BUILD_TIMESTAMP_LABEL,
  currentLocale: state.locale,
  isDeveloperToolsEnabled: state.isDeveloperToolsEnabled,
});

const moveSoundPlayer = createMoveSoundPlayer({
  isSoundEnabled: (): boolean => state.soundEnabled,
});

let historyCapabilities!: ReturnType<typeof createEditorHistoryCapabilities>;
let resourcesCapabilities!: ReturnType<typeof createResourcesCapabilities>;
let pgnRuntimeCapabilities!: ReturnType<typeof createPgnRuntimeCapabilities>;
let selectionRuntimeCapabilities!: ReturnType<typeof createSelectionRuntimeCapabilities>;
let renderPipelineCapabilities!: ReturnType<typeof createAppRenderPipeline>;
let boardRuntimeCapabilities!: ReturnType<typeof createBoardRuntimeCapabilities>;
let moveLookupCapabilities!: ReturnType<typeof createMoveLookupCapabilities>;
let runtimeConfigCapabilities!: ReturnType<typeof createRuntimeConfigCapabilities>;
let playerAutocompleteCapabilities!: ReturnType<typeof createPlayerAutocompleteCapabilities>;
let gameSessionStore!: ReturnType<typeof createGameSessionStore>;
let gameSessionModel!: ReturnType<typeof createGameSessionModel>;
let sessionPersistenceService!: ReturnType<typeof createSessionPersistenceService>;
let gameTabsUi!: ReturnType<typeof createGameTabsUi>;
let resourceViewerCapabilities!: ReturnType<typeof createResourceViewerCapabilities>;

state.playerStore = bundledPlayers as PlayerRecord[];

const uiAdapters = createUiAdapters({
  saveStatusEl,
  domViewEl,
  textEditorEl,
  setPgnSaveStatusFn: setPgnSaveStatus,
  renderDomPanelFn: renderDomPanel,
});

const applyPgnModelUpdate = (nextModel: unknown, focusCommentId: string | null = null, options: Record<string, unknown> = {}): void => {
  pgnRuntimeCapabilities.applyPgnModelUpdate(nextModel, focusCommentId, options);
  state.pgnLayoutMode = getX2StyleFromModel(state.pgnModel);
};

const render = (): void => {
  if (!renderPipelineCapabilities) return;
  if (gameSessionStore) gameSessionStore.persistActiveSession();
  renderPipelineCapabilities.renderFull();
  const boardHeight = Math.round(boardEl?.getBoundingClientRect?.().height || 0);
  if (boardEditorPaneEl && boardHeight > 0) {
    (boardEditorPaneEl as HTMLElement).style.maxHeight = `${boardHeight}px`;
  }
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
  getMovePositionById: (
    moveId: string | null,
    options: { allowResolve: boolean },
  ): ReturnType<typeof selectionRuntimeCapabilities.getMovePositionById> => {
    const lookupResult = moveLookupCapabilities.getMovePositionById(moveId, options);
    if (!lookupResult) return null;
    return "variationFirstMoveIds" in lookupResult ? lookupResult : null;
  },
  buildMainlinePlyByMoveIdFn: buildMainlinePlyByMoveId,
  findExistingCommentIdAroundMoveFn: findExistingCommentIdAroundMove,
  insertCommentAroundMoveFn: insertCommentAroundMove,
  removeCommentByIdFn: removeCommentById,
  setCommentTextByIdFn: setCommentTextById,
  resolveOwningMoveIdForCommentFn: resolveOwningMoveIdForCommentId,
  applyPgnModelUpdate,
  onRender: render,
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
  buildGameAtPly: boardRuntimeCapabilities.buildGameAtPly,
  renderBoard: (game: unknown): void => {
    boardRuntimeCapabilities.renderBoard(game as Parameters<typeof boardRuntimeCapabilities.renderBoard>[0]);
  },
  renderMovesPanel,
  renderTextEditor: (): void => { text_editor.render(textEditorEl, state.pgnModel, selectionRuntimeCapabilities.getTextEditorOptions()); },
  renderAstPanel: (): void => { ast_panel.render(astViewEl, state.pgnModel); },
  renderDomView: uiAdapters.renderDomView,
  renderResourceViewer: (): void => {
    if (resourceViewerCapabilities) resourceViewerCapabilities.render();
  },
  renderGameInfoSummary: (): void => { renderGameInfoSummary({
    pgnModel: state.pgnModel,
    t,
    els: {
      gameInfoPlayersValueEl,
      gameInfoEventValueEl,
      gameInfoDateValueEl,
      gameInfoOpeningValueEl,
    },
  }); },
  syncGameInfoEditorValues: (): void => { syncGameInfoEditorValues({
    pgnModel: state.pgnModel,
    els: { gameInfoInputs },
  }); },
  syncGameInfoEditorUi: (): void => { syncGameInfoEditorUi({
    state,
    els: {
      gameInfoEditorEl,
      btnGameInfoEdit,
    },
  }); },
});

playerAutocompleteCapabilities = createPlayerAutocompleteCapabilities({
  state,
  gameInfoSuggestionEls,
  gameInfoInputs,
  playerNameHeaderKeys: PLAYER_NAME_HEADER_KEYS,
  normalizePlayerRecordsFn: normalizePlayerRecords,
  parsePlayerRecordFn: parsePlayerRecord,
  buildPlayerNameSuggestionsFn: buildPlayerNameSuggestions,
  normalizeGameInfoHeaderValueFn: normalizeGameInfoHeaderValue,
  getHeaderValueFn: getHeaderValue,
  setHeaderValueFn: setHeaderValue,
  ensureRequiredPgnHeadersFn: ensureRequiredPgnHeaders,
  applyPgnModelUpdate: (nextModel: unknown): void => { applyPgnModelUpdate(nextModel); },
  loadPlayerStore: async (): Promise<void> => {
    if (!resourcesCapabilities) return;
    state.playerStore = await resourcesCapabilities.loadPlayerStoreFromClientData(bundledPlayers);
  },
  savePlayerStore: async (): Promise<void> => {
    if (!resourcesCapabilities) return;
    await resourcesCapabilities.savePlayerStoreToClientData(state.playerStore);
  },
});

const boardNavigationCapabilities = createBoardNavigationCapabilities({
  state,
  getMovePositionById: (
    moveId: string | null,
    options: { allowResolve: boolean },
  ): ReturnType<typeof selectionRuntimeCapabilities.getMovePositionById> => {
    const lookupResult = moveLookupCapabilities.getMovePositionById(moveId, options);
    if (!lookupResult) return null;
    return "variationFirstMoveIds" in lookupResult ? lookupResult : null;
  },
  selectMoveById: selectionRuntimeCapabilities.selectMoveById,
  findCommentIdAroundMove: (moveId: string, position: "before" | "after"): string | null => findExistingCommentIdAroundMove(state.pgnModel, moveId, position),
  focusCommentById: selectionRuntimeCapabilities.focusCommentById,
  playMoveSound: moveSoundPlayer.playMoveSound,
  render,
});

historyCapabilities = createEditorHistoryCapabilities({
  state,
  pgnInput,
  onSyncChessParseState: pgnRuntimeCapabilities.syncChessParseState,
  onRender: render,
});

resourcesCapabilities = createResourcesCapabilities({
  state,
  t,
  onSetSaveStatus: uiAdapters.setSaveStatus,
  onApplyRuntimeConfig: runtimeConfigCapabilities.applyRuntimeConfig,
  onLoadPgn: pgnRuntimeCapabilities.loadPgn,
  onInitializeWithDefaultPgn: pgnRuntimeCapabilities.initializeWithDefaultPgn,
  pgnInput,
});

resourceViewerCapabilities = createResourceViewerCapabilities({
  state,
  t,
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
  listGamesForResource: resourcesCapabilities.listGamesForResource,
  onRequestOpenResource: async (): Promise<void> => {
    const selected = await resourcesCapabilities.chooseResourceByPicker();
    if (!selected?.resourceRef) return;
    await ensureResourceTabVisible(selected.resourceRef, true);
    render();
  },
  onOpenGameBySourceRef: async (sourceRef: SourceRefLike): Promise<void> => {
    const existing: SessionLike | null = findOpenSessionBySourceRef(sourceRef);
    if (existing) {
      if (gameSessionStore.switchToSession(existing.sessionId)) render();
      return;
    }
    await openSessionFromSourceRef(sourceRef, String(sourceRef?.recordId || ""));
    render();
  },
});

const initializeResourceViewerTabs = async (): Promise<void> => {
  const kinds: string[] = resourcesCapabilities.getAvailableSourceKinds().filter((kind: string): boolean => kind !== "pgn-db");
  const tabs = kinds.map((kind: string): { title: string; resourceRef: { kind: string; locator: string } } => ({
    title: t(`resources.tab.${kind}`, kind.toUpperCase()),
    resourceRef: {
      kind,
      locator: kind === "directory" ? (state.gameDirectoryPath || "local-files") : `local-${kind}`,
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
  captureActiveSessionSnapshot: gameSessionModel.captureActiveSessionSnapshot,
  applySessionSnapshotToState: gameSessionModel.applySessionSnapshotToState,
  disposeSessionSnapshot: gameSessionModel.disposeSessionSnapshot,
});

sessionPersistenceService = createSessionPersistenceService({
  state,
  t,
  getActiveSession: gameSessionStore.getActiveSession,
  updateActiveSessionMeta: gameSessionStore.updateActiveSessionMeta,
  getPgnText: (): string => state.pgnText,
  saveBySourceRef: resourcesCapabilities.saveGameBySourceRef,
  ensureSourceForActiveSession: async (session: unknown, pgnText: string): Promise<unknown | null> => {
    const pendingResourceRef = normalizeResourceRefForInsert(
      (session as SessionLike | null | undefined)?.pendingResourceRef as SourceRefLike | null | undefined
        || resourceViewerCapabilities.getActiveResourceRef()
        || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" },
    );
    if (!pendingResourceRef) return null;
    const created = await resourcesCapabilities.createGameInResource(
      pendingResourceRef,
      pgnText,
      ((session as SessionLike | null | undefined)?.title) || "new-game",
    );
    await ensureResourceTabVisible(
      {
        kind: created.sourceRef?.kind || pendingResourceRef.kind,
        locator: created.sourceRef?.locator || pendingResourceRef.locator,
      },
      true,
    );
    return created;
  },
  onSetSaveStatus: uiAdapters.setSaveStatus,
});

pgnRuntimeCapabilities = createPgnRuntimeCapabilities({
  state,
  pgnInput,
  t,
  defaultPgn: DEFAULT_PGN,
  parsePgnToModelFn: (source: string): unknown => ensureRequiredPgnHeaders(parsePgnToModel(source)),
  serializeModelToPgnFn: serializeModelToPgn,
  buildMovePositionByIdFn: buildMovePositionById,
  stripAnnotationsForBoardParserFn: stripAnnotationsForBoardParser,
  onRender: render,
  onRecordHistory: (): void => {
    if (!historyCapabilities) return;
    historyCapabilities.pushUndoSnapshot(historyCapabilities.captureEditorSnapshot());
    state.redoStack = [];
    if (gameSessionStore) gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
  },
  onScheduleAutosave: (): void => {
    sessionPersistenceService.scheduleAutosaveForActiveSession();
  },
});

const openSessionFromSnapshot = ({
  snapshot,
  title,
  sourceRef = null,
  pendingResourceRef = null,
  revisionToken = "",
  saveMode = state.defaultSaveMode,
}: {
  snapshot: unknown;
  title: string;
  sourceRef?: SourceRefLike | null;
  pendingResourceRef?: SourceRefLike | null;
  revisionToken?: string;
  saveMode?: string;
}): void => {
  gameSessionStore.openSession({
    snapshot,
    title,
    sourceRef,
    pendingResourceRef,
    revisionToken,
    saveMode,
  });
  state.defaultSaveMode = saveMode;
  render();
};

const openSessionFromPgnText = (pgnText: string, preferredTitle: string = "", sourceRef: SourceRefLike | null = null, revisionToken: string = ""): void => {
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

const openUnsavedSessionFromPgnText = (pgnText: string, preferredTitle: string = "", pendingResourceRef: SourceRefLike | null = null): void => {
  const snapshot = gameSessionModel.createSessionFromPgnText(String(pgnText || ""));
  openSessionFromSnapshot({
    snapshot,
    title: preferredTitle || t("games.new", "New game"),
    sourceRef: null,
    pendingResourceRef,
    revisionToken: "",
    saveMode: "auto",
  });
  gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
};

const openSessionFromSourceRef = async (sourceRef: SourceRefLike, preferredTitle: string = ""): Promise<void> => {
  const loaded = await resourcesCapabilities.loadGameBySourceRef(sourceRef);
  openSessionFromPgnText(
    loaded.pgnText,
    preferredTitle || loaded.titleHint,
    sourceRef,
    loaded.revisionToken,
  );
  if (sourceRef?.kind && sourceRef.kind === "file") {
    gameSessionStore.updateActiveSessionMeta({ saveMode: "manual" });
  }
};

const toResourceTabTitle = (resourceRef: SourceRefLike | null): string => {
  if (!resourceRef) return t("resources.title", "Resources");
  const locator = String(resourceRef.locator || "").replaceAll("\\", "/");
  const shortLocator = locator.split("/").filter(Boolean).pop() || locator;
  if (resourceRef.kind === "directory" && shortLocator) return shortLocator;
  return t(`resources.tab.${String(resourceRef.kind || "").toLowerCase()}`, String(resourceRef.kind || "Resource").toUpperCase());
};

const normalizeResourceRefForInsert = (resourceRef: SourceRefLike | null): SourceRefLike | null => {
  if (!resourceRef) return null;
  if (resourceRef.kind !== "directory") return resourceRef;
  const rawLocator = String(resourceRef.locator || "").trim();
  if (rawLocator && rawLocator !== "local-files") return resourceRef;
  if (state.gameDirectoryPath) return { kind: "directory", locator: state.gameDirectoryPath };
  if (state.gameDirectoryHandle) return { kind: "directory", locator: "browser-handle" };
  return null;
};

const ensureResourceTabVisible = async (resourceRef: SourceRefLike | null, select: boolean = true): Promise<void> => {
  if (!resourceRef) return;
  resourceViewerCapabilities.upsertTab({
    title: toResourceTabTitle(resourceRef),
    resourceRef,
    select,
  });
  await resourceViewerCapabilities.refreshActiveTabRows();
};
const isSameSourceRef = (left: SourceRefLike | null | undefined, right: SourceRefLike | null | undefined): boolean => (
  left?.kind === right?.kind
  && String(left?.locator || "") === String(right?.locator || "")
  && String(left?.recordId || "") === String(right?.recordId || "")
);
const findOpenSessionBySourceRef = (sourceRef: SourceRefLike | null): SessionLike | null => (
  gameSessionStore.listSessions().find((session: SessionLike): boolean => isSameSourceRef(session.sourceRef, sourceRef)) || null
);

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
  boardEditorBoxEl,
  boardEditorResizeHandleEl,
  resourceViewerResizeHandleEl,
  resourceViewerCardEl,
  onHandleSelectedMoveArrowHotkey: boardNavigationCapabilities.handleSelectedMoveArrowHotkey,
  onUndo: historyCapabilities.performUndo,
  onRedo: historyCapabilities.performRedo,
  onChangeLocale: (localeCode: string): void => {
    const nextLocale = resolveLocale(localeCode);
    if (nextLocale === state.locale) return;
    window.localStorage?.setItem("x2chess.locale", nextLocale);
    window.location.reload();
  },
  onChangeDeveloperTools: (enabled: boolean): void => {
    window.localStorage?.setItem(MODE_STORAGE_KEY, enabled ? "true" : "false");
    if (!enabled) state.isDevDockOpen = false;
    runtimeConfigCapabilities.applyRuntimeConfig(state.appConfig || {});
    render();
  },
  onChangeDeveloperDockOpen: (): void => {
    runtimeConfigCapabilities.applyRuntimeConfig(state.appConfig || {});
    render();
  },
  onSwitchDeveloperDockTab: (tabId: "ast" | "dom" | "pgn"): void => {
    const normalized = tabId === "dom" || tabId === "pgn" ? tabId : "ast";
    state.activeDevTab = normalized;
    appShellCapabilities.setDevDockOpen(true);
  },
  onChangeActiveSaveMode: (mode: "auto" | "manual"): void => {
    sessionPersistenceService.setActiveSessionSaveMode(mode);
    render();
  },
  onChangeBoardColumnWidth: (widthPx: number): void => {
    window.localStorage?.setItem(BOARD_COLUMN_WIDTH_STORAGE_KEY, String(widthPx));
    render();
  },
  onChangeResourceViewerHeight: (heightPx: number): void => {
    window.localStorage?.setItem(RESOURCE_VIEWER_HEIGHT_STORAGE_KEY, String(heightPx));
  },
  onSaveActiveGameNow: sessionPersistenceService.persistActiveSessionNow,
});

const handleLivePgnInput = (): void => {
  if (!pgnInput) return;
  state.pgnText = (pgnInput as HTMLInputElement).value;
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
  actions: {
    gotoPly: (nextPly: number, options?: { animate?: boolean }): Promise<void> => boardNavigationCapabilities.gotoPly(nextPly, options),
    gotoRelativeStep: (direction: number): Promise<void> => boardNavigationCapabilities.gotoRelativeStep(direction),
    loadPgn: pgnRuntimeCapabilities.loadPgn,
    performUndo: historyCapabilities.performUndo,
    performRedo: historyCapabilities.performRedo,
    formatCommentStyle: (style: "bold" | "italic" | "underline"): void => {
      selectionRuntimeCapabilities.formatFocusedComment(style);
    },
    insertAroundSelectedMove: (position: "before" | "after", rawText: string): void => selectionRuntimeCapabilities.insertAroundSelectedMove(position, rawText),
    applyDefaultIndent: (): void => {
      const nextModel = applyDefaultIndentDirectives(state.pgnModel);
      applyPgnModelUpdate(nextModel);
    },
    setPgnLayoutMode: (mode: "plain" | "text" | "tree"): void => {
      const next = normalizeX2StyleValue(mode);
      const nextModel = setHeaderValue(state.pgnModel, X2_STYLE_HEADER_KEY, next);
      applyPgnModelUpdate(nextModel);
    },
    setSaveStatus: uiAdapters.setSaveStatus,
    handleLivePgnInput,
    selectDevTab: (tabId: "ast" | "dom" | "pgn"): void => {
      const normalized = tabId === "dom" || tabId === "pgn" ? tabId : "ast";
      state.activeDevTab = normalized;
      appShellCapabilities.setDevDockOpen(true);
    },
    hydrateVisualAssets,
    loadRuntimeConfigFromClientDataAndDefaults: resourcesCapabilities.loadRuntimeConfigFromClientDataAndDefaults,
    ensureBoard: async (): Promise<void> => {
      await boardRuntimeCapabilities.ensureBoard();
    },
    initializeWithDefaultPgn: (): void => {
      const run = async (): Promise<void> => {
        const listed = await resourcesCapabilities.listSourceGames("directory");
        if (listed.length > 0) {
          await openSessionFromSourceRef(
            listed[0].sourceRef,
            listed[0].titleHint || String(listed[0].sourceRef?.recordId || ""),
          );
          await resourceViewerCapabilities.refreshActiveTabRows();
          render();
          return;
        }
        pgnRuntimeCapabilities.initializeWithDefaultPgn();
        if (!gameSessionStore.getActiveSession()) {
          openSessionFromPgnText(state.pgnText, t("games.new", "New game"));
        }
        await resourceViewerCapabilities.refreshActiveTabRows();
        render();
      };
      void run();
    },
    toggleGameInfoEditor: (): void => {
      state.isGameInfoEditorOpen = !state.isGameInfoEditorOpen;
      render();
    },
    updateGameInfoHeader: (key: string, value: string): void => {
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
    isPlayerNameField: playerAutocompleteCapabilities.isPlayerNameField,
    loadPlayerStore: playerAutocompleteCapabilities.loadPlayerStore,
    handlePlayerNameInput: playerAutocompleteCapabilities.handlePlayerNameInput,
    handlePlayerNameKeydown: playerAutocompleteCapabilities.handlePlayerNameKeydown,
    commitPlayerNameInput: playerAutocompleteCapabilities.commitPlayerNameInput,
    pickPlayerNameSuggestion: playerAutocompleteCapabilities.pickPlayerNameSuggestion,
  },
});

gameTabsUi = createGameTabsUi({
  gameTabsEl,
  t,
  getSessions: gameSessionStore.listSessions,
  getActiveSessionId: (): string | null => state.activeSessionId,
  onSelectSession: (sessionId: string): void => {
    if (gameSessionStore.switchToSession(sessionId)) {
      const active = gameSessionStore.getActiveSession();
      if (active) state.defaultSaveMode = active.saveMode || state.defaultSaveMode;
      render();
    }
  },
  onCloseSession: (sessionId: string): void => {
    const result = gameSessionStore.closeSession(sessionId);
    if (result.emptyAfterClose) {
      const pendingResourceRef = normalizeResourceRefForInsert(
        resourceViewerCapabilities.getActiveResourceRef()
          || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" },
      );
      openUnsavedSessionFromPgnText(EMPTY_GAME_PGN, t("games.new", "New game"), pendingResourceRef);
      return;
    }
    render();
  },
});

const appPanelEl = document.querySelector(".app-panel");
const ingressHandlers = createGameIngressHandlers({
  appPanelEl,
  isLikelyPgnText,
  setDropOverlayVisible: (isVisible: boolean): void => {
    if (gameDropOverlayEl) (gameDropOverlayEl as HTMLElement).hidden = !isVisible;
  },
  openGameFromIncomingText: async (sourceText: string, options: Record<string, unknown> = {}): Promise<boolean> => {
    const pgnText = String(sourceText || "").trim();
    if (!isLikelyPgnText(pgnText)) return false;
    const preferredTitle = String(options?.preferredTitle || "").trim();
    const droppedSourceRef = options?.sourceRef && typeof options.sourceRef === "object" ? options.sourceRef : null;
    const droppedResourceRef = options?.resourceRef && typeof options.resourceRef === "object" ? options.resourceRef : null;
    if (droppedSourceRef) {
      openSessionFromPgnText(
        pgnText,
        preferredTitle,
        droppedSourceRef as unknown as Parameters<typeof openSessionFromPgnText>[2],
        "",
      );
      if (droppedResourceRef) await ensureResourceTabVisible(droppedResourceRef, true);
      render();
      return true;
    }
    if (options?.preferInsertIntoActiveResource) {
      const activeResourceRef: SourceRefLike | null = normalizeResourceRefForInsert(
        resourceViewerCapabilities.getActiveResourceRef()
          || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" },
      );
      if (activeResourceRef) {
        try {
          const created = await resourcesCapabilities.createGameInResource(activeResourceRef, pgnText, preferredTitle || "imported-game");
          openSessionFromPgnText(
            pgnText,
            preferredTitle || created.titleHint || t("games.new", "New game"),
            created.sourceRef,
            created.revisionToken || "",
          );
          await ensureResourceTabVisible(
            { kind: created.sourceRef?.kind || activeResourceRef.kind, locator: created.sourceRef?.locator || activeResourceRef.locator },
            true,
          );
          render();
          return true;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          uiAdapters.setSaveStatus(msg || t("resources.error", "Unable to load resource games."), "error");
        }
      }
    }
    openSessionFromPgnText(pgnText, preferredTitle || t("games.new", "New game"));
    render();
    return true;
  },
});

appShellCapabilities.bindShellEvents();
appWiringCapabilities.bindDomEvents();
gameTabsUi.bindEvents();
resourceViewerCapabilities.bindEvents();
ingressHandlers.bindEvents();

window.addEventListener("resize", (): void => {
  window.requestAnimationFrame((): void => {
    const boardHeight = Math.round(boardEl?.getBoundingClientRect?.().height || 0);
    if (boardEditorPaneEl && boardHeight > 0) {
      (boardEditorPaneEl as HTMLElement).style.maxHeight = `${boardHeight}px`;
    }
  });
});

void initializeResourceViewerTabs().then((): void => render());
appWiringCapabilities.startApp();

}
