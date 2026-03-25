/**
 * App store state type and reducer for the X2Chess useReducer store.
 *
 * Integration API:
 * - `AppStoreState` — full React state shape; read via selectors or `useAppContext().state`.
 * - `appReducer(state, action)` — pure reducer; passed to `useReducer` in `AppProvider`.
 * - `initialAppStoreState` — initial value for `useReducer`.
 *
 * Configuration API:
 * - Initial values are hardcoded constants; startup preferences are applied via
 *   dispatched actions from `useAppStartup`.
 *
 * Communication API:
 * - State is read through `useAppContext().state` or dedicated selectors in `selectors.ts`.
 * - State is updated exclusively via `dispatch(action)` — never mutated directly.
 */

import type { PgnModel } from "../model/pgn_model";
import type { AppAction } from "./actions";

/**
 * Per-tab identity snapshot held in React state.
 * Populated directly by `useAppStartup` via `set_resource_tabs` action.
 */
export type ResourceTabSnapshot = {
  tabId: string;
  title: string;
  kind: string;
  locator: string;
};

/**
 * Per-session snapshot held in React state.
 * Populated directly by `useAppStartup` via `set_sessions` action.
 */
export type SessionItemState = {
  sessionId: string;
  title: string;
  dirtyState: string;
  saveMode: "auto" | "manual";
  isActive: boolean;
  /** True when the session has no persisted source (never saved to disk). */
  isUnsaved: boolean;
  /** PGN White header, empty string if not set. */
  white: string;
  /** PGN Black header, empty string if not set. */
  black: string;
  /** PGN Event header, empty string if not set. */
  event: string;
  /** PGN Date header, empty string if not set. */
  date: string;
  /** Locator string of the persisted source (file path / URI), empty when unsaved. */
  sourceLocator: string;
  /**
   * Composite game identifier for training badge lookups:
   * `"${kind}:${locator}:${recordId}"`, or empty for unsaved sessions.
   */
  sourceGameRef: string;
};

/** Complete React-owned application state. */
export type AppStoreState = {
  // ── Shell ──────────────────────────────────────────────────────────────
  /** Active locale key, e.g. "en", "de". */
  locale: string;
  /** Whether developer tools are globally enabled. */
  isDeveloperToolsEnabled: boolean;
  /** Whether the developer dock panel is open. */
  isDevDockOpen: boolean;
  /** Which tab is active in the developer dock. */
  activeDevTab: "ast" | "dom" | "pgn";
  /** Whether the main menu overlay is open. */
  isMenuOpen: boolean;

  // ── Board / navigation ─────────────────────────────────────────────────
  /** Whether the board is flipped (black at the bottom). */
  boardFlipped: boolean;
  /** Current half-move index (0 = start position). */
  currentPly: number;
  /** Total number of half-moves in the main line. */
  moveCount: number;
  /** ID of the currently selected move node, or null. */
  selectedMoveId: string | null;
  /** Animation delay in milliseconds between auto-play moves. */
  moveDelayMs: number;
  /** Whether move sounds are enabled. */
  soundEnabled: boolean;
  /** Status bar message (e.g. "Saved"). */
  statusMessage: string;
  /** Error bar message (e.g. "Parse error"). */
  errorMessage: string;
  /** Source kind active in the resource viewer ("file" | "directory" | "db"). */
  activeSourceKind: string;

  // ── Editor / PGN ──────────────────────────────────────────────────────
  /** Visual layout mode for the PGN text editor. */
  pgnLayoutMode: "plain" | "text" | "tree";
  /** Full raw PGN text of the active game. */
  pgnText: string;
  /**
   * Parsed PGN model of the active game.
   * Null only before the first game is loaded.
   */
  pgnModel: PgnModel | null;
  /** SAN move list for the active game's main line. */
  moves: string[];
  /** Character count of pgnText (used by editor for lightweight change detection). */
  pgnTextLength: number;
  /** Comment node ID that should receive focus after next render, or null. */
  pendingFocusCommentId: string | null;
  /** Whether the game-info header editor panel is expanded. */
  isGameInfoEditorOpen: boolean;
  /** Undo stack depth — drives undo button enabled state. */
  undoDepth: number;
  /** Redo stack depth — drives redo button enabled state. */
  redoDepth: number;

  // ── Sessions ───────────────────────────────────────────────────────────
  /** ID of the currently active session tab, or null. */
  activeSessionId: string | null;
  /** Total number of open session tabs. */
  sessionCount: number;
  /** Display titles for all open session tabs, in order. */
  sessionTitles: string[];
  /** Full per-session metadata for tab rendering (dirty state, save mode, unsaved flag). */
  sessions: SessionItemState[];

  // ── Resource viewer ────────────────────────────────────────────────────
  /** Total number of open resource tabs. */
  resourceTabCount: number;
  /** ID of the active resource tab, or null. */
  activeResourceTabId: string | null;
  /** Display title of the active resource tab. */
  activeResourceTabTitle: string;
  /** Kind of the active resource tab ("file" | "directory" | "db"). */
  activeResourceTabKind: string;
  /** Locator string (path or URI) of the active resource tab. */
  activeResourceTabLocator: string;
  /** Number of game rows shown in the active resource tab. */
  activeResourceRowCount: number;
  /** Error message for the active resource tab, or empty string. */
  activeResourceErrorMessage: string;
  /** Full list of open resource tab identities (without row data). */
  resourceViewerTabSnapshots: ResourceTabSnapshot[];

  // ── Board preview ───────────────────────────────────────────────────────
  /**
   * When set, `ChessBoard` shows this FEN instead of replaying from `currentPly`.
   * Used for variation moves that are off the main line.  Cleared when the user
   * navigates to any mainline position.
   */
  boardPreview: { fen: string; lastMove?: [string, string] | null } | null;

  // ── Hover position preview ──────────────────────────────────────────────
  /** Whether hovering over a move token shows a floating position preview popup. */
  positionPreviewOnHover: boolean;
};

