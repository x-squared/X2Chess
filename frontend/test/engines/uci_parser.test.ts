import test from "node:test";
import assert from "node:assert/strict";
import { parseUciLine } from "../../../engines/uci/uci_parser.js";

// ── identity / no-op lines ─────────────────────────────────────────────────

test("parseUciLine — empty line returns null", () => {
  assert.equal(parseUciLine(""), null);
});

test("parseUciLine — whitespace-only line returns null", () => {
  assert.equal(parseUciLine("   "), null);
});

test("parseUciLine — unknown command returns null", () => {
  assert.equal(parseUciLine("Stockfish 16 by T. Romstad"), null);
});

// ── uciok / readyok ────────────────────────────────────────────────────────

test("parseUciLine — uciok", () => {
  assert.deepEqual(parseUciLine("uciok"), { type: "uciok" });
});

test("parseUciLine — readyok", () => {
  assert.deepEqual(parseUciLine("readyok"), { type: "readyok" });
});

// ── id ─────────────────────────────────────────────────────────────────────

test("parseUciLine — id name", () => {
  const msg = parseUciLine("id name Stockfish 16");
  assert.deepEqual(msg, { type: "id", field: "name", value: "Stockfish 16" });
});

test("parseUciLine — id author", () => {
  const msg = parseUciLine("id author T. Romstad et al.");
  assert.deepEqual(msg, { type: "id", field: "author", value: "T. Romstad et al." });
});

// ── option ─────────────────────────────────────────────────────────────────

test("parseUciLine — option type check", () => {
  const msg = parseUciLine("option name Ponder type check default false");
  assert.deepEqual(msg, {
    type: "option",
    option: { type: "check", name: "Ponder", default: false },
  });
});

test("parseUciLine — option type spin", () => {
  const msg = parseUciLine("option name Hash type spin default 16 min 1 max 33554432");
  assert.deepEqual(msg, {
    type: "option",
    option: { type: "spin", name: "Hash", default: 16, min: 1, max: 33554432 },
  });
});

test("parseUciLine — option type button", () => {
  const msg = parseUciLine("option name Clear Hash type button");
  assert.deepEqual(msg, {
    type: "option",
    option: { type: "button", name: "Clear Hash" },
  });
});

test("parseUciLine — option type combo", () => {
  const msg = parseUciLine("option name UCI_EngineAbout type string default Stockfish");
  assert.notEqual(msg, null);
  assert.equal(msg?.type, "option");
});

// ── bestmove ───────────────────────────────────────────────────────────────

test("parseUciLine — bestmove without ponder", () => {
  const msg = parseUciLine("bestmove e2e4");
  assert.deepEqual(msg, { type: "bestmove", move: "e2e4", ponder: undefined });
});

test("parseUciLine — bestmove with ponder", () => {
  const msg = parseUciLine("bestmove e2e4 ponder e7e5");
  assert.deepEqual(msg, { type: "bestmove", move: "e2e4", ponder: "e7e5" });
});

test("parseUciLine — bestmove (none) returns null", () => {
  assert.equal(parseUciLine("bestmove (none)"), null);
});

// ── info ───────────────────────────────────────────────────────────────────

test("parseUciLine — info depth and cp score", () => {
  const msg = parseUciLine("info depth 10 seldepth 12 multipv 1 score cp 35 nodes 12345 nps 1234567 time 10 pv e2e4 e7e5");
  assert.notEqual(msg, null);
  assert.equal(msg?.type, "info");
  if (msg?.type !== "info") return;
  assert.equal(msg.depth, 10);
  assert.equal(msg.selDepth, 12);
  assert.deepEqual(msg.score, { type: "cp", value: 35 });
  assert.deepEqual(msg.pv, ["e2e4", "e7e5"]);
  assert.equal(msg.nodes, 12345);
});

test("parseUciLine — info mate score", () => {
  const msg = parseUciLine("info depth 5 score mate 3 pv d1h5 f7f6 h5e5");
  assert.notEqual(msg, null);
  if (msg?.type !== "info") {
    assert.fail("Expected info message");
    return;
  }
  assert.deepEqual(msg.score, { type: "mate", value: 3 });
});

test("parseUciLine — info without pv", () => {
  const msg = parseUciLine("info currmove e2e4 currmovenumber 1");
  assert.notEqual(msg, null);
  if (msg?.type !== "info") {
    assert.fail("Expected info message");
    return;
  }
  assert.equal(msg.currmove, "e2e4");
  assert.equal(msg.currmovenumber, 1);
  assert.equal(msg.pv, undefined);
});
