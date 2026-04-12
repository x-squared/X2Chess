import test from "node:test";
import assert from "node:assert/strict";
import { createBoardNavigationCapabilities } from "../../src/board/navigation.js";
import type { MovePositionRecord } from "../../src/board/move_position.js";
import type { GameSessionState } from "../../src/game_sessions/game_session_state.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeSession = (overrides: Partial<GameSessionState> = {}): GameSessionState => ({
  pgnModel: null,
  pgnText: "",
  moves: [],
  verboseMoves: [],
  movePositionById: {},
  pgnLayoutMode: "plain",
  currentPly: 0,
  selectedMoveId: null,
  boardPreview: null,
  pendingFocusCommentId: null,
  undoStack: [],
  redoStack: [],
  ...overrides,
});

/** Minimal KeyboardEvent-like object */
const makeKey = (key: string, overrides: Partial<KeyboardEvent> = {}): KeyboardEvent => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  preventDefault: () => {},
  ...overrides,
} as unknown as KeyboardEvent);

const noop = async (): Promise<void> => {};

// ── gotoPly (no animation) ─────────────────────────────────────────────────────

test("gotoPly animate=false — advances ply directly", async () => {
  const session = makeSession({ moves: ["e4", "e5", "Nf3"], currentPly: 0 });
  const sessionRef = { current: session };
  let rendered = 0;
  const { gotoPly } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => { rendered++; },
  });
  await gotoPly(2, { animate: false });
  assert.equal(session.currentPly, 2);
  assert.equal(rendered, 1);
});

test("gotoPly animate=false — clamps to move count upper bound", async () => {
  const session = makeSession({ moves: ["e4", "e5"], currentPly: 0 });
  const sessionRef = { current: session };
  const { gotoPly } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  await gotoPly(999, { animate: false });
  assert.equal(session.currentPly, 2);
});

test("gotoPly animate=false — clamps to 0 lower bound", async () => {
  const session = makeSession({ moves: ["e4"], currentPly: 1 });
  const sessionRef = { current: session };
  const { gotoPly } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  await gotoPly(-5, { animate: false });
  assert.equal(session.currentPly, 0);
});

test("gotoPly animate=false — no-op when already at target", async () => {
  const session = makeSession({ moves: ["e4"], currentPly: 1 });
  const sessionRef = { current: session };
  let rendered = 0;
  const { gotoPly } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => { rendered++; },
  });
  await gotoPly(1, { animate: false });
  assert.equal(rendered, 0);
});

test("gotoPly animate=false — navigation callback error does not throw", async () => {
  const session = makeSession({ moves: ["e4", "e5", "Nf3"], currentPly: 0 });
  const sessionRef = { current: session };
  const { gotoPly } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {
      throw new Error("synthetic navigation failure");
    },
  });
  await assert.doesNotReject(async (): Promise<void> => {
    await gotoPly(2, { animate: false });
  });
  assert.equal(session.currentPly, 2);
});

test("gotoPly tolerates malformed session moves value", async () => {
  const session = makeSession({ currentPly: 0 });
  (session as unknown as { moves: unknown }).moves = undefined;
  const sessionRef = { current: session };
  const { gotoPly } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  await assert.doesNotReject(async (): Promise<void> => {
    await gotoPly(3, { animate: false });
  });
  assert.equal(session.currentPly, 0);
});

// ── gotoRelativeStep (variation context) ──────────────────────────────────────

test("gotoRelativeStep backward in variation — selects previousMoveId", async () => {
  const varRecord: MovePositionRecord = {
    fen: "test",
    lastMove: null,
    mainlinePly: null,
    parentMoveId: "move_0",
    variationFirstMoveIds: [],
    previousMoveId: "move_v0",
    nextMoveId: null,
  };
  const session = makeSession({ selectedMoveId: "move_v1", currentPly: 0 });
  const sessionRef = { current: session };
  let selectedId: string | null = null;
  const { gotoRelativeStep } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: (id) => id === "move_v1" ? varRecord : null,
    selectMoveById: (id) => { selectedId = id; return true; },
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  await gotoRelativeStep(-1);
  assert.equal(selectedId, "move_v0");
});

test("gotoRelativeStep backward in variation at start — selects parentMoveId", async () => {
  const varRecord: MovePositionRecord = {
    fen: "test",
    lastMove: null,
    mainlinePly: null,
    parentMoveId: "move_parent",
    variationFirstMoveIds: [],
    previousMoveId: null,
    nextMoveId: null,
  };
  const session = makeSession({ selectedMoveId: "move_v1", currentPly: 0 });
  const sessionRef = { current: session };
  let selectedId: string | null = null;
  const { gotoRelativeStep } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: (id) => id === "move_v1" ? varRecord : null,
    selectMoveById: (id) => { selectedId = id; return true; },
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  await gotoRelativeStep(-1);
  assert.equal(selectedId, "move_parent");
});

// ── handleSelectedMoveArrowHotkey ──────────────────────────────────────────────

test("handleSelectedMoveArrowHotkey — returns false when no selected move", () => {
  const session = makeSession({ selectedMoveId: null });
  const sessionRef = { current: session };
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  assert.equal(handleSelectedMoveArrowHotkey(makeKey("ArrowLeft")), false);
});

test("handleSelectedMoveArrowHotkey — returns false when no move position found", () => {
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => null,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  assert.equal(handleSelectedMoveArrowHotkey(makeKey("ArrowLeft")), false);
});

