import test from "node:test";
import assert from "node:assert/strict";
import { appReducer, initialAppStoreState } from "../../src/core/state/app_reducer.js";
import type { SessionItemState, ResourceTabSnapshot } from "../../src/core/state/app_reducer.js";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";

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

test("set_move_delay_ms — updates delay", () => {
  const next = appReducer(s, { type: "set_move_delay_ms", value: 500 });
  assert.equal(next.moveDelayMs, 500);
});

test("set_sound_enabled — disables sound", () => {
  const next = appReducer(s, { type: "set_sound_enabled", enabled: false });
  assert.equal(next.soundEnabled, false);
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

test("set_game_info_editor_open — opens and closes editor", () => {
  const opened = appReducer(s, { type: "set_game_info_editor_open", open: true });
  assert.equal(opened.isGameInfoEditorOpen, true);
});

// ── Board preview (direct component dispatch) ──────────────────────────────────

test("set_board_preview — sets and clears board preview", () => {
  const preview = { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2" };
  const withPreview = appReducer(s, { type: "set_board_preview", preview });
  assert.deepEqual(withPreview.boardPreview, preview);
  const cleared = appReducer(withPreview, { type: "set_board_preview", preview: null });
  assert.equal(cleared.boardPreview, null);
});

// ── Fine-grained session state actions ────────────────────────────────────────

const makeSessions = (): SessionItemState[] => [
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

const makeTabs = (): ResourceTabSnapshot[] => [
  { tabId: "tab1", title: "My Games", kind: "directory", locator: "/games" },
  { tabId: "tab2", title: "DB", kind: "db", locator: "main.db" },
];

test("set_pgn_state — updates PGN fields", () => {
  const pgnText = "1. e4 e5 2. Nf3";
  const next = appReducer(s, {
    type: "set_pgn_state",
    pgnText,
    pgnModel: parsePgnToModel(pgnText),
    moves: ["e4", "e5", "Nf3"],
    pgnTextLength: pgnText.length,
    moveCount: 3,
  });
  assert.equal(next.pgnText, pgnText);
  assert.equal(next.pgnTextLength, pgnText.length);
  assert.deepEqual(next.moves, ["e4", "e5", "Nf3"]);
  assert.equal(next.moveCount, 3);
});

test("set_pgn_state — null pgnModel resets model", () => {
  const next = appReducer(s, {
    type: "set_pgn_state",
    pgnText: "",
    pgnModel: null,
    moves: [],
    pgnTextLength: 0,
    moveCount: 0,
  });
  assert.equal(next.pgnModel, null);
  assert.equal(next.pgnText, "");
  assert.equal(next.moveCount, 0);
});

test("set_navigation — updates ply, selectedMoveId, and boardPreview", () => {
  const preview = { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" };
  const next = appReducer(s, {
    type: "set_navigation",
    currentPly: 2,
    selectedMoveId: "move_2",
    boardPreview: preview,
  });
  assert.equal(next.currentPly, 2);
  assert.equal(next.selectedMoveId, "move_2");
  assert.deepEqual(next.boardPreview, preview);
});

test("set_navigation — null boardPreview clears preview", () => {
  const next = appReducer(s, {
    type: "set_navigation",
    currentPly: 0,
    selectedMoveId: null,
    boardPreview: null,
  });
  assert.equal(next.boardPreview, null);
});

test("set_undo_redo_depth — updates undo and redo depths", () => {
  const next = appReducer(s, { type: "set_undo_redo_depth", undoDepth: 5, redoDepth: 2 });
  assert.equal(next.undoDepth, 5);
  assert.equal(next.redoDepth, 2);
});

test("set_status_message — updates status message", () => {
  const next = appReducer(s, { type: "set_status_message", message: "Saved" });
  assert.equal(next.statusMessage, "Saved");
});

test("set_pending_focus — sets and clears pending focus comment id", () => {
  const withFocus = appReducer(s, { type: "set_pending_focus", commentId: "c1" });
  assert.equal(withFocus.pendingFocusCommentId, "c1");
  const cleared = appReducer(withFocus, { type: "set_pending_focus", commentId: null });
  assert.equal(cleared.pendingFocusCommentId, null);
});

test("set_sessions — updates sessions, count, titles, and activeSessionId", () => {
  const next = appReducer(s, {
    type: "set_sessions",
    sessions: makeSessions(),
    activeSessionId: "s1",
  });
  assert.equal(next.sessionCount, 2);
  assert.deepEqual(next.sessionTitles, ["Game 1", "Game 2"]);
  assert.equal(next.activeSessionId, "s1");
});

test("set_resource_viewer — updates all resource tab fields from active tab", () => {
  const next = appReducer(s, {
    type: "set_resource_viewer",
    resourceTabs: makeTabs(),
    activeResourceTabId: "tab1",
    activeResourceRowCount: 42,
    activeResourceErrorMessage: "",
    activeSourceKind: "directory",
  });
  assert.equal(next.resourceTabCount, 2);
  assert.equal(next.activeResourceTabId, "tab1");
  assert.equal(next.activeResourceTabTitle, "My Games");
  assert.equal(next.activeResourceTabKind, "directory");
  assert.equal(next.activeResourceTabLocator, "/games");
  assert.equal(next.activeResourceRowCount, 42);
  assert.equal(next.activeSourceKind, "directory");
});

test("set_resource_viewer — active tab not found clears title/kind/locator", () => {
  const next = appReducer(s, {
    type: "set_resource_viewer",
    resourceTabs: makeTabs(),
    activeResourceTabId: "no-match",
    activeResourceRowCount: 0,
    activeResourceErrorMessage: "",
    activeSourceKind: "directory",
  });
  assert.equal(next.activeResourceTabTitle, "");
  assert.equal(next.activeResourceTabKind, "");
  assert.equal(next.activeResourceTabLocator, "");
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
