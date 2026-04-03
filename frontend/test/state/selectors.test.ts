import test from "node:test";
import assert from "node:assert/strict";
import { initialAppStoreState } from "../../src/state/app_reducer.js";
import type { AppStoreState } from "../../src/state/app_reducer.js";
import {
  selectLocale,
  selectDevToolsEnabled,
  selectDevDockOpen,
  selectIsMenuOpen,
  selectBoardFlipped,
  selectCurrentPly,
  selectMoveCount,
  selectSelectedMoveId,
  selectMoveDelayMs,
  selectSoundEnabled,
  selectStatusMessage,
  selectErrorMessage,
  selectLayoutMode,
  selectShowEvalPills,
  selectPgnText,
  selectPgnModel,
  selectMoves,
  selectPgnTextLength,
  selectPendingFocusCommentId,
  selectIsGameInfoEditorOpen,
  selectUndoDepth,
  selectRedoDepth,
  selectActiveSessionId,
  selectSessionCount,
  selectSessionTitles,
  selectSessions,
  selectResourceTabCount,
  selectActiveResourceTabId,
  selectActiveResourceTabTitle,
  selectActiveResourceTabKind,
  selectActiveResourceTabLocator,
  selectActiveResourceRowCount,
  selectActiveResourceErrorMessage,
  selectResourceViewerTabs,
  selectBoardPreview,
  selectAnnotationShapes,
} from "../../src/state/selectors.js";
import { parsePgnToModel } from "../../src/model/pgn_model.js";

const s = initialAppStoreState;

// ── Trivial selectors verify field passthrough ─────────────────────────────────

test("selectLocale — returns locale", () => {
  assert.equal(selectLocale(s), "en");
});

test("selectDevToolsEnabled — returns isDeveloperToolsEnabled", () => {
  assert.equal(selectDevToolsEnabled(s), s.isDeveloperToolsEnabled);
});

test("selectDevDockOpen — returns isDevDockOpen", () => {
  assert.equal(selectDevDockOpen(s), false);
});

test("selectIsMenuOpen — returns isMenuOpen", () => {
  assert.equal(selectIsMenuOpen(s), false);
});

test("selectBoardFlipped — returns boardFlipped", () => {
  assert.equal(selectBoardFlipped(s), false);
});

test("selectCurrentPly — returns currentPly", () => {
  assert.equal(selectCurrentPly(s), 0);
});

test("selectMoveCount — returns moveCount", () => {
  assert.equal(selectMoveCount(s), 0);
});

test("selectSelectedMoveId — returns null initially", () => {
  assert.equal(selectSelectedMoveId(s), null);
});

test("selectMoveDelayMs — returns moveDelayMs", () => {
  assert.equal(selectMoveDelayMs(s), 220);
});

test("selectSoundEnabled — returns soundEnabled", () => {
  assert.equal(selectSoundEnabled(s), true);
});

test("selectStatusMessage — returns empty string initially", () => {
  assert.equal(selectStatusMessage(s), "");
});

test("selectErrorMessage — returns empty string initially", () => {
  assert.equal(selectErrorMessage(s), "");
});

test("selectLayoutMode — returns pgnLayoutMode", () => {
  assert.equal(selectLayoutMode(s), "plain");
});

test("selectShowEvalPills — returns showEvalPills", () => {
  assert.equal(selectShowEvalPills(s), true);
});

test("selectPgnText — returns empty string initially", () => {
  assert.equal(selectPgnText(s), "");
});

test("selectPgnModel — returns null initially", () => {
  assert.equal(selectPgnModel(s), null);
});

test("selectMoves — returns empty array initially", () => {
  assert.deepEqual(selectMoves(s), []);
});

test("selectPgnTextLength — returns 0 initially", () => {
  assert.equal(selectPgnTextLength(s), 0);
});

test("selectPendingFocusCommentId — returns null initially", () => {
  assert.equal(selectPendingFocusCommentId(s), null);
});

test("selectIsGameInfoEditorOpen — returns false initially", () => {
  assert.equal(selectIsGameInfoEditorOpen(s), false);
});

test("selectUndoDepth — returns 0 initially", () => {
  assert.equal(selectUndoDepth(s), 0);
});

test("selectRedoDepth — returns 0 initially", () => {
  assert.equal(selectRedoDepth(s), 0);
});

test("selectActiveSessionId — returns null initially", () => {
  assert.equal(selectActiveSessionId(s), null);
});

test("selectSessionCount — returns 0 initially", () => {
  assert.equal(selectSessionCount(s), 0);
});

test("selectSessionTitles — returns empty array initially", () => {
  assert.deepEqual(selectSessionTitles(s), []);
});

test("selectSessions — returns empty array initially", () => {
  assert.deepEqual(selectSessions(s), []);
});

test("selectResourceTabCount — returns 0 initially", () => {
  assert.equal(selectResourceTabCount(s), 0);
});

test("selectActiveResourceTabId — returns null initially", () => {
  assert.equal(selectActiveResourceTabId(s), null);
});

test("selectActiveResourceTabTitle — returns empty string initially", () => {
  assert.equal(selectActiveResourceTabTitle(s), "");
});

test("selectActiveResourceTabKind — returns empty string initially", () => {
  assert.equal(selectActiveResourceTabKind(s), "");
});

test("selectActiveResourceTabLocator — returns empty string initially", () => {
  assert.equal(selectActiveResourceTabLocator(s), "");
});

test("selectActiveResourceRowCount — returns 0 initially", () => {
  assert.equal(selectActiveResourceRowCount(s), 0);
});

test("selectActiveResourceErrorMessage — returns empty string initially", () => {
  assert.equal(selectActiveResourceErrorMessage(s), "");
});

test("selectResourceViewerTabs — returns empty array initially", () => {
  assert.deepEqual(selectResourceViewerTabs(s), []);
});

test("selectBoardPreview — returns null initially", () => {
  assert.equal(selectBoardPreview(s), null);
});

// ── selectAnnotationShapes — derived selector ──────────────────────────────────

test("selectAnnotationShapes — returns empty array when no model", () => {
  assert.deepEqual(selectAnnotationShapes(s), []);
});

test("selectAnnotationShapes — returns empty array when no selected move", () => {
  const model = parsePgnToModel("1. e4 e5");
  const state: AppStoreState = { ...s, pgnModel: model, selectedMoveId: null };
  assert.deepEqual(selectAnnotationShapes(state), []);
});

test("selectAnnotationShapes — returns empty array when selected move has no shapes", () => {
  const model = parsePgnToModel("1. e4 {plain comment} e5");
  const e4Id = model.root.entries.find(e => e.type === "move")!.id;
  const state: AppStoreState = { ...s, pgnModel: model, selectedMoveId: e4Id };
  assert.deepEqual(selectAnnotationShapes(state), []);
});

test("selectAnnotationShapes — returns shapes from commentsAfter of selected move", () => {
  const model = parsePgnToModel("1. e4 {[%csl Ge4]} e5");
  const e4Id = model.root.entries.find(e => e.type === "move")!.id;
  const state: AppStoreState = { ...s, pgnModel: model, selectedMoveId: e4Id };
  const shapes = selectAnnotationShapes(state);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].kind, "highlight");
  assert.equal((shapes[0] as { kind: string; square: string }).square, "e4");
});

test("selectAnnotationShapes — unknown moveId returns empty array", () => {
  const model = parsePgnToModel("1. e4 e5");
  const state: AppStoreState = { ...s, pgnModel: model, selectedMoveId: "no-such-id" };
  assert.deepEqual(selectAnnotationShapes(state), []);
});
