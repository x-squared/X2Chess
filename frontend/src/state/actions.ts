import type {
  RuntimeBoardSnapshot,
  RuntimeEditorSnapshot,
  RuntimeSessionsSnapshot,
  RuntimeResourceViewerSnapshot,
  RuntimeShellSnapshot,
} from "../hooks/runtime_bridge";

/**
 * React app action contracts.
 */
export type AppAction =
  | { type: "set_locale"; locale: string }
  | { type: "set_layout_mode"; mode: "plain" | "text" | "tree" }
  | { type: "set_dev_tools_enabled"; enabled: boolean }
  | { type: "set_dev_dock_open"; open: boolean }
  | { type: "set_active_dev_tab"; tab: "ast" | "dom" | "pgn" }
  | { type: "set_active_source_kind"; kind: string }
  | { type: "set_status_message"; message: string }
  | { type: "set_error_message"; message: string }
  | { type: "set_sound_enabled"; enabled: boolean }
  | { type: "set_move_delay_ms"; value: number }
  | { type: "sync_board_snapshot"; snapshot: RuntimeBoardSnapshot }
  | { type: "sync_editor_snapshot"; snapshot: RuntimeEditorSnapshot }
  | { type: "sync_sessions_snapshot"; snapshot: RuntimeSessionsSnapshot }
  | { type: "sync_resource_viewer_snapshot"; snapshot: RuntimeResourceViewerSnapshot }
  | { type: "sync_shell_snapshot"; snapshot: RuntimeShellSnapshot };
