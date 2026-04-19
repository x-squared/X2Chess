/**
 * Guide IDs registry — typed constants for all semantic component targets.
 *
 * Every `data-guide-id` attribute in the component tree must reference a
 * constant from this object.  Raw string literals are disallowed to prevent
 * drift when components move.
 *
 * Integration API:
 * - `import { GUIDE_IDS } from "../model/guide_ids"` then
 *   `<div data-guide-id={GUIDE_IDS.BOARD_ROOT}>`.
 *
 * Configuration API:
 * - Add new entries to `GUIDE_IDS` when a new guideable element is added.
 *   Remove the entry when the element is deleted; TypeScript flags all uses.
 *
 * Communication API:
 * - Read-only constant — no side effects.
 */

export const GUIDE_IDS = {
  // ── Application shell ────────────────────────────────────────────────────
  APP_MENU: "app.menu",

  // ── Session management ──────────────────────────────────────────────────
  SESSIONS_PANEL: "sessions.panel",

  // ── Game info (header editor) ───────────────────────────────────────────
  GAME_INFO_SUMMARY: "game-info.summary",
  GAME_INFO_EDITOR: "game-info.editor",

  // ── Chess board ─────────────────────────────────────────────────────────
  /** Outer split-pane container (board + editor side by side). */
  BOARD_ROOT: "board.root",
  /** The chessboard canvas itself. */
  CHESS_BOARD: "board.chess-board",
  /** Toolbar strip above the PGN editor. */
  TOOLBAR: "editor.toolbar",
  /** Editor pane wrapper (toolbar + text editor + sidebar). */
  EDITOR_PANE: "editor.pane",

  // ── Navigation toolbar ──────────────────────────────────────────────────
  TOOLBAR_NAV_GROUP: "toolbar.nav-group",
  TOOLBAR_NAV_FIRST: "toolbar.nav-first",
  TOOLBAR_NAV_PREV: "toolbar.nav-prev",
  TOOLBAR_NAV_NEXT: "toolbar.nav-next",
  TOOLBAR_NAV_LAST: "toolbar.nav-last",
  TOOLBAR_FLIP_BOARD: "toolbar.flip-board",
  TOOLBAR_ACTIONS_GROUP: "toolbar.actions-group",

  // ── PGN text editor ─────────────────────────────────────────────────────
  EDITOR_PGN_TEXT: "editor.pgn-text",

  // ── Editor sidebar ──────────────────────────────────────────────────────
  EDITOR_SIDEBAR: "editor.sidebar",
  EDITOR_SIDEBAR_LAYOUT_GROUP: "editor.sidebar.layout-group",
  EDITOR_SIDEBAR_LAYOUT_PLAIN: "editor.sidebar.layout-plain",
  EDITOR_SIDEBAR_LAYOUT_TEXT: "editor.sidebar.layout-text",
  EDITOR_SIDEBAR_LAYOUT_TREE: "editor.sidebar.layout-tree",
  EDITOR_SIDEBAR_FORMAT_COMMENT: "editor.sidebar.format-comment",
  EDITOR_SIDEBAR_BOARD_SETTINGS: "editor.sidebar.board-settings",

  // ── Right panel stack ───────────────────────────────────────────────────
  RIGHT_PANEL_STACK: "panel.right-stack",
  RIGHT_PANEL_TABS: "panel.right-tabs",
  RIGHT_PANEL_TAB_RESOURCES: "panel.tab.resources",
  RIGHT_PANEL_TAB_ANALYSIS: "panel.tab.analysis",
  RIGHT_PANEL_TAB_OPENING: "panel.tab.opening",
  RIGHT_PANEL_TAB_TABLEBASE: "panel.tab.tablebase",
  RIGHT_PANEL_TAB_COLLECTION: "panel.tab.collection",
  RIGHT_PANEL_TAB_GAME_SEARCH: "panel.tab.game-search",
  RIGHT_PANEL_TAB_POSITION_SEARCH: "panel.tab.position-search",
  RIGHT_PANEL_TAB_TEXT_SEARCH: "panel.tab.text-search",
  RIGHT_PANEL_TAB_PLAYERS: "panel.tab.players",
  RIGHT_PANEL_TAB_SETTINGS: "panel.tab.settings",
  RIGHT_PANEL_BODY: "panel.body",
  RIGHT_PANEL_RESOURCES: "panel.resources",
  RIGHT_PANEL_ANALYSIS: "panel.analysis",
  RIGHT_PANEL_OPENING: "panel.opening",
  RIGHT_PANEL_TABLEBASE: "panel.tablebase",
  RIGHT_PANEL_COLLECTION: "panel.collection",
  RIGHT_PANEL_GAME_SEARCH: "panel.game-search",
  RIGHT_PANEL_POSITION_SEARCH: "panel.position-search",
  RIGHT_PANEL_TEXT_SEARCH: "panel.text-search",
  RIGHT_PANEL_PLAYERS: "panel.players",
  RIGHT_PANEL_SETTINGS: "panel.settings",

  // ── Editor annotations ──────────────────────────────────────────────────
  /** Compact three-button NAG annotation row shown when a move is selected. */
  NAG_ANNOTATION_BUTTONS: "editor.nag-buttons",
  /** Right-click context menu on a move token. */
  TRUNCATION_MENU: "editor.context-menu",

  // ── Panel components ────────────────────────────────────────────────────
  ANALYSIS_PANEL: "analysis.panel",
  ANALYSIS_PANEL_HEADER: "analysis.panel.header",
  ANALYSIS_PANEL_VARIATIONS: "analysis.panel.variations",
  OPENING_EXPLORER_PANEL: "opening.panel",
  OPENING_EXPLORER_HEADER: "opening.panel.header",
  OPENING_MOVES_TABLE: "opening.panel.moves-table",
  TABLEBASE_PANEL: "tablebase.panel",
  TABLEBASE_PANEL_HEADER: "tablebase.panel.header",
  TABLEBASE_MOVES: "tablebase.panel.moves",
  COLLECTION_EXPLORER_PANEL: "collection.panel",
  COLLECTION_EXPLORER_HEADER: "collection.panel.header",
  GAME_SEARCH_PANEL: "game-search.panel",
  POSITION_SEARCH_PANEL: "position-search.panel",
  POSITION_SEARCH_HEADER: "position-search.panel.header",
  TEXT_SEARCH_PANEL: "text-search.panel",
  TEXT_SEARCH_HEADER: "text-search.panel.header",
  PLAYERS_PANEL: "players.panel",
  PLAYERS_PANEL_LIST: "players.panel.list",
  SETTINGS_PANEL: "settings.panel",
  RESOURCE_VIEWER_PANEL: "resources.panel",

  // ── Dialogs ─────────────────────────────────────────────────────────────
  DISAMBIGUATION_DIALOG: "dialog.disambiguation",
  PROMOTION_PICKER: "dialog.promotion",

  // ── Developer dock ──────────────────────────────────────────────────────
  DEV_DOCK: "dev.dock",

  // ── Developer tools panel (right-stack tab) ──────────────────────────────
  RIGHT_PANEL_TAB_DEV_TOOLS: "panel.tab.dev-tools",
  RIGHT_PANEL_DEV_TOOLS: "panel.dev-tools",
} as const;

/** Union of all registered guide ID strings. */
export type GuideId = (typeof GUIDE_IDS)[keyof typeof GUIDE_IDS];
