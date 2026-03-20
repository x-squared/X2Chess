type ResolveLocaleFn = (locale: string) => string;
type CreateTranslatorFn = (locale: string) => (key: string, fallback?: string) => string;
type ParsePgnToModelFn = (source: string) => unknown;

type BootstrapMutableState = {
  locale: string;
  appMode: string;
  isDeveloperToolsEnabled: boolean;
  resourceViewerHeightPx: number;
  boardColumnWidthPx: number;
  isDevDockOpen: boolean;
  pgnModel: unknown;
  pgnText: string;
  pgnLayoutMode: string;
};

type BuildContextDeps<TState extends BootstrapMutableState, TAppMode extends string> = {
  resolveLocale: ResolveLocaleFn;
  createTranslator: CreateTranslatorFn;
  defaultLocale: string;
  defaultAppMode: TAppMode;
  parsePgnToModel: ParsePgnToModelFn;
  defaultPgn: string;
  createInitialAppState: (parsePgnToModelFn: ParsePgnToModelFn, defaultPgn?: string) => TState;
  ensureRequiredPgnHeaders: (model: unknown) => unknown;
  serializeModelToPgn: (model: unknown) => string;
  getX2StyleFromModel: (model: unknown) => string;
  createBoardCapabilities: (state: TState) => unknown;
  resolveInitialLocale: (resolveLocale: ResolveLocaleFn, defaultLocale: string) => string;
  resolveBuildAppMode: (defaultAppMode: TAppMode) => TAppMode;
  readBootstrapUiPrefs: (appMode: TAppMode) => {
    isDeveloperToolsEnabled: boolean;
    resourceViewerHeightPx: number | null;
    boardColumnWidthPx: number | null;
  };
};

type BuiltContext<TState extends BootstrapMutableState, TAppMode extends string> = {
  initialLocale: string;
  t: (key: string, fallback?: string) => string;
  buildAppMode: TAppMode;
  state: TState;
  boardCapabilities: unknown;
};

export const buildInitialBootstrapContext = <TState extends BootstrapMutableState, TAppMode extends string = string>({
  resolveLocale,
  createTranslator,
  defaultLocale,
  defaultAppMode,
  parsePgnToModel,
  defaultPgn,
  createInitialAppState,
  ensureRequiredPgnHeaders,
  serializeModelToPgn,
  getX2StyleFromModel,
  createBoardCapabilities,
  resolveInitialLocale,
  resolveBuildAppMode,
  readBootstrapUiPrefs,
}: BuildContextDeps<TState, TAppMode>): BuiltContext<TState, TAppMode> => {
  const initialLocale = resolveInitialLocale(resolveLocale, defaultLocale);
  const t = createTranslator(initialLocale);
  const buildAppMode = resolveBuildAppMode(defaultAppMode);

  const state = createInitialAppState(parsePgnToModel, defaultPgn);
  state.locale = initialLocale;
  state.appMode = buildAppMode;

  const bootstrapUiPrefs = readBootstrapUiPrefs(buildAppMode);
  state.isDeveloperToolsEnabled = bootstrapUiPrefs.isDeveloperToolsEnabled;
  if (typeof bootstrapUiPrefs.resourceViewerHeightPx === "number" && Number.isFinite(bootstrapUiPrefs.resourceViewerHeightPx)) {
    state.resourceViewerHeightPx = bootstrapUiPrefs.resourceViewerHeightPx;
  }
  if (typeof bootstrapUiPrefs.boardColumnWidthPx === "number" && Number.isFinite(bootstrapUiPrefs.boardColumnWidthPx)) {
    state.boardColumnWidthPx = bootstrapUiPrefs.boardColumnWidthPx;
  }

  // Developer dock always starts closed; users open it explicitly.
  state.isDevDockOpen = false;
  state.pgnModel = ensureRequiredPgnHeaders(state.pgnModel);
  state.pgnText = serializeModelToPgn(state.pgnModel);
  state.pgnLayoutMode = getX2StyleFromModel(state.pgnModel);
  const boardCapabilities = createBoardCapabilities(state);

  return {
    initialLocale,
    t,
    buildAppMode,
    state,
    boardCapabilities,
  };
};