/** Initial state — all fields start empty/false/zero before startup completes. */
export const initialAppStoreState: AppStoreState = {
  // Shell
  locale: "en",
  isDeveloperToolsEnabled: true,
  isDevDockOpen: false,
  activeDevTab: "ast",
  isMenuOpen: false,
  // Board
  boardFlipped: false,
  currentPly: 0,
  moveCount: 0,
  selectedMoveId: null,
  moveDelayMs: 220,
  soundEnabled: true,
  statusMessage: "",
  errorMessage: "",
  activeSourceKind: "directory",
  // Editor
  pgnLayoutMode: "plain",
  pgnText: "",
  pgnModel: null,
  moves: [],
  pgnTextLength: 0,
  pendingFocusCommentId: null,
  isGameInfoEditorOpen: false,
  undoDepth: 0,
  redoDepth: 0,
  // Sessions
  activeSessionId: null,
  sessionCount: 0,
  sessionTitles: [],
  sessions: [],
  // Resource viewer
  resourceTabCount: 0,
  activeResourceTabId: null,
  activeResourceTabTitle: "",
  activeResourceTabKind: "",
  activeResourceTabLocator: "",
  activeResourceRowCount: 0,
  activeResourceErrorMessage: "",
  resourceViewerTabSnapshots: [],
  // Board preview
  boardPreview: null,
  // Hover position preview
  positionPreviewOnHover: true,
};

/** Pure reducer — never mutates state, always returns a new object. */
export const appReducer = (state: AppStoreState, action: AppAction): AppStoreState => {
  switch (action.type) {
    // ── Shell ────────────────────────────────────────────────────────────
    case "set_locale":
      return { ...state, locale: action.locale };
    case "set_dev_tools_enabled":
      return { ...state, isDeveloperToolsEnabled: action.enabled };
    case "set_dev_dock_open":
      return { ...state, isDevDockOpen: action.open };
    case "set_active_dev_tab":
      return { ...state, activeDevTab: action.tab };
    case "set_is_menu_open":
      return { ...state, isMenuOpen: action.open };

    // ── Board ────────────────────────────────────────────────────────────
    case "toggle_board_flip":
      return { ...state, boardFlipped: !state.boardFlipped };
    case "set_current_ply":
      return { ...state, currentPly: action.ply };
    case "set_move_count":
      return { ...state, moveCount: action.count };
    case "set_selected_move_id":
      return { ...state, selectedMoveId: action.id };
    case "set_move_delay_ms":
      return { ...state, moveDelayMs: action.value };
    case "set_sound_enabled":
      return { ...state, soundEnabled: action.enabled };
    case "set_status_message":
      return { ...state, statusMessage: action.message };
    case "set_error_message":
      return { ...state, errorMessage: action.message };
    case "set_active_source_kind":
      return { ...state, activeSourceKind: action.kind };

    // ── Editor ───────────────────────────────────────────────────────────
    case "set_layout_mode":
      return { ...state, pgnLayoutMode: action.mode };
    case "set_pgn":
      return {
        ...state,
        pgnText: action.pgnText,
        pgnModel: action.pgnModel,
        moves: action.moves,
        pgnTextLength: action.pgnText.length,
        moveCount: action.moves.length,
      };
    case "set_pending_focus_comment_id":
      return { ...state, pendingFocusCommentId: action.id };
    case "set_game_info_editor_open":
      return { ...state, isGameInfoEditorOpen: action.open };
    case "set_undo_redo":
      return { ...state, undoDepth: action.undoDepth, redoDepth: action.redoDepth };

    // ── Sessions ─────────────────────────────────────────────────────────
    case "set_sessions":
      return {
        ...state,
        sessions: action.sessions,
        sessionCount: action.sessions.length,
        sessionTitles: action.sessions.map((s: SessionItemState): string => s.title),
        activeSessionId: action.activeSessionId,
      };

    // ── Resource viewer ───────────────────────────────────────────────────
    case "set_resource_tabs": {
      const active: ResourceTabSnapshot | undefined = action.tabs.find(
        (tab: ResourceTabSnapshot): boolean => tab.tabId === action.activeTabId,
      );
      return {
        ...state,
        resourceViewerTabSnapshots: action.tabs,
        resourceTabCount: action.tabs.length,
        activeResourceTabId: action.activeTabId,
        activeResourceTabTitle: active?.title ?? "",
        activeResourceTabKind: active?.kind ?? "",
        activeResourceTabLocator: active?.locator ?? "",
      };
    }

    case "set_board_preview":
      return { ...state, boardPreview: action.preview };

    case "set_position_preview_on_hover":
      return { ...state, positionPreviewOnHover: action.enabled };

    default:
      return state;
  }
};
