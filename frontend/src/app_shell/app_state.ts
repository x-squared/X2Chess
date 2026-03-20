/**
 * App State module.
 *
 * Integration API:
 * - Primary exports from this module: `DEFAULT_LOCALE`, `DEFAULT_APP_MODE`, `PlayerRecord`, `DEFAULT_PGN`, `createInitialAppState`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import type { MovePositionIndex, PgnModelForMoves } from "../board/move_position";
import type { BoardPreviewLike } from "../board/runtime";
import { DEFAULT_RESOURCE_VIEWER_METADATA_KEYS } from "../../../resource/domain/metadata";

export const DEFAULT_LOCALE = "en";
export const DEFAULT_APP_MODE = "DEV";

/** Normalized player row used by game-info autocomplete and bundled seed data. */
export type PlayerRecord = { lastName: string; firstName: string };
type ParsePgnToModelFn = (source: string) => unknown;

export type AppState = {
  moves: string[];
  currentPly: number;
  pgnText: string;
  pgnModel: PgnModelForMoves;
  moveDelayMs: number;
  soundEnabled: boolean;
  isAnimating: boolean;
  animationRunId: number;
  verboseMoves: Array<{ flags?: string; from?: string; to?: string }>;
  movePositionById: MovePositionIndex;
  boardPreview: BoardPreviewLike | null;
  statusMessage: string;
  errorMessage: string;
  pendingFocusCommentId: string | null;
  selectedMoveId: string | null;
  undoStack: unknown[];
  redoStack: unknown[];
  isMenuOpen: boolean;
  isGameInfoEditorOpen: boolean;
  gameDirectoryHandle: unknown;
  gameDirectoryPath: string;
  gameRootPath: string;
  autosaveTimer: number | null;
  saveRequestSeq: number;
  isHydratingGame: boolean;
  playerStore: PlayerRecord[];
  locale: string;
  gameSessions: unknown[];
  activeSessionId: string | null;
  nextSessionSeq: number;
  resourceViewerTabs: unknown[];
  activeResourceTabId: string | null;
  resourceViewerDefaultMetadataKeys: string[];
  activeSourceKind: string;
  defaultSaveMode: string;
  appMode: string;
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: string;
  devDockHeightPx: number;
  resourceViewerHeightPx: number;
  boardColumnWidthPx: number;
  pgnLayoutMode: string;
  appConfig: Record<string, unknown>;
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
 * Create initial shared app state object.
 *
 * @param {Function} parsePgnToModelFn - PGN parser function `(source: string) => object`.
 * @param {string} [defaultPgn=DEFAULT_PGN] - Default PGN source text.
 * @returns {object} Initial runtime state.
 */
export const createInitialAppState = (
  parsePgnToModelFn: ParsePgnToModelFn,
  defaultPgn: string = DEFAULT_PGN,
): AppState => ({
  moves: [],
  currentPly: 0,
  pgnText: defaultPgn,
  pgnModel: parsePgnToModelFn(defaultPgn) as PgnModelForMoves,
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
  playerStore: [] as PlayerRecord[],
  locale: DEFAULT_LOCALE,
  gameSessions: [],
  activeSessionId: null,
  nextSessionSeq: 1,
  resourceViewerTabs: [],
  activeResourceTabId: null,
  resourceViewerDefaultMetadataKeys: [...DEFAULT_RESOURCE_VIEWER_METADATA_KEYS],
  activeSourceKind: "directory",
  defaultSaveMode: "auto",
  appMode: DEFAULT_APP_MODE,
  isDeveloperToolsEnabled: true,
  isDevDockOpen: false,
  activeDevTab: "ast",
  devDockHeightPx: 320,
  resourceViewerHeightPx: 260,
  boardColumnWidthPx: 520,
  /** PGN editor layout; overridden from `[X2Style "..."]` when present (default plain). */
  pgnLayoutMode: "plain",
  appConfig: {},
});
