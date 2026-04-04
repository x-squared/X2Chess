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
import { DEFAULT_SHAPE_PREFS } from "../runtime/shape_prefs";
import type { ShapePrefs } from "../runtime/shape_prefs";
import { DEFAULT_EDITOR_STYLE_PREFS } from "../runtime/editor_style_prefs";
import type { EditorStylePrefs } from "../runtime/editor_style_prefs";
import { DEFAULT_DEFAULT_LAYOUT_PREFS } from "../runtime/default_layout_prefs";
import type { DefaultLayoutPrefs } from "../runtime/default_layout_prefs";

/** Per-tab identity snapshot held in React state. */
export type ResourceTabSnapshot = {
  tabId: string;
  title: string;
  kind: string;
  locator: string;
};

/** Per-session snapshot held in React state. */
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
  activeDevTab: "ast";
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
  /** Whether engine evaluation pills are visible in text/tree mode. Defaults to true. */
  showEvalPills: boolean;
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
   * Used for variation moves that are off the main line, engine overlays, and
   * training position display.  Cleared when the user navigates to any mainline position.
   */
  boardPreview: { fen: string; lastMove?: [string, string] | null } | null;

  // ── Hover position preview ──────────────────────────────────────────────
  /** Whether hovering over a move token shows a floating position preview popup. */
  positionPreviewOnHover: boolean;

  // ── Board decoration preferences ────────────────────────────────────────
  /** Persisted preferences for board shapes, move hints, and square style. */
  shapePrefs: ShapePrefs;

  // ── Editor style preferences ────────────────────────────────────────────
  /** Persisted visual style preferences for the PGN text editor. */
  editorStylePrefs: EditorStylePrefs;

  // ── Default Layout preferences ───────────────────────────────────────────
  /** Persisted behaviour preferences for the "Default Layout" toolbar action. */
  defaultLayoutPrefs: DefaultLayoutPrefs;
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
  showEvalPills: true,
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
  // Board decoration preferences
  shapePrefs: DEFAULT_SHAPE_PREFS,
  // Editor style preferences
  editorStylePrefs: DEFAULT_EDITOR_STYLE_PREFS,
  // Default Layout preferences
  defaultLayoutPrefs: DEFAULT_DEFAULT_LAYOUT_PREFS,
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
    case "set_move_delay_ms":
      return { ...state, moveDelayMs: action.value };
    case "set_sound_enabled":
      return { ...state, soundEnabled: action.enabled };
    case "set_error_message":
      return { ...state, errorMessage: action.message };

    // ── Editor ───────────────────────────────────────────────────────────
    case "set_layout_mode":
      return { ...state, pgnLayoutMode: action.mode };
    case "set_show_eval_pills":
      return { ...state, showEvalPills: action.show };
    case "set_game_info_editor_open":
      return { ...state, isGameInfoEditorOpen: action.open };

    // ── Board preview (direct component dispatch) ─────────────────────────
    case "set_board_preview":
      return { ...state, boardPreview: action.preview };

    case "set_position_preview_on_hover":
      return { ...state, positionPreviewOnHover: action.enabled };

    case "set_shape_prefs":
      return { ...state, shapePrefs: action.prefs };

    case "set_editor_style_prefs":
      return { ...state, editorStylePrefs: action.prefs };

    case "set_default_layout_prefs":
      return { ...state, defaultLayoutPrefs: action.prefs };

    // ── Fine-grained session state actions ───────────────────────────────
    case "set_pgn_state":
      return {
        ...state,
        pgnText: action.pgnText,
        pgnModel: action.pgnModel,
        moves: action.moves,
        pgnTextLength: action.pgnTextLength,
        moveCount: action.moveCount,
      };

    case "set_navigation":
      return {
        ...state,
        currentPly: action.currentPly,
        selectedMoveId: action.selectedMoveId,
        boardPreview: action.boardPreview,
      };

    case "set_undo_redo_depth":
      return { ...state, undoDepth: action.undoDepth, redoDepth: action.redoDepth };

    case "set_status_message":
      return { ...state, statusMessage: action.message };

    case "set_pending_focus":
      return { ...state, pendingFocusCommentId: action.commentId };

    case "set_sessions": {
      const { sessions, activeSessionId } = action;
      return {
        ...state,
        sessions,
        sessionCount: sessions.length,
        sessionTitles: sessions.map((s: SessionItemState): string => s.title),
        activeSessionId,
      };
    }

    case "set_resource_viewer": {
      const { resourceTabs, activeResourceTabId, activeResourceRowCount,
              activeResourceErrorMessage, activeSourceKind } = action;
      const activeTab: ResourceTabSnapshot | undefined = resourceTabs.find(
        (tab: ResourceTabSnapshot): boolean => tab.tabId === activeResourceTabId,
      );
      return {
        ...state,
        resourceViewerTabSnapshots: resourceTabs,
        resourceTabCount: resourceTabs.length,
        activeResourceTabId,
        activeResourceTabTitle: activeTab?.title ?? "",
        activeResourceTabKind: activeTab?.kind ?? "",
        activeResourceTabLocator: activeTab?.locator ?? "",
        activeResourceRowCount,
        activeResourceErrorMessage,
        activeSourceKind,
      };
    }

    default:
      return state;
  }
};
