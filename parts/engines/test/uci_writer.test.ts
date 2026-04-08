import test from "node:test";
import assert from "node:assert/strict";
import { formatUciCommand } from "../src/uci/uci_writer.js";

test("formatUciCommand — uci", () => {
  assert.equal(formatUciCommand({ type: "uci" }), "uci");
});

test("formatUciCommand — isready", () => {
  assert.equal(formatUciCommand({ type: "isready" }), "isready");
});

test("formatUciCommand — ucinewgame", () => {
  assert.equal(formatUciCommand({ type: "ucinewgame" }), "ucinewgame");
});

test("formatUciCommand — stop", () => {
  assert.equal(formatUciCommand({ type: "stop" }), "stop");
});

test("formatUciCommand — quit", () => {
  assert.equal(formatUciCommand({ type: "quit" }), "quit");
});

test("formatUciCommand — ponderhit", () => {
  assert.equal(formatUciCommand({ type: "ponderhit" }), "ponderhit");
});

test("formatUciCommand — debug on", () => {
  assert.equal(formatUciCommand({ type: "debug", on: true }), "debug on");
});

test("formatUciCommand — debug off", () => {
  assert.equal(formatUciCommand({ type: "debug", on: false }), "debug off");
});

test("formatUciCommand — setoption without value", () => {
  assert.equal(
    formatUciCommand({ type: "setoption", name: "Clear Hash" }),
    "setoption name Clear Hash",
  );
});

test("formatUciCommand — setoption with value", () => {
  assert.equal(
    formatUciCommand({ type: "setoption", name: "Hash", value: "128" }),
    "setoption name Hash value 128",
  );
});

test("formatUciCommand — position startpos no moves", () => {
  assert.equal(
    formatUciCommand({ type: "position", startpos: true, moves: [] }),
    "position startpos",
  );
});

test("formatUciCommand — position startpos with moves", () => {
  assert.equal(
    formatUciCommand({ type: "position", startpos: true, moves: ["e2e4", "e7e5"] }),
    "position startpos moves e2e4 e7e5",
  );
});

test("formatUciCommand — position fen", () => {
  const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
  assert.equal(
    formatUciCommand({ type: "position", startpos: false, fen, moves: [] }),
    `position fen ${fen}`,
  );
});

test("formatUciCommand — go infinite", () => {
  assert.equal(
    formatUciCommand({ type: "go", infinite: true }),
    "go infinite",
  );
});

test("formatUciCommand — go movetime", () => {
  assert.equal(
    formatUciCommand({ type: "go", movetime: 1000 }),
    "go movetime 1000",
  );
});

test("formatUciCommand — go with time controls", () => {
  const result = formatUciCommand({
    type: "go",
    wtime: 60000,
    btime: 60000,
    winc: 1000,
    binc: 1000,
  });
  assert.equal(result, "go wtime 60000 btime 60000 winc 1000 binc 1000");
});

test("formatUciCommand — go depth", () => {
  assert.equal(
    formatUciCommand({ type: "go", depth: 15 }),
    "go depth 15",
  );
});
