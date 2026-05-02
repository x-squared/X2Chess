import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyGameSessionState } from "../../src/features/sessions/services/game_session_state.js";
import {
  dispatchNavigationState,
  dispatchSessionStateSnapshot,
  resolveSelectedMoveIdForSync,
} from "../../src/hooks/session_state_sync.js";
import type { AppAction } from "../../src/core/state/actions.js";

test("resolveSelectedMoveIdForSync returns mainline move id at current ply", (): void => {
  const session = createEmptyGameSessionState();
  session.currentPly = 2;
  session.selectedMoveId = "fallback";
  session.movePositionById = {
    m1: {
      fen: "fen1",
      lastMove: ["e2", "e4"],
      mainlinePly: 1,
      parentMoveId: null,
      variationFirstMoveIds: [],
    },
    m2: {
      fen: "fen2",
      lastMove: ["e7", "e5"],
      mainlinePly: 2,
      parentMoveId: null,
      variationFirstMoveIds: [],
    },
  };

  const resolved: string | null = resolveSelectedMoveIdForSync(session);
  assert.equal(resolved, "m2");
});

test("resolveSelectedMoveIdForSync keeps explicit selected move during board preview", (): void => {
  const session = createEmptyGameSessionState();
  session.currentPly = 1;
  session.selectedMoveId = "variationA";
  session.boardPreview = { fen: "8/8/8/8/8/8/8/8 w - - 0 1", lastMove: null };

  const resolved: string | null = resolveSelectedMoveIdForSync(session);
  assert.equal(resolved, "variationA");
});

test("resolveSelectedMoveIdForSync ignores malformed index entries without throwing", (): void => {
  const resolved: string | null = resolveSelectedMoveIdForSync({
    currentPly: 3,
    selectedMoveId: "fallbackMove",
    boardPreview: null,
    movePositionById: {
      bad: undefined as unknown as { mainlinePly?: unknown },
      alsoBad: null as unknown as { mainlinePly?: unknown },
      good: { mainlinePly: 3 },
    },
  });
  assert.equal(resolved, "good");
});

test("dispatchSessionStateSnapshot emits the full canonical action set", (): void => {
  const session = createEmptyGameSessionState();
  session.pgnText = "1. e4 e5";
  session.moves = ["e4", "e5"];
  session.currentPly = 2;
  session.pendingFocusCommentId = "c_1";
  session.undoStack = [{ tag: "u1" }];
  session.redoStack = [{ tag: "r1" }, { tag: "r2" }];
  session.movePositionById = {
    m2: {
      fen: "fen2",
      lastMove: ["e7", "e5"],
      mainlinePly: 2,
      parentMoveId: null,
      variationFirstMoveIds: [],
    },
  };
  const actions: AppAction[] = [];

  dispatchSessionStateSnapshot(session, (action: AppAction): void => {
    actions.push(action);
  });

  assert.equal(actions.length, 5);
  assert.deepEqual(actions.map((a: AppAction): string => a.type), [
    "set_pgn_state",
    "set_navigation",
    "set_undo_redo_depth",
    "set_pending_focus",
    "set_layout_mode",
  ]);

  const navigationAction = actions[1];
  assert.equal(navigationAction.type, "set_navigation");
  if (navigationAction.type === "set_navigation") {
    assert.equal(navigationAction.currentPly, 2);
    assert.equal(navigationAction.selectedMoveId, "m2");
    assert.equal(navigationAction.boardPreview, null);
  }
});

test("dispatchNavigationState emits only resolved navigation action", (): void => {
  const actions: AppAction[] = [];
  dispatchNavigationState(
    {
      currentPly: 1,
      selectedMoveId: "fallback",
      boardPreview: null,
      movePositionById: {
        m1: { mainlinePly: 1 },
      },
    },
    (action: AppAction): void => {
      actions.push(action);
    },
  );

  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "set_navigation");
  if (actions[0].type === "set_navigation") {
    assert.equal(actions[0].currentPly, 1);
    assert.equal(actions[0].selectedMoveId, "m1");
    assert.equal(actions[0].boardPreview, null);
  }
});
