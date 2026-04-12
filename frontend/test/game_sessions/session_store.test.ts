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
