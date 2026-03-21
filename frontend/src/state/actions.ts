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

import type { PgnModel } from "../model/pgn_model";
import type { SessionItemState, ResourceTabSnapshot } from "./app_reducer";

export type AppAction =
  // ── Shell actions ──────────────────────────────────────────────────────
  | { type: "set_locale"; locale: string }
  | { type: "set_dev_tools_enabled"; enabled: boolean }
  | { type: "set_dev_dock_open"; open: boolean }
  | { type: "set_active_dev_tab"; tab: "ast" | "dom" | "pgn" }
  | { type: "set_is_menu_open"; open: boolean }
  // ── Board / navigation actions ─────────────────────────────────────────
  | { type: "set_current_ply"; ply: number }
  | { type: "set_move_count"; count: number }
  | { type: "set_selected_move_id"; id: string | null }
  | { type: "set_move_delay_ms"; value: number }
  | { type: "set_sound_enabled"; enabled: boolean }
  | { type: "set_status_message"; message: string }
  | { type: "set_error_message"; message: string }
  // ── Editor / PGN actions ───────────────────────────────────────────────
  | { type: "set_layout_mode"; mode: "plain" | "text" | "tree" }
  /**
   * Full PGN load or edit commit.
   * Replaces `pgnText`, `pgnModel`, `moves`, and `pgnTextLength` atomically.
   */
  | { type: "set_pgn"; pgnText: string; pgnModel: PgnModel; moves: string[] }
  | { type: "set_pending_focus_comment_id"; id: string | null }
  | { type: "set_game_info_editor_open"; open: boolean }
  /** Undo/redo stack depths for enabling/disabling toolbar buttons. */
  | { type: "set_undo_redo"; undoDepth: number; redoDepth: number }
  // ── Session actions ────────────────────────────────────────────────────
  | { type: "set_active_source_kind"; kind: string }
  /**
   * Replace the full session list.  Dispatched by `useAppStartup` whenever the
   * session store changes (open / switch / close).
   */
  | {
      type: "set_sessions";
      sessions: SessionItemState[];
      activeSessionId: string | null;
    }
  // ── Resource viewer actions ────────────────────────────────────────────
  /**
   * Replace the resource tab list.  Dispatched by `useAppStartup` after each
   * `render()` cycle when the legacy resource viewer updates its tab state.
   */
  | {
      type: "set_resource_tabs";
      tabs: ResourceTabSnapshot[];
      activeTabId: string | null;
    };
