import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../src/pgn_model.js";
import { serializeModelToPgn } from "../src/pgn_serialize.js";

/** Round-trip helper: parse then serialize and return the move-text portion. */
const roundTrip = (pgn: string): string => serializeModelToPgn(parsePgnToModel(pgn));

// ── Basic serialization ────────────────────────────────────────────────────────

test("serializeModelToPgn — empty model serializes to empty string", () => {
  const model = parsePgnToModel("");
  assert.equal(serializeModelToPgn(model), "");
});

test("serializeModelToPgn — simple mainline round-trips moves", () => {
  const result = roundTrip("1. e4 e5 2. Nf3 Nc6");
  assert.ok(result.includes("e4"), result);
  assert.ok(result.includes("e5"), result);
  assert.ok(result.includes("Nf3"), result);
  assert.ok(result.includes("Nc6"), result);
});

test("serializeModelToPgn — includes headers before move text", () => {
  const pgn = `[White "Magnus"]\n[Black "Hikaru"]\n\n1. e4 e5`;
  const result = roundTrip(pgn);
  assert.ok(result.startsWith('[White "Magnus"]'), result);
  assert.ok(result.includes('[Black "Hikaru"]'), result);
  assert.ok(result.includes("e4"), result);
});

test("serializeModelToPgn — round-trips a comment after a move", () => {
  const result = roundTrip("1. e4 {good move} e5");
  assert.ok(result.includes("{good move}"), result);
});

test("serializeModelToPgn — round-trips a variation", () => {
  const result = roundTrip("1. e4 (1. d4 d5) e5");
  assert.ok(result.includes("("), result);
  assert.ok(result.includes("d4"), result);
  assert.ok(result.includes("d5"), result);
});

test("serializeModelToPgn — round-trips NAGs", () => {
  const result = roundTrip("1. e4 $1 e5 $2");
  assert.ok(result.includes("$1"), result);
  assert.ok(result.includes("$2"), result);
});

test("serializeModelToPgn — round-trips result token", () => {
  const result = roundTrip("1. e4 e5 1-0");
  assert.ok(result.includes("1-0"), result);
});

test("serializeModelToPgn — no-headers model omits header section", () => {
  const result = roundTrip("1. e4 e5");
  assert.ok(!result.includes("["), result);
});

test("serializeModelToPgn — headers separated from move text by blank line", () => {
  const pgn = `[Event "Test"]\n\n1. e4 e5`;
  const result = roundTrip(pgn);
  // Header and move text must be separated by a blank line
  assert.ok(result.includes('[Event "Test"]\n\n'), result);
  assert.ok(result.includes("e4"), result);
});

test("serializeModelToPgn — escape sequences in comments survive round-trip", () => {
  const pgn = String.raw`1. e4 {line1\nline2}`;
  const result = roundTrip(pgn);
  assert.ok(result.includes(String.raw`{line1\nline2}`), result);
});
