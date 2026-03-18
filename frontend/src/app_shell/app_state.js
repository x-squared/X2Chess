/**
 * App state/bootstrap constants component.
 *
 * Integration API:
 * - `APP_TRANSLATIONS`
 * - `DEFAULT_PGN`
 * - `createTranslator(translations?)`
 * - `createInitialAppState(parsePgnToModelFn, defaultPgn?)`
 *
 * Configuration API:
 * - Callers may provide alternative translations or default PGN text.
 *
 * Communication API:
 * - Pure data factory functions; no side effects.
 */

/**
 * Default English translations used by shell and editor UI.
 */
export const APP_TRANSLATIONS = {
  "menu.open": "Open menu",
  "menu.close": "Close menu",
  "menu.title": "Menu",
  "controls.first": "|<",
  "controls.prev": "<",
  "controls.next": ">",
  "controls.last": ">|",
  "controls.speed": "Move speed (ms)",
  "controls.sound": "Sound",
  "toolbar.commentLeft": "Insert comment left",
  "toolbar.commentRight": "Insert comment right",
  "toolbar.linebreak": "Insert line break",
  "toolbar.indent": "Insert indent",
  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "gameInfo.players": "Players",
  "gameInfo.event": "Event",
  "gameInfo.date": "Date",
  "gameInfo.opening": "Opening",
  "gameInfo.edit": "Edit game information",
  "gameInfo.players.empty": "-",
  "gameInfo.event.empty": "-",
  "gameInfo.date.empty": "-",
  "gameInfo.opening.empty": "-",
  "status.label": "Position",
  "pgn.label": "PGN input",
  "pgn.placeholder":
    "Paste or drop PGN text here.\n\nExample:\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
  "pgn.load": "Load PGN",
  "pgn.defaultIndent": "Default indent",
  "pgn.loaded": "PGN loaded.",
  "pgn.error": "Unable to parse PGN.",
  "pgn.source.label": "Game file",
  "pgn.source.placeholder": "Manual / unsaved",
  "pgn.source.chooseFolder": "Choose folder",
  "pgn.source.folderHint": "Choose a local folder (for example run/DEV).",
  "pgn.source.folderSelected": "Folder",
  "pgn.source.unsupported": "Local folder access is not supported in this browser runtime.",
  "pgn.source.fileMissing": "Selected game file is no longer available.",
  "pgn.save.saving": "Saving...",
  "pgn.save.saved": "Saved",
  "pgn.save.error": "Autosave failed",
  "pgn.formatted.label": "text_editor",
  "pgn.ast.label": "ast_view",
  "pgn.dom.label": "dom_view",
  "pgn.comment.editPrompt": "Edit comment text",
  "moves.label": "Moves",
  "moves.none": "No moves loaded.",
};

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
 * Create translation lookup callback.
 *
 * @param {Record<string, string>} [translations=APP_TRANSLATIONS] - Translation map.
 * @returns {(key: string, englishDefault?: string) => string} Translation resolver.
 */
export const createTranslator = (translations = APP_TRANSLATIONS) => (
  key,
  englishDefault,
) => translations[key] ?? englishDefault;

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
  gameFiles: [],
  gameFileHandles: {},
  selectedGameFile: "",
  gameDirectoryHandle: null,
  gameDirectoryPath: "",
  gameRootPath: "",
  autosaveTimer: null,
  saveRequestSeq: 0,
  isHydratingGame: false,
  appConfig: {},
});
