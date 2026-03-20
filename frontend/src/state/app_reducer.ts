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
    default:
      return state;
  }
};
