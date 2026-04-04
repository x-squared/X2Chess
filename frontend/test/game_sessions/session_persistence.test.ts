import test from "node:test";
import assert from "node:assert/strict";
import { createSessionPersistenceService } from "../../src/game_sessions/session_persistence.js";

test("persistence routes save through active session sourceRef", async () => {
  const session = {
    sessionId: "session-1",
    sourceRef: { kind: "file", locator: "root", recordId: "game1.pgn" },
    revisionToken: "rev-1",
    saveMode: "auto",
    dirtyState: "clean",
  };
  const calls: unknown[] = [];
  const service = createSessionPersistenceService({
    t: (_key, fallback) => fallback ?? "",
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

  await service.persistActiveSessionNow();

  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { sourceRef: { recordId: string } }).sourceRef.recordId, "game1.pgn");
  assert.equal((calls[0] as { pgnText: string }).pgnText, "1. e4 e5 *");
  assert.equal(session.revisionToken, "rev-2");
  assert.equal(session.dirtyState, "clean");
});

test("autosave is skipped when active session is manual mode", async () => {
  const session = {
    sessionId: "session-1",
    sourceRef: { kind: "file", locator: "root", recordId: "game1.pgn" },
    revisionToken: "rev-1",
    saveMode: "manual",
    dirtyState: "clean",
  };
  let called = false;
  const service = createSessionPersistenceService({
    t: (_key, fallback) => fallback ?? "",
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

test("missing source is created on first persist for unsaved session", async () => {
  const session = {
    sessionId: "session-1",
    sourceRef: null as { kind: string; locator: string; recordId: string } | null,
    pendingResourceRef: { kind: "file", locator: "/tmp/games" },
    revisionToken: "",
    saveMode: "auto",
    dirtyState: "dirty",
    title: "New game",
  };
  const saveCalls: unknown[] = [];
  const ensureCalls: unknown[] = [];
  const service = createSessionPersistenceService({
    t: (_key, fallback) => fallback ?? "",
    getActiveSession: () => session,
    updateActiveSessionMeta: (patch) => Object.assign(session, patch),
    getPgnText: () => "1. e4 *",
    saveBySourceRef: async (sourceRef, pgnText, revisionToken) => {
      saveCalls.push({ sourceRef, pgnText, revisionToken });
      return { revisionToken: "rev-created-2" };
    },
    ensureSourceForActiveSession: async (activeSession, pgnText) => {
      ensureCalls.push({ activeSession, pgnText });
      return {
        sourceRef: { kind: "file", locator: "/tmp/games", recordId: "new-game.pgn" },
        revisionToken: "rev-created-1",
      };
    },
    onSetSaveStatus: () => {},
    autosaveDebounceMs: 10,
  });

  await service.persistActiveSessionNow();

  assert.equal(ensureCalls.length, 1);
  assert.equal(saveCalls.length, 1);
  assert.equal((saveCalls[0] as { sourceRef: { recordId: string } }).sourceRef.recordId, "new-game.pgn");
  assert.equal((saveCalls[0] as { revisionToken: string }).revisionToken, "rev-created-1");
  assert.deepEqual(session.sourceRef, { kind: "file", locator: "/tmp/games", recordId: "new-game.pgn" });
  assert.equal(session.pendingResourceRef, null);
  assert.equal(session.revisionToken, "rev-created-2");
  assert.equal(session.dirtyState, "clean");
});
