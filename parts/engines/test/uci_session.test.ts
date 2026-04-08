import test from "node:test";
import assert from "node:assert/strict";
import { createUciSession } from "../src/uci/uci_session.js";
import type { EngineProcess } from "../src/uci/uci_session.js";

// ── Mock engine process ────────────────────────────────────────────────────────

/** Create a simulated engine process.
 *
 * `emitLines(lines)` pushes lines to subscribed output handlers as if the
 * engine wrote them to stdout.  `sent` accumulates all lines written to the
 * engine via `send()`.
 */
const makeMockProcess = (): {
  process: EngineProcess;
  emitLines: (lines: string[]) => void;
  sent: string[];
} => {
  const sent: string[] = [];
  const handlers: ((line: string) => void)[] = [];

  const process: EngineProcess = {
    send: async (line: string): Promise<void> => {
      sent.push(line);
    },
    onOutput: (handler: (line: string) => void): (() => void) => {
      handlers.push(handler);
      return (): void => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },
    kill: async (): Promise<void> => {
      // no-op in mock
    },
  };

  const emitLines = (lines: string[]): void => {
    for (const line of lines) {
      for (const h of handlers) h(line);
    }
  };

  return { process, emitLines, sent };
};

// ── Tests ──────────────────────────────────────────────────────────────────────

test("uci_session — initialize sends 'uci' and resolves on 'uciok'", async () => {
  const { process, emitLines, sent } = makeMockProcess();
  const session = createUciSession(process);

  const initPromise = session.initialize();
  emitLines([
    "id name TestEngine 1.0",
    "id author Test Author",
    "option name Hash type spin default 16 min 1 max 33554432",
    "uciok",
  ]);

  await initPromise;

  assert.equal(sent[0], "uci");
  assert.equal(session.engineName, "TestEngine 1.0");
  assert.equal(session.engineAuthor, "Test Author");
  assert.equal(session.options.has("Hash"), true);
});

test("uci_session — isReady sends 'isready' and resolves on 'readyok'", async () => {
  const { process, emitLines, sent } = makeMockProcess();
  const session = createUciSession(process);

  // Initialize first.
  const initP = session.initialize();
  emitLines(["uciok"]);
  await initP;

  const readyP = session.isReady();
  emitLines(["readyok"]);
  await readyP;

  assert.ok(sent.includes("isready"));
});

test("uci_session — newGame sends 'ucinewgame'", async () => {
  const { process, emitLines, sent } = makeMockProcess();
  const session = createUciSession(process);
  const initP = session.initialize();
  emitLines(["uciok"]);
  await initP;

  session.newGame();
  assert.ok(sent.includes("ucinewgame"));
});

test("uci_session — findBestMove resolves with bestmove", async () => {
  const { process, emitLines, sent } = makeMockProcess();
  const session = createUciSession(process);

  const initP = session.initialize();
  emitLines(["uciok"]);
  await initP;

  const readyP = session.isReady();
  emitLines(["readyok"]);
  await readyP;

  const bmPromise = session.findBestMove(
    { fen: "startpos", moves: [] },
    { movetime: 100 },
  );

  // Check that position + go commands were sent.
  assert.ok(sent.some((l) => l.startsWith("position")));
  assert.ok(sent.some((l) => l.startsWith("go movetime 100")));

  emitLines(["bestmove e2e4 ponder e7e5"]);
  const result = await bmPromise;

  assert.deepEqual(result, { uci: "e2e4", ponder: "e7e5" });
});

test("uci_session — startAnalysis calls onVariation for info lines", async () => {
  const { process, emitLines } = makeMockProcess();
  const session = createUciSession(process);

  const initP = session.initialize();
  emitLines(["uciok"]);
  await initP;

  const readyP = session.isReady();
  emitLines(["readyok"]);
  await readyP;

  const variations: unknown[] = [];
  session.startAnalysis(
    { fen: "startpos", moves: [] },
    { infinite: true },
    (v) => { variations.push(v); },
  );

  emitLines([
    "info depth 8 seldepth 10 multipv 1 score cp 30 nodes 50000 nps 1000000 time 50 pv e2e4 e7e5",
    "info depth 9 seldepth 11 multipv 1 score cp 35 nodes 80000 nps 1100000 time 72 pv e2e4 e7e5 g1f3",
  ]);

  assert.equal(variations.length, 2);
  const v0 = variations[0] as { depth: number; pv: string[] };
  assert.equal(v0.depth, 8);
  assert.deepEqual(v0.pv, ["e2e4", "e7e5"]);
});

test("uci_session — stopAnalysis sends stop and resolves on bestmove", async () => {
  const { process, emitLines, sent } = makeMockProcess();
  const session = createUciSession(process);

  const initP = session.initialize();
  emitLines(["uciok"]);
  await initP;
  const readyP = session.isReady();
  emitLines(["readyok"]);
  await readyP;

  session.startAnalysis({ fen: "startpos", moves: [] }, { infinite: true }, () => {});

  const stopP = session.stopAnalysis();
  assert.ok(sent.includes("stop"));

  emitLines(["bestmove d2d4"]);
  const result = await stopP;
  assert.deepEqual(result, { uci: "d2d4", ponder: undefined });
});

test("uci_session — stopAnalysis when not thinking returns null", async () => {
  const { process, emitLines } = makeMockProcess();
  const session = createUciSession(process);

  const initP = session.initialize();
  emitLines(["uciok"]);
  await initP;
  const readyP = session.isReady();
  emitLines(["readyok"]);
  await readyP;

  const result = await session.stopAnalysis();
  assert.equal(result, null);
});
