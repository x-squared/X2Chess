import test from "node:test";
import assert from "node:assert/strict";
import { createGameSessionStore } from "../../src/features/sessions/services/session_store.js";
import { createEmptyGameSessionState } from "../../src/features/sessions/services/game_session_state.js";
import type { ActiveSessionRef } from "../../src/features/sessions/services/game_session_state.js";

test("session store switches sessions without losing active state", () => {
  const activeSessionRef: ActiveSessionRef = { current: createEmptyGameSessionState() };
  const store = createGameSessionStore({ activeSessionRef });

  const stateA = createEmptyGameSessionState();
  stateA.pgnText = "gameA";
  const first = store.openSession({ ownState: stateA, title: "A",
    sourceRef: { kind: "file", locator: "root", recordId: "a.pgn" } });

  stateA.pgnText = "gameA-edited";

  const stateB = createEmptyGameSessionState();
  stateB.pgnText = "gameB";
  const second = store.openSession({ ownState: stateB, title: "B",
    sourceRef: { kind: "file", locator: "root", recordId: "b.pgn" } });

  assert.equal(store.listSessions().length, 2);
  assert.equal(store.getActiveSessionId(), second.sessionId);
  // stateA is still the live object for session A — edits are in-place.
  assert.equal(stateA.pgnText, "gameA-edited");

  const switched = store.switchToSession(first.sessionId);
  assert.equal(switched, true);
  assert.equal(store.getActiveSessionId(), first.sessionId);
  // After switching, the ref points at stateA.
  assert.equal(activeSessionRef.current.pgnText, "gameA-edited");
});

test("closing session selects adjacent session and updates ref", () => {
  const activeSessionRef: ActiveSessionRef = { current: createEmptyGameSessionState() };
  const store = createGameSessionStore({ activeSessionRef });

  const stateA = createEmptyGameSessionState();
  stateA.pgnText = "A";
  const s1 = store.openSession({ ownState: stateA, title: "A" });

  const stateB = createEmptyGameSessionState();
  stateB.pgnText = "B";
  const s2 = store.openSession({ ownState: stateB, title: "B" });

  const result = store.closeSession(s2.sessionId);

  assert.equal(result.closed, true);
  assert.equal(result.emptyAfterClose, false);
  assert.equal(store.getActiveSessionId(), s1.sessionId);
  // After closing B, the ref must point at A's state.
  assert.equal(activeSessionRef.current.pgnText, "A");
});

test("updateActiveSessionMeta patches dirtyState and title", () => {
  const activeSessionRef: ActiveSessionRef = { current: createEmptyGameSessionState() };
  const store = createGameSessionStore({ activeSessionRef });

  const state = createEmptyGameSessionState();
  store.openSession({ ownState: state, title: "Original" });

  store.updateActiveSessionMeta({ dirtyState: "dirty" });
  const afterDirty = store.getActiveSession();
  assert.equal(afterDirty?.dirtyState, "dirty", "dirtyState patched to dirty");
  assert.equal(afterDirty?.title, "Original", "title unchanged when not in patch");

  store.updateActiveSessionMeta({ title: "Renamed", dirtyState: "clean" });
  const afterRename = store.getActiveSession();
  assert.equal(afterRename?.title, "Renamed", "title updated");
  assert.equal(afterRename?.dirtyState, "clean", "dirtyState patched to clean");
});

test("updateActiveSessionMeta transitions dirty → saving → clean", () => {
  const activeSessionRef: ActiveSessionRef = { current: createEmptyGameSessionState() };
  const store = createGameSessionStore({ activeSessionRef });

  store.openSession({ ownState: createEmptyGameSessionState(), title: "Game" });

  store.updateActiveSessionMeta({ dirtyState: "dirty" });
  assert.equal(store.getActiveSession()?.dirtyState, "dirty");

  store.updateActiveSessionMeta({ dirtyState: "saving" });
  assert.equal(store.getActiveSession()?.dirtyState, "saving");

  store.updateActiveSessionMeta({ dirtyState: "clean" });
  assert.equal(store.getActiveSession()?.dirtyState, "clean");
});

test("buildSessionSnapshots captures pgnText and sourceRef", () => {
  const activeSessionRef: ActiveSessionRef = { current: createEmptyGameSessionState() };
  const store = createGameSessionStore({ activeSessionRef });

  const state = createEmptyGameSessionState();
  state.pgnText = "1. e4 *";
  state.currentPly = 2;
  store.openSession({
    ownState: state,
    title: "Snapshot test",
    sourceRef: { kind: "file", locator: "/games/test.pgn" },
  });

  const snaps = store.buildSessionSnapshots();
  assert.equal(snaps.length, 1);
  assert.equal(snaps[0]?.pgnText, "1. e4 *");
  assert.equal(snaps[0]?.currentPly, 2);
  assert.equal(snaps[0]?.sourceRef?.kind, "file");
  assert.equal(snaps[0]?.sourceRef?.locator, "/games/test.pgn");
});

test("opening same sourceRef reuses existing session", () => {
  const activeSessionRef: ActiveSessionRef = { current: createEmptyGameSessionState() };
  const store = createGameSessionStore({ activeSessionRef });

  const stateA = createEmptyGameSessionState();
  stateA.pgnText = "Game A";
  const first = store.openSession({
    ownState: stateA,
    title: "A",
    sourceRef: { kind: "directory", locator: "/games", recordId: "Game-1.pgn" },
  });
  const stateB = createEmptyGameSessionState();
  stateB.pgnText = "Game B";
  const second = store.openSession({
    ownState: stateB,
    title: "B",
    sourceRef: { kind: "directory", locator: "/games", recordId: "Game-1.pgn" },
  });

  assert.equal(first.sessionId, second.sessionId);
  assert.equal(store.listSessions().length, 1);
  assert.equal(store.getActiveSessionId(), first.sessionId);
  assert.equal(activeSessionRef.current.pgnText, "Game A");
});
