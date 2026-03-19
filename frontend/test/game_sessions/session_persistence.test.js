import test from "node:test";
import assert from "node:assert/strict";
import { createSessionPersistenceService } from "../../src/game_sessions/session_persistence.js";

test("persistence routes save through active session sourceRef", async () => {
  const state = {
    isHydratingGame: false,
    saveRequestSeq: 0,
    autosaveTimer: null,
    defaultSaveMode: "auto",
  };
  const session = {
    sessionId: "session-1",
    sourceRef: { kind: "file", locator: "root", recordId: "game1.pgn" },
    revisionToken: "rev-1",
    saveMode: "auto",
    dirtyState: "clean",
  };
  const calls = [];
  const service = createSessionPersistenceService({
    state,
    t: (_key, fallback) => fallback,
    getActiveSession: () => session,
    updateActiveSessionMeta: (patch) => Object.assign(session, patch),
    getPgnText: () => "1. e4 e5 *",
    saveBySourceRef: async (sourceRef, pgnText, revisionToken) => {
      calls.push({ sourceRef, pgnText, revisionToken });
      return { revisionToken: "rev-2" };
    },
    onSetSaveStatus: () => {},
    autosaveDebounceMs: 10,
  });

  const saved = await service.persistActiveSessionNow();

  assert.equal(saved, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceRef.recordId, "game1.pgn");
  assert.equal(calls[0].pgnText, "1. e4 e5 *");
  assert.equal(session.revisionToken, "rev-2");
  assert.equal(session.dirtyState, "clean");
});

test("autosave is skipped when active session is manual mode", async () => {
  const state = {
    isHydratingGame: false,
    saveRequestSeq: 0,
    autosaveTimer: null,
    defaultSaveMode: "auto",
  };
  const session = {
    sessionId: "session-1",
    sourceRef: { kind: "file", locator: "root", recordId: "game1.pgn" },
    revisionToken: "rev-1",
    saveMode: "manual",
    dirtyState: "clean",
  };
  let called = false;
  const service = createSessionPersistenceService({
    state,
    t: (_key, fallback) => fallback,
    getActiveSession: () => session,
    updateActiveSessionMeta: (patch) => Object.assign(session, patch),
    getPgnText: () => "1. d4 d5 *",
    saveBySourceRef: async () => {
      called = true;
      return { revisionToken: "rev-2" };
    },
    onSetSaveStatus: () => {},
    autosaveDebounceMs: 10,
  });

  service.scheduleAutosaveForActiveSession();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(called, false);
  assert.equal(session.dirtyState, "clean");
});

