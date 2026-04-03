import test from "node:test";
import assert from "node:assert/strict";
import { appReducer, initialAppStoreState } from "../../src/state/app_reducer.js";
import type { AppStoreState, SessionItemState, ResourceTabSnapshot } from "../../src/state/app_reducer.js";
import { parsePgnToModel } from "../../src/model/pgn_model.js";

const s = initialAppStoreState;

// ── Shell actions ──────────────────────────────────────────────────────────────

test("set_locale — updates locale", () => {
  const next = appReducer(s, { type: "set_locale", locale: "de" });
  assert.equal(next.locale, "de");
});

test("set_dev_tools_enabled — toggles developer tools flag", () => {
  const next = appReducer(s, { type: "set_dev_tools_enabled", enabled: false });
  assert.equal(next.isDeveloperToolsEnabled, false);
});

test("set_dev_dock_open — opens and closes dev dock", () => {
  const opened = appReducer(s, { type: "set_dev_dock_open", open: true });
  assert.equal(opened.isDevDockOpen, true);
  const closed = appReducer(opened, { type: "set_dev_dock_open", open: false });
  assert.equal(closed.isDevDockOpen, false);
});

test("set_active_dev_tab — changes active dev tab", () => {
  const next = appReducer(s, { type: "set_active_dev_tab", tab: "ast" });
  assert.equal(next.activeDevTab, "ast");
});

test("set_is_menu_open — opens menu", () => {
  const next = appReducer(s, { type: "set_is_menu_open", open: true });
  assert.equal(next.isMenuOpen, true);
});

// ── Board / navigation ─────────────────────────────────────────────────────────

test("toggle_board_flip — flips board", () => {
  assert.equal(s.boardFlipped, false);
  const flipped = appReducer(s, { type: "toggle_board_flip" });
  assert.equal(flipped.boardFlipped, true);
  const unflipped = appReducer(flipped, { type: "toggle_board_flip" });
  assert.equal(unflipped.boardFlipped, false);
});

test("set_current_ply — updates ply", () => {
  const next = appReducer(s, { type: "set_current_ply", ply: 5 });
  assert.equal(next.currentPly, 5);
});

test("set_move_count — updates move count", () => {
  const next = appReducer(s, { type: "set_move_count", count: 40 });
  assert.equal(next.moveCount, 40);
});

test("set_selected_move_id — sets and clears selected move", () => {
  const withMove = appReducer(s, { type: "set_selected_move_id", id: "move_1" });
  assert.equal(withMove.selectedMoveId, "move_1");
  const cleared = appReducer(withMove, { type: "set_selected_move_id", id: null });
  assert.equal(cleared.selectedMoveId, null);
});

test("set_move_delay_ms — updates delay", () => {
  const next = appReducer(s, { type: "set_move_delay_ms", value: 500 });
  assert.equal(next.moveDelayMs, 500);
});

test("set_sound_enabled — disables sound", () => {
  const next = appReducer(s, { type: "set_sound_enabled", enabled: false });
  assert.equal(next.soundEnabled, false);
});

test("set_status_message — updates status message", () => {
  const next = appReducer(s, { type: "set_status_message", message: "Saved" });
  assert.equal(next.statusMessage, "Saved");
});

test("set_error_message — updates error message", () => {
  const next = appReducer(s, { type: "set_error_message", message: "Parse error" });
  assert.equal(next.errorMessage, "Parse error");
});

// ── Editor / PGN ──────────────────────────────────────────────────────────────

test("set_layout_mode — changes layout mode", () => {
  const next = appReducer(s, { type: "set_layout_mode", mode: "tree" });
  assert.equal(next.pgnLayoutMode, "tree");
});

test("set_show_eval_pills — toggles eval pills", () => {
  const next = appReducer(s, { type: "set_show_eval_pills", show: false });
  assert.equal(next.showEvalPills, false);
});

test("set_pgn — atomically updates pgn text, model, moves, length, and move count", () => {
  const model = parsePgnToModel("1. e4 e5 2. Nf3");
  const next = appReducer(s, {
    type: "set_pgn",
    pgnText: "1. e4 e5 2. Nf3",
    pgnModel: model,
    moves: ["e4", "e5", "Nf3"],
  });
  assert.equal(next.pgnText, "1. e4 e5 2. Nf3");
  assert.equal(next.pgnModel, model);
  assert.deepEqual(next.moves, ["e4", "e5", "Nf3"]);
  assert.equal(next.pgnTextLength, "1. e4 e5 2. Nf3".length);
  assert.equal(next.moveCount, 3);
});

