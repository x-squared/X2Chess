import test from "node:test";
import assert from "node:assert/strict";
import { REPLAY_PROTOCOL } from "../../src/training/protocols/replay_protocol.js";
import { createTranscript, addPlyRecord } from "../../src/training/domain/training_transcript.js";
import type { TrainingConfig } from "../../src/training/domain/training_protocol.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeConfig = (overrides: Partial<TrainingConfig> = {}): TrainingConfig => ({
  sourceGameRef: "test:1",
  pgnText: "[Event \"?\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *",
  protocol: "replay",
  protocolOptions: { side: "white", startPly: 0, allowRetry: false, showOpponentMoves: true, opponentMoveDelayMs: 0, allowHints: false, maxHintsPerGame: 0 },
  ...overrides,
});

// ── initialize ─────────────────────────────────────────────────────────────────

test("REPLAY_PROTOCOL.initialize — phase is in_progress", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  assert.equal(state.phase, "in_progress");
});

test("REPLAY_PROTOCOL.initialize — ply starts at 0", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  assert.equal(state.position.ply, 0);
});

test("REPLAY_PROTOCOL.initialize — white has 3 user plies (e4, Nf3, Bb5)", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  assert.equal(state.position.totalUserPlies, 3);
});

test("REPLAY_PROTOCOL.initialize — black side has 2 user plies (e5, Nc6)", () => {
  const state = REPLAY_PROTOCOL.initialize(
    makeConfig({ protocolOptions: { side: "black", startPly: 0, allowRetry: false, showOpponentMoves: true, opponentMoveDelayMs: 0, allowHints: false, maxHintsPerGame: 0 } }),
  );
  assert.equal(state.position.totalUserPlies, 2);
});

test("REPLAY_PROTOCOL.initialize — both sides gives all 5 user plies", () => {
  const state = REPLAY_PROTOCOL.initialize(
    makeConfig({ protocolOptions: { side: "both", startPly: 0, allowRetry: false, showOpponentMoves: true, opponentMoveDelayMs: 0, allowHints: false, maxHintsPerGame: 0 } }),
  );
  assert.equal(state.position.totalUserPlies, 5);
});

// ── evaluateMove ──────────────────────────────────────────────────────────────

test("REPLAY_PROTOCOL.evaluateMove — correct mainline move returns accepted=true", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  // First move in 1. e4 e5 2. Nf3 Nc6 3. Bb5 is e2e4 for white
  const result = REPLAY_PROTOCOL.evaluateMove({ uci: "e2e4", san: "e4" }, state);
  assert.equal(result.accepted, true);
  assert.equal(result.feedback, "correct");
});

test("REPLAY_PROTOCOL.evaluateMove — wrong move returns accepted=false", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  const result = REPLAY_PROTOCOL.evaluateMove({ uci: "d2d4", san: "d4" }, state);
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "wrong");
});

test("REPLAY_PROTOCOL.evaluateMove — wrong move reveals correct move", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  const result = REPLAY_PROTOCOL.evaluateMove({ uci: "d2d4", san: "d4" }, state);
  assert.ok(result.correctMove !== undefined);
  assert.equal(result.correctMove?.uci, "e2e4");
});

// ── advance ───────────────────────────────────────────────────────────────────

test("REPLAY_PROTOCOL.advance — increments ply", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  const next = REPLAY_PROTOCOL.advance(state);
  assert.equal(next.currentSourcePly, 1);
  assert.equal(next.position.ply, 1);
});

test("REPLAY_PROTOCOL.advance — FEN changes after advancing", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  const next = REPLAY_PROTOCOL.advance(state);
  assert.notEqual(next.position.fen, state.position.fen);
});

// ── isComplete ────────────────────────────────────────────────────────────────

test("REPLAY_PROTOCOL.isComplete — false at start", () => {
  const state = REPLAY_PROTOCOL.initialize(makeConfig());
  assert.equal(REPLAY_PROTOCOL.isComplete(state), false);
});

test("REPLAY_PROTOCOL.isComplete — true after advancing past all moves", () => {
  let state = REPLAY_PROTOCOL.initialize(makeConfig());
  // The game has 5 plies: e4, e5, Nf3, Nc6, Bb5
  for (let i = 0; i < 5; i++) {
    state = REPLAY_PROTOCOL.advance(state);
  }
  assert.equal(REPLAY_PROTOCOL.isComplete(state), true);
});

// ── summarize ─────────────────────────────────────────────────────────────────

test("REPLAY_PROTOCOL.summarize — returns correct summary", () => {
  let state = REPLAY_PROTOCOL.initialize(makeConfig({ protocolOptions: { side: "both", startPly: 0, allowRetry: false, showOpponentMoves: true, opponentMoveDelayMs: 0, allowHints: false, maxHintsPerGame: 0 } }));
  let transcript = createTranscript({
    sourceGameRef: "test:1",
    pgnText: "[Event \"?\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *",
    protocol: "replay",
    protocolOptions: {},
  });

  state = { ...state, correctCount: 3, wrongCount: 1, skippedCount: 1 };
  // Transcript records must match state counts for consistent weighted scoring
  transcript = addPlyRecord(transcript, { ply: 0, sourceMoveUci: "e2e4", sourceMoveSan: "e4", outcome: "correct", attemptsCount: 1, timeTakenMs: 500 });
  transcript = addPlyRecord(transcript, { ply: 1, sourceMoveUci: "e7e5", sourceMoveSan: "e5", outcome: "correct", attemptsCount: 1, timeTakenMs: 400 });
  transcript = addPlyRecord(transcript, { ply: 2, sourceMoveUci: "g1f3", sourceMoveSan: "Nf3", outcome: "correct", attemptsCount: 1, timeTakenMs: 600 });
  transcript = addPlyRecord(transcript, { ply: 3, sourceMoveUci: "b8c6", sourceMoveSan: "Nc6", outcome: "wrong", attemptsCount: 2, timeTakenMs: 1200 });
  transcript = addPlyRecord(transcript, { ply: 4, sourceMoveUci: "f1b5", sourceMoveSan: "Bb5", outcome: "skip", attemptsCount: 0, timeTakenMs: 0 });

  const summary = REPLAY_PROTOCOL.summarize(state, transcript);
  assert.equal(summary.correct, 3);
  assert.equal(summary.wrong, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.total, 5);
  // Score: 3 correct out of 4 scored (1 skip excluded) = 75%
  assert.equal(summary.scorePercent, 75);
});
