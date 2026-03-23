import test from "node:test";
import assert from "node:assert/strict";
import {
  createTranscript,
  addPlyRecord,
  addAnnotation,
  completeTranscript,
  abortTranscript,
} from "../../src/training/domain/training_transcript.js";
import type {
  PlyRecord,
  TrainingAnnotation,
} from "../../src/training/domain/training_transcript.js";
import type { TrainingConfig } from "../../src/training/domain/training_protocol.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeConfig = (): TrainingConfig => ({
  sourceGameRef: "game:abc123",
  pgnText: "[Event \"?\"]\n\n1. e4 e5 *",
  protocol: "replay",
  protocolOptions: { side: "white" },
});

const makePlyRecord = (ply = 0): PlyRecord => ({
  ply,
  sourceMoveUci: "e2e4",
  sourceMoveSan: "e4",
  userMoveUci: "e2e4",
  userMoveSan: "e4",
  outcome: "correct",
  attemptsCount: 1,
  timeTakenMs: 800,
});

const makeAnnotation = (ply = 0): TrainingAnnotation => ({
  ply,
  kind: "comment",
  content: "Good move",
  source: "user",
});

// ── createTranscript ──────────────────────────────────────────────────────────

test("createTranscript — creates empty transcript", () => {
  const t = createTranscript(makeConfig());
  assert.equal(t.protocol, "replay");
  assert.equal(t.sourceGameRef, "game:abc123");
  assert.equal(t.aborted, false);
  assert.equal(t.plyRecords.length, 0);
  assert.equal(t.annotations.length, 0);
  assert.ok(t.sessionId.length > 0);
  assert.ok(t.startedAt.length > 0);
  assert.equal(t.completedAt, undefined);
});

test("createTranscript — sessionId is unique across calls", () => {
  const t1 = createTranscript(makeConfig());
  const t2 = createTranscript(makeConfig());
  assert.notEqual(t1.sessionId, t2.sessionId);
});

test("createTranscript — copies protocolOptions into config", () => {
  const t = createTranscript(makeConfig());
  assert.deepEqual(t.config, { side: "white" });
});

// ── addPlyRecord ──────────────────────────────────────────────────────────────

test("addPlyRecord — appends record to empty transcript", () => {
  const t = createTranscript(makeConfig());
  const updated = addPlyRecord(t, makePlyRecord(0));
  assert.equal(updated.plyRecords.length, 1);
  assert.equal(updated.plyRecords[0]!.ply, 0);
});

test("addPlyRecord — does not mutate original transcript", () => {
  const t = createTranscript(makeConfig());
  addPlyRecord(t, makePlyRecord(0));
  assert.equal(t.plyRecords.length, 0);
});

test("addPlyRecord — appends multiple records in order", () => {
  let t = createTranscript(makeConfig());
  t = addPlyRecord(t, makePlyRecord(0));
  t = addPlyRecord(t, makePlyRecord(1));
  t = addPlyRecord(t, makePlyRecord(2));
  assert.equal(t.plyRecords.length, 3);
  assert.equal(t.plyRecords[2]!.ply, 2);
});

// ── addAnnotation ─────────────────────────────────────────────────────────────

test("addAnnotation — appends annotation", () => {
  const t = createTranscript(makeConfig());
  const updated = addAnnotation(t, makeAnnotation(0));
  assert.equal(updated.annotations.length, 1);
  assert.equal(updated.annotations[0]!.content, "Good move");
});

test("addAnnotation — does not mutate original", () => {
  const t = createTranscript(makeConfig());
  addAnnotation(t, makeAnnotation(0));
  assert.equal(t.annotations.length, 0);
});

// ── completeTranscript ────────────────────────────────────────────────────────

test("completeTranscript — sets completedAt", () => {
  const t = createTranscript(makeConfig());
  const completed = completeTranscript(t);
  assert.ok(typeof completed.completedAt === "string");
  assert.ok(completed.completedAt.length > 0);
});

test("completeTranscript — does not set aborted", () => {
  const t = createTranscript(makeConfig());
  const completed = completeTranscript(t);
  assert.equal(completed.aborted, false);
});

test("completeTranscript — does not mutate original", () => {
  const t = createTranscript(makeConfig());
  completeTranscript(t);
  assert.equal(t.completedAt, undefined);
});

// ── abortTranscript ───────────────────────────────────────────────────────────

test("abortTranscript — sets aborted to true", () => {
  const t = createTranscript(makeConfig());
  const aborted = abortTranscript(t);
  assert.equal(aborted.aborted, true);
});

test("abortTranscript — sets completedAt", () => {
  const t = createTranscript(makeConfig());
  const aborted = abortTranscript(t);
  assert.ok(typeof aborted.completedAt === "string");
});

test("abortTranscript — does not mutate original", () => {
  const t = createTranscript(makeConfig());
  abortTranscript(t);
  assert.equal(t.aborted, false);
});
