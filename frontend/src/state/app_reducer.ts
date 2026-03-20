import type { AppAction } from "./actions";

export type AppStoreState = {
  locale: string;
  pgnLayoutMode: "plain" | "text" | "tree";
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: "ast" | "dom" | "pgn";
  activeSourceKind: string;
  statusMessage: string;
  errorMessage: string;
  soundEnabled: boolean;
  moveDelayMs: number;
  currentPly: number;
  moveCount: number;
  selectedMoveId: string | null;
  pendingFocusCommentId: string | null;
  isGameInfoEditorOpen: boolean;
  pgnTextLength: number;
  activeSessionId: string | null;
  sessionCount: number;
  sessionTitles: string[];
  resourceTabCount: number;
  activeResourceTabId: string | null;
  activeResourceTabTitle: string;
  activeResourceTabKind: string;
  activeResourceTabLocator: string;
  activeResourceRowCount: number;
  activeResourceErrorMessage: string;
};

export const initialAppStoreState: AppStoreState = {
  locale: "en",
  pgnLayoutMode: "plain",
  isDeveloperToolsEnabled: true,
  isDevDockOpen: false,
  activeDevTab: "ast",
  activeSourceKind: "directory",
  statusMessage: "",
  errorMessage: "",
  soundEnabled: true,
  moveDelayMs: 220,
  currentPly: 0,
  moveCount: 0,
  selectedMoveId: null,
  pendingFocusCommentId: null,
  isGameInfoEditorOpen: false,
  pgnTextLength: 0,
  activeSessionId: null,
  sessionCount: 0,
  sessionTitles: [],
  resourceTabCount: 0,
  activeResourceTabId: null,
  activeResourceTabTitle: "",
  activeResourceTabKind: "",
  activeResourceTabLocator: "",
  activeResourceRowCount: 0,
  activeResourceErrorMessage: "",
};

export const appReducer = (state: AppStoreState, action: AppAction): AppStoreState => {
  switch (action.type) {
    case "set_locale":
      return { ...state, locale: action.locale };
    case "set_layout_mode":
      return { ...state, pgnLayoutMode: action.mode };
    case "set_dev_tools_enabled":
      return { ...state, isDeveloperToolsEnabled: action.enabled };
    case "set_dev_dock_open":
      return { ...state, isDevDockOpen: action.open };
    case "set_active_dev_tab":
      return { ...state, activeDevTab: action.tab };
    case "set_active_source_kind":
      return { ...state, activeSourceKind: action.kind };
    case "set_status_message":
      return { ...state, statusMessage: action.message };
    case "set_error_message":
      return { ...state, errorMessage: action.message };
    case "set_sound_enabled":
      return { ...state, soundEnabled: action.enabled };
    case "set_move_delay_ms":
      return { ...state, moveDelayMs: action.value };
    case "sync_board_snapshot":
      return {
        ...state,
        currentPly: action.snapshot.currentPly,
        moveCount: action.snapshot.moveCount,
        selectedMoveId: action.snapshot.selectedMoveId,
        moveDelayMs: action.snapshot.moveDelayMs,
        soundEnabled: action.snapshot.soundEnabled,
        pgnLayoutMode: action.snapshot.pgnLayoutMode,
        statusMessage: action.snapshot.statusMessage,
        errorMessage: action.snapshot.errorMessage,
      };
    case "sync_editor_snapshot":
      return {
        ...state,
        pgnLayoutMode: action.snapshot.pgnLayoutMode,
        pendingFocusCommentId: action.snapshot.pendingFocusCommentId,
        isGameInfoEditorOpen: action.snapshot.isGameInfoEditorOpen,
        pgnTextLength: action.snapshot.pgnTextLength,
      };
    case "sync_sessions_snapshot":
      return {
        ...state,
        activeSessionId: action.snapshot.activeSessionId,
        sessionCount: action.snapshot.sessionCount,
        sessionTitles: action.snapshot.sessions.map((session) => session.title),
      };
    case "sync_resource_viewer_snapshot":
      return {
        ...state,
        activeSourceKind: action.snapshot.activeSourceKind,
        resourceTabCount: action.snapshot.tabCount,
        activeResourceTabId: action.snapshot.activeTabId,
        activeResourceTabTitle: action.snapshot.activeTabTitle,
        activeResourceTabKind: action.snapshot.activeTabKind,
        activeResourceTabLocator: action.snapshot.activeTabLocator,
        activeResourceRowCount: action.snapshot.activeRowCount,
        activeResourceErrorMessage: action.snapshot.activeErrorMessage,
      };
    case "sync_shell_snapshot":
      return {
        ...state,
        locale: action.snapshot.locale,
        isDeveloperToolsEnabled: action.snapshot.isDeveloperToolsEnabled,
        isDevDockOpen: action.snapshot.isDevDockOpen,
        activeDevTab: action.snapshot.activeDevTab,
      };
    default:
      return state;
  }
};
