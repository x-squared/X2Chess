/**
 * App action contracts for the X2Chess useReducer store.
 *
 * Integration API:
 * - Import `AppAction` as the discriminated-union type for all `dispatch()` calls.
 *
 * Configuration API:
 * - No configuration; each action variant is self-contained.
 *
 * Communication API:
 * - Each action variant is dispatched via `dispatch(action)` from `useAppContext()`.
 */

import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import type { SessionItemState, ResourceTabSnapshot } from "./app_reducer";
import type { ShapePrefs } from "../../runtime/shape_prefs";
import type { EditorStylePrefs } from "../../runtime/editor_style_prefs";
import type { DefaultLayoutPrefs } from "../../runtime/default_layout_prefs";

export type AppAction =
  | { type: "set_locale"; locale: string }
  | { type: "set_dev_tools_enabled"; enabled: boolean }
  | { type: "set_dev_dock_open"; open: boolean }
  | { type: "set_active_dev_tab"; tab: "ast" | "pgn" }
  | { type: "set_is_menu_open"; open: boolean }
  | { type: "toggle_board_flip" }
  | { type: "set_board_flipped"; flipped: boolean }
  | { type: "set_move_delay_ms"; value: number }
  | { type: "set_sound_enabled"; enabled: boolean }
  | { type: "set_error_message"; message: string }
  | { type: "set_layout_mode"; mode: "plain" | "text" | "tree" }
  | { type: "set_show_eval_pills"; show: boolean }
  | { type: "set_game_info_editor_open"; open: boolean }
  | { type: "set_board_preview"; preview: { fen: string; lastMove?: [string, string] | null } | null }
  | { type: "set_position_preview_on_hover"; enabled: boolean }
  | { type: "set_shape_prefs"; prefs: ShapePrefs }
  | { type: "set_editor_style_prefs"; prefs: EditorStylePrefs }
  | { type: "set_default_layout_prefs"; prefs: DefaultLayoutPrefs }
  | {
      type: "set_pgn_state";
      pgnText: string;
      pgnModel: PgnModel | null;
      moves: string[];
      pgnTextLength: number;
      moveCount: number;
    }
  | {
      type: "set_navigation";
      currentPly: number;
      selectedMoveId: string | null;
      boardPreview: { fen: string; lastMove?: [string, string] | null } | null;
    }
  | { type: "set_undo_redo_depth"; undoDepth: number; redoDepth: number }
  | { type: "set_status_message"; message: string }
  | { type: "set_pending_focus"; commentId: string | null }
  | {
      type: "set_sessions";
      sessions: SessionItemState[];
      activeSessionId: string | null;
    }
  | {
      type: "set_resource_viewer";
      resourceTabs: ResourceTabSnapshot[];
      activeResourceTabId: string | null;
      activeResourceRowCount: number;
      activeResourceErrorMessage: string;
      activeSourceKind: string;
    }
  | { type: "set_storage_import_pending"; data: Record<string, string> | null };
