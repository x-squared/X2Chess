import test from "node:test";
import assert from "node:assert/strict";
import { createGameSessionStore } from "../../src/game_sessions/session_store.js";

test("session store switches sessions without losing active snapshot", () => {
  const state = {
    gameSessions: [],
    activeSessionId: null,
    nextSessionSeq: 1,
  };
  let activeSnapshot = { pgnText: "initial" };
  const store = createGameSessionStore({
    state,
    captureActiveSessionSnapshot: () => ({ ...activeSnapshot }),
    applySessionSnapshotToState: (snapshot) => {
      activeSnapshot = { ...snapshot };
    },
    disposeSessionSnapshot: () => {},
  });

  const first = store.openSession({
    snapshot: { pgnText: "gameA" },
    title: "A",
    sourceRef: { kind: "file", locator: "root", recordId: "a.pgn" },
  });
  activeSnapshot.pgnText = "gameA-edited";
  const second = store.openSession({
    snapshot: { pgnText: "gameB" },
    title: "B",
    sourceRef: { kind: "file", locator: "root", recordId: "b.pgn" },
  });

  assert.equal(state.gameSessions.length, 2);
  assert.equal(state.activeSessionId, second.sessionId);
  assert.equal(state.gameSessions[0].snapshot.pgnText, "gameA-edited");

  const switched = store.switchToSession(first.sessionId);
  assert.equal(switched, true);
  assert.equal(state.activeSessionId, first.sessionId);
  assert.equal(activeSnapshot.pgnText, "gameA-edited");
});

test("closing session disposes snapshot and selects adjacent session", () => {
  const state = {
    gameSessions: [],
    activeSessionId: null,
    nextSessionSeq: 1,
  };
  const disposed = [];
  const store = createGameSessionStore({
    state,
    captureActiveSessionSnapshot: () => ({ pgnText: "runtime" }),
    applySessionSnapshotToState: () => {},
    disposeSessionSnapshot: (snapshot) => disposed.push(snapshot.pgnText),
  });

  const s1 = store.openSession({ snapshot: { pgnText: "A" }, title: "A" });
  const s2 = store.openSession({ snapshot: { pgnText: "B" }, title: "B" });
  const result = store.closeSession(s2.sessionId);

  assert.equal(result.closed, true);
  assert.equal(result.emptyAfterClose, false);
  assert.equal(disposed[0], "B");
  assert.equal(state.activeSessionId, s1.sessionId);
});

