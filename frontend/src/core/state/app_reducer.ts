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

import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import type { AppAction } from "./actions";
import type { DirtyState } from "../../features/sessions/services/session_store";
import { DEFAULT_SHAPE_PREFS } from "../../runtime/shape_prefs";
import type { ShapePrefs } from "../../runtime/shape_prefs";
import { DEFAULT_EDITOR_STYLE_PREFS } from "../../runtime/editor_style_prefs";
import type { EditorStylePrefs } from "../../runtime/editor_style_prefs";
import { DEFAULT_DEFAULT_LAYOUT_PREFS } from "../../runtime/default_layout_prefs";
import type { DefaultLayoutPrefs } from "../../runtime/default_layout_prefs";

export type ResourceTabSnapshot = {
  tabId: string;
  title: string;
  kind: string;
  locator: string;
};

export type SessionItemState = {
  sessionId: string;
  title: string;
  dirtyState: DirtyState;
  saveMode: "auto" | "manual";
  isActive: boolean;
  isUnsaved: boolean;
  white: string;
  black: string;
  event: string;
  date: string;
  sourceLocator: string;
  sourceGameRef: string;
  /** Pre-rendered primary label from the source resource's rendering profile. */
  renderedLine1?: string;
  /** Pre-rendered secondary label from the source resource's rendering profile. */
  renderedLine2?: string;
  /**
   * True when `renderedLine1`/`renderedLine2` come from a matched GRP rule (even if both
   * strings are empty). Session tab UI must not substitute player names in that case.
   */
  grpProfileApplied?: boolean;
};

export type AppStoreState = {
  locale: string;
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: "ast" | "pgn";
  isMenuOpen: boolean;
  boardFlipped: boolean;
  currentPly: number;
  moveCount: number;
  selectedMoveId: string | null;
  moveDelayMs: number;
  soundEnabled: boolean;
  statusMessage: string;
  errorMessage: string;
  activeSourceKind: string;
  pgnLayoutMode: "plain" | "text" | "tree";
  showEvalPills: boolean;
  pgnText: string;
  pgnModel: PgnModel | null;
  moves: string[];
  pgnTextLength: number;
  pendingFocusCommentId: string | null;
  isGameInfoEditorOpen: boolean;
  undoDepth: number;
  redoDepth: number;
  activeSessionId: string | null;
  sessionCount: number;
  sessionTitles: string[];
  sessions: SessionItemState[];
  resourceTabCount: number;
  activeResourceTabId: string | null;
  activeResourceTabTitle: string;
  activeResourceTabKind: string;
  activeResourceTabLocator: string;
  activeResourceRowCount: number;
  activeResourceErrorMessage: string;
  resourceViewerTabSnapshots: ResourceTabSnapshot[];
  boardPreview: { fen: string; lastMove?: [string, string] | null } | null;
  positionPreviewOnHover: boolean;
  shapePrefs: ShapePrefs;
  editorStylePrefs: EditorStylePrefs;
  defaultLayoutPrefs: DefaultLayoutPrefs;
  storageImportPending: Record<string, string> | null;
};

export const initialAppStoreState: AppStoreState = {
  locale: "en",
  isDeveloperToolsEnabled: true,
  isDevDockOpen: false,
  activeDevTab: "ast",
  isMenuOpen: false,
  boardFlipped: false,
  currentPly: 0,
  moveCount: 0,
  selectedMoveId: null,
  moveDelayMs: 220,
  soundEnabled: true,
  statusMessage: "",
  errorMessage: "",
  activeSourceKind: "directory",
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
  activeSessionId: null,
  sessionCount: 0,
  sessionTitles: [],
  sessions: [],
  resourceTabCount: 0,
  activeResourceTabId: null,
  activeResourceTabTitle: "",
  activeResourceTabKind: "",
  activeResourceTabLocator: "",
  activeResourceRowCount: 0,
  activeResourceErrorMessage: "",
  resourceViewerTabSnapshots: [],
  boardPreview: null,
  positionPreviewOnHover: true,
  shapePrefs: DEFAULT_SHAPE_PREFS,
  editorStylePrefs: DEFAULT_EDITOR_STYLE_PREFS,
  defaultLayoutPrefs: DEFAULT_DEFAULT_LAYOUT_PREFS,
  storageImportPending: null,
};

export const appReducer = (state: AppStoreState, action: AppAction): AppStoreState => {
  switch (action.type) {
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
    case "toggle_board_flip":
      return { ...state, boardFlipped: !state.boardFlipped };
    case "set_board_flipped":
      return { ...state, boardFlipped: action.flipped };
    case "set_move_delay_ms":
      return { ...state, moveDelayMs: action.value };
    case "set_sound_enabled":
      return { ...state, soundEnabled: action.enabled };
    case "set_error_message":
      return { ...state, errorMessage: action.message };
    case "set_layout_mode":
      return { ...state, pgnLayoutMode: action.mode };
    case "set_show_eval_pills":
      return { ...state, showEvalPills: action.show };
    case "set_game_info_editor_open":
      return { ...state, isGameInfoEditorOpen: action.open };
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
    case "set_storage_import_pending":
      return { ...state, storageImportPending: action.data };
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
        activeSessionId,
        sessionCount: sessions.length,
        sessionTitles: sessions.map((session) => session.title),
      };
    }
    case "set_resource_viewer": {
      const tabs = action.resourceTabs;
      const activeTab = tabs.find((tab) => tab.tabId === action.activeResourceTabId) ?? null;
      return {
        ...state,
        resourceViewerTabSnapshots: tabs,
        resourceTabCount: tabs.length,
        activeResourceTabId: action.activeResourceTabId,
        activeResourceTabTitle: activeTab?.title ?? "",
        activeResourceTabKind: activeTab?.kind ?? "",
        activeResourceTabLocator: activeTab?.locator ?? "",
        activeResourceRowCount: action.activeResourceRowCount,
        activeResourceErrorMessage: action.activeResourceErrorMessage,
        activeSourceKind: action.activeSourceKind,
      };
    }
    default:
      return state;
  }
};
