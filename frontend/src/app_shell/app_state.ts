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

import { DEFAULT_RESOURCE_VIEWER_METADATA_KEYS } from "../../../resource/domain/metadata";

export const DEFAULT_LOCALE = "en";
export const DEFAULT_APP_MODE = "DEV";

/** Normalized player row used by game-info autocomplete and bundled seed data. */
export type PlayerRecord = { lastName: string; firstName: string };

/**
 * Shared (non-session) application state.
 *
 * Game-specific fields (pgnModel, pgnText, currentPly, moves, etc.) are no longer
 * held here — they live in each session's own `GameSessionState` object and are
 * accessed via `ActiveSessionRef.current`.
 */
export type AppState = {
  // Resource / file system
  gameDirectoryHandle: unknown;
  gameDirectoryPath: string;
  gameRootPath: string;
  activeSourceKind: string;

  // Persistence
  autosaveTimer: number | null;
  saveRequestSeq: number;
  isHydratingGame: boolean;
  defaultSaveMode: string;

  // Sessions (metadata only — game state is in GameSession.ownState)
  gameSessions: unknown[];
  activeSessionId: string | null;
  nextSessionSeq: number;

  // Resource viewer
  resourceViewerTabs: unknown[];
  activeResourceTabId: string | null;
  resourceViewerDefaultMetadataKeys: string[];

  // App configuration
  appMode: string;
  appConfig: Record<string, unknown>;
  isDeveloperToolsEnabled: boolean;
  locale: string;
  soundEnabled: boolean;
  moveDelayMs: number;
  playerStore: PlayerRecord[];

  // UI dimensions (layout-only, not persisted to React store)
  devDockHeightPx: number;
  resourceViewerHeightPx: number;
  boardColumnWidthPx: number;
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

{A sample game with variations. Click a move to jump to that position, or use the navigation buttons above.}
1. e4 (1. c4 e5) (1. d4 d5 (1... Nf6 2. c4 e6) 2. c4) e5
2. Nf3 (2. Nc3 Nf6 (2... Bb4 3. a3)) Nc6
3. Bb5 a6 (3... Nf6 4. O-O (4. d3))
4. Ba4 Nf6 *`;

/**
 * Create initial shared app state object.
 *
 * @returns {AppState} Initial runtime state.
 */
export const createInitialAppState = (): AppState => ({
  gameDirectoryHandle: null,
  gameDirectoryPath: "",
  gameRootPath: "",
  activeSourceKind: "directory",
  autosaveTimer: null,
  saveRequestSeq: 0,
  isHydratingGame: false,
  defaultSaveMode: "auto",
  gameSessions: [],
  activeSessionId: null,
  nextSessionSeq: 1,
  resourceViewerTabs: [],
  activeResourceTabId: null,
  resourceViewerDefaultMetadataKeys: [...DEFAULT_RESOURCE_VIEWER_METADATA_KEYS],
  appMode: DEFAULT_APP_MODE,
  appConfig: {},
  isDeveloperToolsEnabled: true,
  locale: DEFAULT_LOCALE,
  soundEnabled: true,
  moveDelayMs: 220,
  playerStore: [] as PlayerRecord[],
  devDockHeightPx: 320,
  resourceViewerHeightPx: 260,
  boardColumnWidthPx: 520,
});
