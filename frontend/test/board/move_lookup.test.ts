import test from "node:test";
import assert from "node:assert/strict";
import { createMoveLookupCapabilities } from "../../src/board/move_lookup.js";
import type { MovePositionIndex, MovePositionRecord } from "../../src/board/move_position.js";
import type { GameSessionState } from "../../src/features/sessions/services/game_session_state.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeRecord = (overrides: Partial<MovePositionRecord> = {}): MovePositionRecord => ({
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  lastMove: ["e2", "e4"],
  mainlinePly: 1,
  parentMoveId: null,
  variationFirstMoveIds: [],
  ...overrides,
});

const makeSession = (cache: MovePositionIndex = {}): GameSessionState => ({
  pgnModel: null,
  pgnText: "",
  moves: [],
  verboseMoves: [],
  movePositionById: cache,
  pgnLayoutMode: "plain",
  currentPly: 0,
  selectedMoveId: null,
  boardPreview: null,
  pendingFocusCommentId: null,
  undoStack: [],
  redoStack: [],
});

// ── Tests ──────────────────────────────────────────────────────────────────────

test("getMovePositionById — null moveId returns null", () => {
  const sessionRef = { current: makeSession() };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => ({}),
    resolveMovePositionByIdFn: () => null,
  });
  assert.equal(getMovePositionById(null), null);
});

test("getMovePositionById — returns cached record without calling build", () => {
  let buildCalled = 0;
  const record = makeRecord();
  const sessionRef = { current: makeSession({ "move_1": record }) };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => { buildCalled++; return {}; },
    resolveMovePositionByIdFn: () => null,
  });
  const result = getMovePositionById("move_1");
  assert.deepEqual(result, record);
  assert.equal(buildCalled, 0);
});

test("getMovePositionById — rebuilds cache on cache miss", () => {
  let buildCalled = 0;
  const record = makeRecord();
  const sessionRef = { current: makeSession() };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => { buildCalled++; return { "move_1": record }; },
    resolveMovePositionByIdFn: () => null,
  });
  const result = getMovePositionById("move_1");
  assert.deepEqual(result, record);
  assert.equal(buildCalled, 1);
});

test("getMovePositionById — returns null when not in cache and build doesn't find it", () => {
  const sessionRef = { current: makeSession() };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => ({}),
    resolveMovePositionByIdFn: () => null,
  });
  assert.equal(getMovePositionById("missing"), null);
});

test("getMovePositionById — allowResolve=true uses resolveMovePositionByIdFn on miss", () => {
  const resolved = {
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    lastMove: ["e2", "e4"] as [string, string],
    mainlinePly: 1,
    parentMoveId: null,
  };
  const sessionRef = { current: makeSession() };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => ({}),
    resolveMovePositionByIdFn: (_model, moveId) => moveId === "move_99" ? resolved : null,
  });
  const result = getMovePositionById("move_99", { allowResolve: true });
  assert.ok(result !== null);
  assert.equal(result!.fen, resolved.fen);
  // Resolved record is normalized with extra fields
  assert.deepEqual((result as MovePositionRecord).variationFirstMoveIds, []);
});

test("getMovePositionById — allowResolve=false does not call resolve", () => {
  let resolveCalled = 0;
  const sessionRef = { current: makeSession() };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => ({}),
    resolveMovePositionByIdFn: () => { resolveCalled++; return null; },
  });
  getMovePositionById("move_99", { allowResolve: false });
  assert.equal(resolveCalled, 0);
});

test("getMovePositionById — caches resolved record for subsequent calls", () => {
  let resolveCalled = 0;
  const resolved = {
    fen: "test-fen",
    lastMove: null,
    mainlinePly: null,
    parentMoveId: null,
  };
  const sessionRef = { current: makeSession() };
  const { getMovePositionById } = createMoveLookupCapabilities({
    sessionRef,
    buildMovePositionByIdFn: () => ({}),
    resolveMovePositionByIdFn: () => { resolveCalled++; return resolved; },
  });
  getMovePositionById("move_99", { allowResolve: true });
  getMovePositionById("move_99", { allowResolve: true });
  // Second call hits cache; resolve only called once
  assert.equal(resolveCalled, 1);
});