test("handleSelectedMoveArrowHotkey — returns false for non-arrow keys", () => {
  const mainRecord: MovePositionRecord = {
    fen: "test", lastMove: null, mainlinePly: 1, parentMoveId: null, variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => mainRecord,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  assert.equal(handleSelectedMoveArrowHotkey(makeKey("Enter")), false);
  assert.equal(handleSelectedMoveArrowHotkey(makeKey("Space")), false);
});

test("handleSelectedMoveArrowHotkey — returns false with modifier key", () => {
  const mainRecord: MovePositionRecord = {
    fen: "test", lastMove: null, mainlinePly: 1, parentMoveId: null, variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => mainRecord,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  assert.equal(handleSelectedMoveArrowHotkey(makeKey("ArrowLeft", { metaKey: true } as Partial<KeyboardEvent>)), false);
});

test("handleSelectedMoveArrowHotkey — ArrowDown selects first variation", () => {
  const moveRecord: MovePositionRecord = {
    fen: "test", lastMove: null, mainlinePly: 1, parentMoveId: null,
    variationFirstMoveIds: ["var_move_1"],
  };
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  let selectedId: string | null = null;
  let prevented = false;
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => moveRecord,
    selectMoveById: (id) => { selectedId = id; return true; },
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  const result = handleSelectedMoveArrowHotkey(makeKey("ArrowDown", {
    preventDefault: () => { prevented = true; },
  } as Partial<KeyboardEvent>));
  assert.equal(result, true);
  assert.equal(selectedId, "var_move_1");
  assert.equal(prevented, true);
});

test("handleSelectedMoveArrowHotkey — ArrowDown returns false when no variations", () => {
  const moveRecord: MovePositionRecord = {
    fen: "test", lastMove: null, mainlinePly: 1, parentMoveId: null, variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => moveRecord,
    selectMoveById: () => false,
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  assert.equal(handleSelectedMoveArrowHotkey(makeKey("ArrowDown")), false);
});

test("handleSelectedMoveArrowHotkey — Shift+Left focuses before-comment", () => {
  const moveRecord: MovePositionRecord = {
    fen: "test", lastMove: null, mainlinePly: 1, parentMoveId: null, variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  let focusedId: string | null = null;
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => moveRecord,
    selectMoveById: () => false,
    findCommentIdAroundMove: (_, pos) => pos === "before" ? "comment_before" : null,
    focusCommentById: (id) => { focusedId = id; return true; },
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  const result = handleSelectedMoveArrowHotkey(makeKey("ArrowLeft", {
    shiftKey: true,
    preventDefault: () => {},
  } as Partial<KeyboardEvent>));
  assert.equal(result, true);
  assert.equal(focusedId, "comment_before");
});

test("handleSelectedMoveArrowHotkey — Shift+Right focuses after-comment", () => {
  const moveRecord: MovePositionRecord = {
    fen: "test", lastMove: null, mainlinePly: 1, parentMoveId: null, variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "move_1" });
  const sessionRef = { current: session };
  let focusedId: string | null = null;
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: () => moveRecord,
    selectMoveById: () => false,
    findCommentIdAroundMove: (_, pos) => pos === "after" ? "comment_after" : null,
    focusCommentById: (id) => { focusedId = id; return true; },
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  const result = handleSelectedMoveArrowHotkey(makeKey("ArrowRight", {
    shiftKey: true,
    preventDefault: () => {},
  } as Partial<KeyboardEvent>));
  assert.equal(result, true);
  assert.equal(focusedId, "comment_after");
});

test("handleSelectedMoveArrowHotkey — ArrowLeft at variation start selects parentMoveId", () => {
  const varRecord: MovePositionRecord = {
    fen: "test",
    lastMove: null,
    mainlinePly: null,
    parentMoveId: "move_parent",
    isVariationStart: true,
    variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "var_move_1" });
  const sessionRef = { current: session };
  let selectedId: string | null = null;
  let prevented = false;
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: (id) => id === "var_move_1" ? varRecord : null,
    selectMoveById: (id) => { selectedId = id; return true; },
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  const result = handleSelectedMoveArrowHotkey(makeKey("ArrowLeft", {
    preventDefault: () => { prevented = true; },
  } as Partial<KeyboardEvent>));
  assert.equal(result, true);
  assert.equal(selectedId, "move_parent");
  assert.equal(prevented, true);
});

test("handleSelectedMoveArrowHotkey — Shift+Down navigates to next sibling variation", () => {
  const parentRecord: MovePositionRecord = {
    fen: "parent-fen",
    lastMove: null,
    mainlinePly: 1,
    parentMoveId: null,
    variationFirstMoveIds: ["var_a", "var_b", "var_c"],
  };
  const varRecord: MovePositionRecord = {
    fen: "var-fen",
    lastMove: null,
    mainlinePly: null,
    parentMoveId: "move_parent",
    isVariationStart: true,
    variationFirstMoveIds: [],
  };
  const session = makeSession({ selectedMoveId: "var_b" });
  const sessionRef = { current: session };
  let selectedId: string | null = null;
  const { handleSelectedMoveArrowHotkey } = createBoardNavigationCapabilities({
    sessionRef,
    getDelayMs: () => 0,
    getMovePositionById: (id) => {
      if (id === "var_b") return varRecord;
      if (id === "move_parent") return parentRecord;
      return null;
    },
    selectMoveById: (id) => { selectedId = id; return true; },
    findCommentIdAroundMove: () => null,
    focusCommentById: () => false,
    playMoveSound: noop,
    onNavigationChange: () => {},
  });
  const result = handleSelectedMoveArrowHotkey(makeKey("ArrowDown", {
    shiftKey: true,
    preventDefault: () => {},
  } as Partial<KeyboardEvent>));
  assert.equal(result, true);
  assert.equal(selectedId, "var_c");
});
