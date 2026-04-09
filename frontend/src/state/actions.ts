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

import type { PgnModel } from "../../../parts/pgnparser/src/pgn_model";
import type { SessionItemState, ResourceTabSnapshot } from "./app_reducer";
import type { ShapePrefs } from "../runtime/shape_prefs";
import type { EditorStylePrefs } from "../runtime/editor_style_prefs";
import type { DefaultLayoutPrefs } from "../runtime/default_layout_prefs";

export type AppAction =
  // ── Shell actions ──────────────────────────────────────────────────────
  | { type: "set_locale"; locale: string }
  | { type: "set_dev_tools_enabled"; enabled: boolean }
  | { type: "set_dev_dock_open"; open: boolean }
  | { type: "set_active_dev_tab"; tab: "ast" }
  | { type: "set_is_menu_open"; open: boolean }
  // ── Board / navigation actions ─────────────────────────────────────────
  | { type: "toggle_board_flip" }
  | { type: "set_board_flipped"; flipped: boolean }
  | { type: "set_move_delay_ms"; value: number }
  | { type: "set_sound_enabled"; enabled: boolean }
  | { type: "set_error_message"; message: string }
  // ── Editor / PGN actions ───────────────────────────────────────────────
  | { type: "set_layout_mode"; mode: "plain" | "text" | "tree" }
  | { type: "set_show_eval_pills"; show: boolean }
  | { type: "set_game_info_editor_open"; open: boolean }
  // ── Board preview (direct React dispatch — used for engine/training overlays) ──
  /**
   * Override the board position shown in `ChessBoard`.  Dispatched directly by
   * components when an engine or training overlay needs to display a position
   * that is not derived from the active session's mainline ply.
   */
  | { type: "set_board_preview"; preview: { fen: string; lastMove?: [string, string] | null } | null }
  // ── Hover position preview ─────────────────────────────────────────────
  /** Enable or disable the floating position popup when hovering over move tokens. */
  | { type: "set_position_preview_on_hover"; enabled: boolean }
  /** Update board shape / decoration preferences (persisted separately to localStorage). */
  | { type: "set_shape_prefs"; prefs: ShapePrefs }
  /** Update PGN text editor visual style preferences (persisted separately to localStorage). */
  | { type: "set_editor_style_prefs"; prefs: EditorStylePrefs }
  /** Update Default Layout behaviour preferences (persisted separately to localStorage). */
  | { type: "set_default_layout_prefs"; prefs: DefaultLayoutPrefs }
  // ── Fine-grained session state actions ────────────────────────────────
  /**
   * Full PGN/model state for the active session — dispatched whenever the PGN
   * text or model changes (load, edit, undo/redo).
   */
  | {
      type: "set_pgn_state";
      pgnText: string;
      pgnModel: PgnModel | null;
      moves: string[];
      pgnTextLength: number;
      moveCount: number;
    }
  /**
   * Board navigation state — dispatched on every ply step, move selection, or
   * board-preview change.
   */
  | {
      type: "set_navigation";
      currentPly: number;
      selectedMoveId: string | null;
      boardPreview: { fen: string; lastMove?: [string, string] | null } | null;
    }
  /** Undo/redo stack depths — drives button enabled state. */
  | { type: "set_undo_redo_depth"; undoDepth: number; redoDepth: number }
  /** Status bar message (e.g. "Saved", "Error saving"). */
  | { type: "set_status_message"; message: string }
  /** Comment node ID that should receive focus after next render, or null. */
  | { type: "set_pending_focus"; commentId: string | null }
  /**
   * Full session-list snapshot — dispatched whenever sessions are opened,
   * closed, switched, or their metadata changes.
   */
  | {
      type: "set_sessions";
      sessions: SessionItemState[];
      activeSessionId: string | null;
    }
  /**
   * Resource-viewer state — dispatched whenever tabs are opened, closed,
   * reloaded, or the active tab changes.
   */
  | {
      type: "set_resource_viewer";
      resourceTabs: ResourceTabSnapshot[];
      activeResourceTabId: string | null;
      activeResourceRowCount: number;
      activeResourceErrorMessage: string;
      activeSourceKind: string;
    }
  /**
   * Pending webview-storage import snapshot.  `null` closes the import dialog;
   * a non-null value opens it with the parsed storage entries for selection.
   */
  | { type: "set_storage_import_pending"; data: Record<string, string> | null };