test("set_pending_focus_comment_id — sets and clears pending focus id", () => {
  const withId = appReducer(s, { type: "set_pending_focus_comment_id", id: "comment_1" });
  assert.equal(withId.pendingFocusCommentId, "comment_1");
  const cleared = appReducer(withId, { type: "set_pending_focus_comment_id", id: null });
  assert.equal(cleared.pendingFocusCommentId, null);
});

test("set_game_info_editor_open — opens and closes editor", () => {
  const opened = appReducer(s, { type: "set_game_info_editor_open", open: true });
  assert.equal(opened.isGameInfoEditorOpen, true);
});

test("set_undo_redo — updates depths", () => {
  const next = appReducer(s, { type: "set_undo_redo", undoDepth: 3, redoDepth: 1 });
  assert.equal(next.undoDepth, 3);
  assert.equal(next.redoDepth, 1);
});

// ── Sessions ────────────────────────────────────────────────────────────────���──

test("set_sessions — updates sessions, count, titles, and activeSessionId", () => {
  const sessions: SessionItemState[] = [
    {
      sessionId: "s1", title: "Game 1", dirtyState: "clean", saveMode: "auto",
      isActive: true, isUnsaved: false, white: "", black: "", event: "", date: "",
      sourceLocator: "", sourceGameRef: "",
    },
    {
      sessionId: "s2", title: "Game 2", dirtyState: "clean", saveMode: "manual",
      isActive: false, isUnsaved: true, white: "", black: "", event: "", date: "",
      sourceLocator: "", sourceGameRef: "",
    },
  ];
  const next = appReducer(s, { type: "set_sessions", sessions, activeSessionId: "s1" });
  assert.equal(next.sessions, sessions);
  assert.equal(next.sessionCount, 2);
  assert.deepEqual(next.sessionTitles, ["Game 1", "Game 2"]);
  assert.equal(next.activeSessionId, "s1");
});

// ── Resource viewer ────────────────────────────────────────────────────────────

test("set_resource_tabs — updates all tab-related fields", () => {
  const tabs: ResourceTabSnapshot[] = [
    { tabId: "tab1", title: "My Games", kind: "directory", locator: "/games" },
    { tabId: "tab2", title: "DB", kind: "db", locator: "main.db" },
  ];
  const next = appReducer(s, { type: "set_resource_tabs", tabs, activeTabId: "tab1" });
  assert.equal(next.resourceViewerTabSnapshots, tabs);
  assert.equal(next.resourceTabCount, 2);
  assert.equal(next.activeResourceTabId, "tab1");
  assert.equal(next.activeResourceTabTitle, "My Games");
  assert.equal(next.activeResourceTabKind, "directory");
  assert.equal(next.activeResourceTabLocator, "/games");
});

test("set_resource_tabs — active tab not found clears title/kind/locator", () => {
  const tabs: ResourceTabSnapshot[] = [
    { tabId: "tab1", title: "Games", kind: "directory", locator: "/g" },
  ];
  const next = appReducer(s, { type: "set_resource_tabs", tabs, activeTabId: "no-match" });
  assert.equal(next.activeResourceTabTitle, "");
  assert.equal(next.activeResourceTabKind, "");
  assert.equal(next.activeResourceTabLocator, "");
});

test("set_active_resource_data — updates row count and error message", () => {
  const next = appReducer(s, { type: "set_active_resource_data", rowCount: 42, errorMessage: "" });
  assert.equal(next.activeResourceRowCount, 42);
});

// ── Board preview ──────────────────────────────────────────────────────────────

test("set_board_preview — sets and clears board preview", () => {
  const preview = { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2" };
  const withPreview = appReducer(s, { type: "set_board_preview", preview });
  assert.deepEqual(withPreview.boardPreview, preview);
  const cleared = appReducer(withPreview, { type: "set_board_preview", preview: null });
  assert.equal(cleared.boardPreview, null);
});

// ── Immutability ───────────────────────────────────────────────────────────────

test("appReducer — always returns new state object", () => {
  const next = appReducer(s, { type: "set_locale", locale: "fr" });
  assert.notEqual(next, s);
});

test("appReducer — unknown action returns state unchanged", () => {
  const next = appReducer(s, { type: "unknown_action" } as unknown as Parameters<typeof appReducer>[1]);
  assert.equal(next, s);
});
