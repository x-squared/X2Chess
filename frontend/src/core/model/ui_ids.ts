/**
 * Canonical UI identifier registry — every `data-ui-id` in the component tree must
 * reference a constant from `UI_IDS`. Raw string literals are disallowed so IDs do
 * not drift when markup moves.
 *
 * Integration API:
 * - `import { UI_IDS } from "../../core/model/ui_ids"` then
 *   `<div data-ui-id={UI_IDS.BOARD_ROOT}>`.
 *
 * Communication API:
 * - Read-only constants — no side effects.
 */

export const UI_IDS = {
  // ── Application shell ────────────────────────────────────────────────────
  APP_MENU: "app.menu",

  // ── Session management ──────────────────────────────────────────────────
  SESSIONS_PANEL: "sessions.panel",

  // ── Game info (header editor) ─────────────────────────────────────────
  GAME_INFO_SUMMARY: "game-info.summary",
  GAME_INFO_EDITOR: "game-info.editor",
  /** Head movetext field inside the game-info editor region. */
  GAME_INFO_XSQR_HEAD: "game-info.xsqr-head",

  // ── Chess board ─────────────────────────────────────────────────────────
  BOARD_ROOT: "board.root",
  CHESS_BOARD: "board.chess-board",
  TOOLBAR: "editor.toolbar",
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
  RIGHT_PANEL_TAB_METADATA: "panel.tab.metadata",
  RIGHT_PANEL_TAB_PLAYERS: "panel.tab.players",
  RIGHT_PANEL_TAB_SETTINGS: "panel.tab.settings",
  RIGHT_PANEL_BODY: "panel.body",
  RIGHT_PANEL_RESOURCES: "panel.resources",
  RIGHT_PANEL_METADATA: "panel.metadata",
  METADATA_PANEL: "metadata.panel",
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
  NAG_ANNOTATION_BUTTONS: "editor.nag-buttons",
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
  /** Resources right-panel viewer root (`<section class="resource-viewer-card">`). */
  RESOURCE_VIEWER_PANEL: "resources.panel",

  // ── Resources viewer (sub-regions of `RESOURCE_VIEWER_PANEL`) ────────────
  RESOURCES_TAB_BAR: "resources.panel.tabBar",
  RESOURCES_TAB_HEADER: "resources.panel.tabBar.header",
  RESOURCES_TAB_STRIP: "resources.panel.tabBar.strip",
  RESOURCES_TAB: "resources.panel.tabBar.tab",
  RESOURCES_DELETE_GAME_BUTTON: "resources.panel.tabBar.deleteGame",
  RESOURCES_TOOLBAR: "resources.panel.toolbar",
  RESOURCES_TABLE: "resources.panel.table",
  RESOURCES_TABLE_EMPTY: "resources.panel.table.empty",
  RESOURCES_TABLE_ERROR: "resources.panel.table.error",
  RESOURCES_TABLE_LOADING: "resources.panel.table.loading",
  RESOURCES_TABLE_SCROLL: "resources.panel.table.scroll",
  RESOURCES_TABLE_GRID: "resources.panel.table.grid",
  RESOURCES_TABLE_COLGROUP: "resources.panel.table.colgroup",
  RESOURCES_TABLE_HEAD: "resources.panel.table.head",
  RESOURCES_TABLE_FILTER_ROW: "resources.panel.table.filterRow",
  RESOURCES_TABLE_BODY: "resources.panel.table.body",
  /** Data rows — many `<tr>` elements share this `data-ui-id` value. */
  RESOURCES_TABLE_ROW: "resources.panel.table.row",
  /** Group header rows in grouped table view. */
  RESOURCES_TABLE_GROUP_ROW: "resources.panel.table.groupRow",
  /** Kind column badge for a full game row. */
  RESOURCES_TABLE_KIND_BADGE_GAME: "resources.panel.table.kindBadge.game",
  /** Kind column badge for a position row. */
  RESOURCES_TABLE_KIND_BADGE_POSITION: "resources.panel.table.kindBadge.position",
  RESOURCES_TABLE_TRAINING_BADGE: "resources.panel.table.trainingBadge",
  /** Copy-record-id control in the Game ID column (hash icon). */
  RESOURCES_TABLE_GAME_ID_BTN: "resources.panel.table.gameIdBtn",
  /** Reorder resource table columns (Move up / down). */
  RESOURCE_COLUMN_ORDER_DIALOG: "resources.panel.columnOrderDialog",

  // ── Dialogs ─────────────────────────────────────────────────────────────
  DISAMBIGUATION_DIALOG: "dialog.disambiguation",
  PROMOTION_PICKER: "dialog.promotion",
  NEW_GAME_DIALOG: "dialog.new-game",
  NEW_GAME_FEN_HELP_DIALOG: "dialog.new-game-fen-help",
  EDIT_START_POSITION_DIALOG: "dialog.edit-start-position",
  PLAY_VS_ENGINE_DIALOG: "dialog.play-vs-engine",
  GAME_PICKER_DIALOG: "dialog.game-picker",
  ANNOTATE_GAME_DIALOG: "dialog.annotate-game",
  EXTRACT_POSITION_DIALOG: "dialog.extract-position",
  ANCHOR_PICKER_DIALOG: "dialog.anchor-picker",
  ANCHOR_DEF_DIALOG: "dialog.anchor-def",
  METADATA_SCHEMA_EDITOR_DIALOG: "dialog.metadata-schema-editor",

  // ── Engine manager ──────────────────────────────────────────────────────
  ENGINE_MANAGER_PANEL: "engines.manager",
  ENGINE_MANAGER_LIST: "engines.manager.list",
  ENGINE_MANAGER_TOOLBAR: "engines.manager.toolbar",
  ENGINE_CONFIG_DIALOG: "engines.config-dialog",
  ENGINE_CONFIG_OPTIONS_TABLE: "engines.config-dialog.options-table",

  // ── Developer dock ──────────────────────────────────────────────────────
  DEV_DOCK: "dev.dock",

  // ── Developer tools panel (right-stack tab) ──────────────────────────────
  RIGHT_PANEL_TAB_DEV_TOOLS: "panel.tab.dev-tools",
  RIGHT_PANEL_DEV_TOOLS: "panel.dev-tools",
} as const;

/** Union of all registered `data-ui-id` string values. */
export type UiId = (typeof UI_IDS)[keyof typeof UI_IDS];
