import { createMoveSoundPlayer } from "../board/move_sound";
import { createAppLayout } from "../app_shell/layout";
import { resolveBuildTimestampLabel } from "../app_shell/build_info";
import { buildInitialBootstrapContext } from "./initial_bootstrap_context";

type ContextStateLike = {
  locale: string;
  appMode: string;
  isDeveloperToolsEnabled: boolean;
  resourceViewerHeightPx: number;
  boardColumnWidthPx: number;
  isDevDockOpen: boolean;
  pgnModel: unknown;
  pgnText: string;
  pgnLayoutMode: string;
  soundEnabled: boolean;
};

type StartupContextLayoutBootstrapDeps<TState extends ContextStateLike, TAppMode extends string> = {
  contextDeps: {
    resolveLocale: (locale: string) => string;
    createTranslator: (locale: string) => (key: string, fallback?: string) => string;
    defaultLocale: string;
    defaultAppMode: TAppMode;
    parsePgnToModel: (source: string) => unknown;
    defaultPgn: string;
    createInitialAppState: (parsePgnToModelFn: (source: string) => unknown, defaultPgn?: string) => TState;
    ensureRequiredPgnHeaders: (model: unknown) => unknown;
    serializeModelToPgn: (model: unknown) => string;
    getX2StyleFromModel: (model: unknown) => string;
    createBoardCapabilities: (state: TState) => unknown;
    resolveInitialLocale: (resolveLocale: (locale: string) => string, defaultLocale: string) => string;
    resolveBuildAppMode: (defaultAppMode: TAppMode) => TAppMode;
    readBootstrapUiPrefs: (appMode: TAppMode) => {
      isDeveloperToolsEnabled: boolean;
      resourceViewerHeightPx: number | null;
      boardColumnWidthPx: number | null;
    };
  };
};

type StartupContextLayoutBootstrapResult<TState extends ContextStateLike, TAppMode extends string> = {
  initialLocale: string;
  t: (key: string, fallback?: string) => string;
  buildAppMode: TAppMode;
  state: TState;
  boardCapabilities: unknown;
  layout: ReturnType<typeof createAppLayout>;
  moveSoundPlayer: ReturnType<typeof createMoveSoundPlayer>;
};

export const createStartupContextLayoutBootstrap = <
  TState extends ContextStateLike,
  TAppMode extends string,
>({
  contextDeps,
}: StartupContextLayoutBootstrapDeps<TState, TAppMode>): StartupContextLayoutBootstrapResult<TState, TAppMode> => {
  const context = buildInitialBootstrapContext<TState, TAppMode>(contextDeps);

  const buildTimestampRaw = typeof __X2CHESS_BUILD_TIMESTAMP__ !== "undefined"
    ? String(__X2CHESS_BUILD_TIMESTAMP__)
    : "";
  const buildTimestampLabel = resolveBuildTimestampLabel(buildTimestampRaw);

  const layout = createAppLayout({
    t: context.t,
    buildTimestampLabel,
    currentLocale: context.state.locale,
    isDeveloperToolsEnabled: context.state.isDeveloperToolsEnabled,
  });

  const moveSoundPlayer = createMoveSoundPlayer({
    isSoundEnabled: (): boolean => context.state.soundEnabled,
  });

  return {
    ...context,
    layout,
    moveSoundPlayer,
  };
};
