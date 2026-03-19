/**
 * App state/bootstrap constants component.
 *
 * Integration API:
 * - `DEFAULT_LOCALE`
 * - `DEFAULT_PGN`
 * - `createInitialAppState(parsePgnToModelFn, defaultPgn?)`
 *
 * Configuration API:
 * - Callers may provide alternative translations or default PGN text.
 *
 * Communication API:
 * - Pure data factory functions; no side effects.
 */

export const DEFAULT_LOCALE = "en";
export const DEFAULT_APP_MODE = "DEV";

/**
 * Default PGN used when no library game is loaded.
 */
export const DEFAULT_PGN = `[Event "Sample"]
[Site "Local"]
[Date "2026.03.10"]
[Round "-"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 (1. c4 e5) (1. d4 d5 (1... Nf6 2. c4 e6) 2. c4) e5
2. Nf3 (2. Nc3 Nf6 (2... Bb4 3. a3)) Nc6
3. Bb5 a6 (3... Nf6 4. O-O (4. d3))
4. Ba4 Nf6 *`;

/**
 * Create initial shared app state object.
 *
 * @param {Function} parsePgnToModelFn - PGN parser function `(source: string) => object`.
 * @param {string} [defaultPgn=DEFAULT_PGN] - Default PGN source text.
 * @returns {object} Initial runtime state.
 */
export const createInitialAppState = (parsePgnToModelFn, defaultPgn = DEFAULT_PGN) => ({
  moves: [],
  currentPly: 0,
  pgnText: defaultPgn,
  pgnModel: parsePgnToModelFn(defaultPgn),
  moveDelayMs: 220,
  soundEnabled: true,
  isAnimating: false,
  animationRunId: 0,
  verboseMoves: [],
  movePositionById: {},
  boardPreview: null,
  statusMessage: "",
  errorMessage: "",
  pendingFocusCommentId: null,
  selectedMoveId: null,
  undoStack: [],
  redoStack: [],
  isMenuOpen: false,
  isGameInfoEditorOpen: false,
  gameDirectoryHandle: null,
  gameDirectoryPath: "",
  gameRootPath: "",
  autosaveTimer: null,
  saveRequestSeq: 0,
  isHydratingGame: false,
  playerStore: [],
  locale: DEFAULT_LOCALE,
  gameSessions: [],
  activeSessionId: null,
  nextSessionSeq: 1,
  resourceViewerTabs: [],
  activeResourceTabId: null,
  activeSourceKind: "file",
  defaultSaveMode: "auto",
  appMode: DEFAULT_APP_MODE,
  isDeveloperToolsEnabled: true,
  isDevDockOpen: false,
  activeDevTab: "ast",
  devDockHeightPx: 320,
  appConfig: {},
});
