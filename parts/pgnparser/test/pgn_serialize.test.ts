import test from "node:test";
import assert from "node:assert/strict";
import { roundTrip } from "./support/pgn_harness.js";

// ── Basic serialization ────────────────────────────────────────────────────────

test("serializeModelToPgn — empty model serializes to empty string", () => {
  const { serialized } = roundTrip("");
  assert.equal(serialized, "");
});

test("serializeModelToPgn — simple mainline round-trips moves", () => {
  const { serialized } = roundTrip("1. e4 e5 2. Nf3 Nc6");
  assert.equal(serialized, "1. e4 e5 2. Nf3 Nc6");
});

test("serializeModelToPgn — includes headers before move text", () => {
  const pgn = `[White "Magnus"]\n[Black "Hikaru"]\n\n1. e4 e5`;
  const { serialized } = roundTrip(pgn);
  assert.equal(serialized, `[White "Magnus"]\n[Black "Hikaru"]\n\n1. e4 e5`);
});

test("serializeModelToPgn — round-trips a comment after a move", () => {
  const { serialized } = roundTrip("1. e4 {good move} e5");
  assert.equal(serialized, "1. e4 {good move} e5");
});

test("serializeModelToPgn — round-trips a variation", () => {
  const { serialized } = roundTrip("1. e4 (1. d4 d5) e5");
  assert.equal(serialized, "1. e4 (1. d4 d5) e5");
});

test("serializeModelToPgn — round-trips NAGs", () => {
  const { serialized } = roundTrip("1. e4 $1 e5 $2");
  assert.equal(serialized, "1. e4 $1 e5 $2");
});

test("serializeModelToPgn — round-trips result token", () => {
  const { serialized } = roundTrip("1. e4 e5 1-0");
  assert.equal(serialized, "1. e4 e5 1-0");
});

test("serializeModelToPgn — no-headers model omits header section", () => {
  const { serialized } = roundTrip("1. e4 e5");
  assert.equal(serialized, "1. e4 e5");
});

test("serializeModelToPgn — headers separated from move text by blank line", () => {
  const pgn = `[Event "Test"]\n\n1. e4 e5`;
  const { serialized: result } = roundTrip(pgn);
  // Header and move text must be separated by a blank line
  assert.ok(result.includes('[Event "Test"]\n\n'), result);
  assert.ok(result.includes("e4"), result);
});

test("serializeModelToPgn — escape sequences in comments survive round-trip", () => {
  const pgn = String.raw`1. e4 {line1\nline2}`;
  const { serialized } = roundTrip(pgn);
  assert.equal(serialized, String.raw`1. e4 {line1\nline2}`);
});

test("serializeModelToPgn — commentsBefore are hoisted before move numbers exactly", () => {
  const pgn = "1. {prep} e4 e5";
  const { serialized } = roundTrip(pgn);
  assert.equal(serialized, "{prep} 1. e4 e5");
});

test("serializeModelToPgn — indentation directives preserve prefix and encoded body", () => {
  const pgn = String.raw`1. e4 {\i intro\nline} e5`;
  const { serialized } = roundTrip(pgn);
  assert.equal(serialized, String.raw`1. e4 {\i intro\nline} e5`);
});
