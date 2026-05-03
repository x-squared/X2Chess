import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngineManager,
  parseEngineRegistry,
  serializeEngineRegistry,
  type ProcessFactory,
} from "../src/client/engine_manager.js";
import type { EngineProcess } from "../src/uci/uci_session.js";
import type { EngineConfig } from "../src/domain/engine_config.js";

// ── Mock engine process ─────────────────────────────────────────────────────

/**
 * Creates a mock EngineProcess that auto-responds to standard UCI handshake
 * commands. `sent` accumulates all lines sent to the engine. `spawned`
 * records whether `ensureSpawned` was called.
 */
const makeMockProcess = (
  id: string = "engine-1",
): {
  process: EngineProcess & { ensureSpawned(): Promise<void> };
  sent: string[];
  spawned: boolean;
  emitLines: (lines: string[]) => void;
} => {
  const sent: string[] = [];
  const handlers: ((line: string) => void)[] = [];
  let spawned = false;

  const emitLines = (lines: string[]): void => {
    for (const line of lines) {
      for (const h of [...handlers]) h(line);
    }
  };

  const process: EngineProcess & { ensureSpawned(): Promise<void> } = {
    send: async (line: string): Promise<void> => {
      sent.push(line);
      // Auto-respond to standard UCI handshake
      if (line === "uci") {
        emitLines([
          `id name MockEngine-${id}`,
          `id author Test`,
          `option name Hash type spin default 16 min 1 max 32768`,
          `uciok`,
        ]);
      } else if (line === "isready") {
        emitLines(["readyok"]);
      } else if (line === "quit") {
        // no-op
      }
    },
    onOutput: (handler: (line: string) => void): (() => void) => {
      handlers.push(handler);
      return (): void => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },
    kill: async (): Promise<void> => {
      // no-op
    },
    ensureSpawned: async (): Promise<void> => {
      spawned = true;
    },
  };

  return { process, sent, get spawned() { return spawned; }, emitLines };
};

// ── makeFactory — returns a ProcessFactory and access to created mocks ──────

const makeFactory = (): {
  factory: ProcessFactory;
  mocks: Map<string, ReturnType<typeof makeMockProcess>>;
} => {
  const mocks = new Map<string, ReturnType<typeof makeMockProcess>>();

  const factory: ProcessFactory = (config: EngineConfig) => {
    const mock = makeMockProcess(config.id);
    mocks.set(config.id, mock);
    return mock.process;
  };

  return { factory, mocks };
};

// ── parseEngineRegistry ─────────────────────────────────────────────────────

test("parseEngineRegistry — valid JSON returns engines array", () => {
  const json = JSON.stringify({
    engines: [{ id: "sf", label: "Stockfish", path: "/usr/bin/sf", options: {} }],
    defaultEngineId: "sf",
  });
  const registry = parseEngineRegistry(json);
  assert.equal(registry.engines.length, 1);
  assert.equal(registry.engines[0]!.id, "sf");
  assert.equal(registry.defaultEngineId, "sf");
});

test("parseEngineRegistry — malformed JSON returns empty registry", () => {
  const registry = parseEngineRegistry("not-json{{{");
  assert.deepEqual(registry, { engines: [] });
});

test("parseEngineRegistry — missing engines key returns empty array", () => {
  const registry = parseEngineRegistry(JSON.stringify({ defaultEngineId: "sf" }));
  assert.deepEqual(registry.engines, []);
});

test("parseEngineRegistry — engines not an array returns empty array", () => {
  const registry = parseEngineRegistry(JSON.stringify({ engines: "oops" }));
  assert.deepEqual(registry.engines, []);
});

// ── serializeEngineRegistry / round-trip ────────────────────────────────────

test("serializeEngineRegistry — empty engines writes null default and parses back", () => {
  const json = serializeEngineRegistry({ engines: [], defaultEngineId: "stale-would-be-wrong" });
  assert.match(json, /"defaultEngineId"\s*:\s*null/);
  const round = parseEngineRegistry(json);
  assert.deepEqual(round.engines, []);
  assert.equal(round.defaultEngineId, undefined);
});

test("parseEngineRegistry — JSON null defaultEngineId becomes undefined", () => {
  const registry = parseEngineRegistry(JSON.stringify({ engines: [], defaultEngineId: null }));
  assert.equal(registry.defaultEngineId, undefined);
});

// ── createEngineManager — listEngines / defaultEngineId ────────────────────

test("listEngines — returns all configured engines", () => {
  const { factory } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [
        { id: "sf", label: "Stockfish", path: "/sf", options: {} },
        { id: "lc0", label: "Leela", path: "/lc0", options: {} },
      ],
    },
    factory,
  );
  const list = manager.listEngines();
  assert.equal(list.length, 2);
  assert.equal(list[0]!.id, "sf");
  assert.equal(list[1]!.id, "lc0");
});

test("listEngines — returns a copy (mutation does not affect manager)", () => {
  const { factory } = makeFactory();
  const manager = createEngineManager(
    { engines: [{ id: "sf", label: "S", path: "/sf", options: {} }] },
    factory,
  );
  const list = manager.listEngines();
  list.push({ id: "fake", label: "Fake", path: "/fake", options: {} });
  assert.equal(manager.listEngines().length, 1);
});

test("defaultEngineId — reflects registry value", () => {
  const { factory } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [{ id: "sf", label: "S", path: "/sf", options: {} }],
      defaultEngineId: "sf",
    },
    factory,
  );
  assert.equal(manager.defaultEngineId, "sf");
});

test("defaultEngineId — undefined when not set in registry", () => {
  const { factory } = makeFactory();
  const manager = createEngineManager({ engines: [] }, factory);
  assert.equal(manager.defaultEngineId, undefined);
});

// ── getSession — basic initialization ──────────────────────────────────────

test("getSession — initializes engine by id and returns session", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [{ id: "sf", label: "Stockfish", path: "/sf", options: {} }],
      defaultEngineId: "sf",
    },
    factory,
  );

  const session = await manager.getSession("sf");
  assert.ok(session, "session should be returned");
  assert.equal(session.engineName, "MockEngine-sf");

  const mock = mocks.get("sf")!;
  assert.ok(mock.sent.includes("uci"), "should have sent 'uci'");
  assert.ok(mock.sent.includes("isready"), "should have sent 'isready'");
});

test("getSession — uses default engine when no id given", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [{ id: "sf", label: "Stockfish", path: "/sf", options: {} }],
      defaultEngineId: "sf",
    },
    factory,
  );

  await manager.getSession();
  assert.ok(mocks.has("sf"), "should have created the default engine 'sf'");
});

test("getSession — calls ensureSpawned before initialize", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    { engines: [{ id: "e", label: "E", path: "/e", options: {} }] },
    factory,
  );

  await manager.getSession("e");
  const mock = mocks.get("e")!;
  assert.ok(mock.spawned, "ensureSpawned should have been called");
});

test("getSession — second call returns same initialized session", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    { engines: [{ id: "sf", label: "S", path: "/sf", options: {} }] },
    factory,
  );

  const s1 = await manager.getSession("sf");
  const s2 = await manager.getSession("sf");
  assert.equal(s1, s2, "should return the same session object");

  // ensureSpawned and initialize should each have been called once
  const mock = mocks.get("sf")!;
  const uciCount = mock.sent.filter((l) => l === "uci").length;
  assert.equal(uciCount, 1, "should only send 'uci' once");
});

test("restartEngine — kills process and returns a fresh initialized session", async () => {
  const killById = new Map<string, number>();

  const factory: ProcessFactory = (config: EngineConfig) => {
    const mock = makeMockProcess(config.id);
    const innerKill: () => Promise<void> = mock.process.kill.bind(mock.process);
    mock.process.kill = async (): Promise<void> => {
      killById.set(config.id, (killById.get(config.id) ?? 0) + 1);
      await innerKill();
    };
    return mock.process;
  };

  const manager = createEngineManager(
    {
      engines: [{ id: "sf", label: "Stockfish", path: "/sf", options: {} }],
      defaultEngineId: "sf",
    },
    factory,
  );

  const before = await manager.getSession("sf");
  assert.equal(killById.get("sf") ?? 0, 0);

  const after = await manager.restartEngine("sf");
  assert.equal(killById.get("sf"), 1);
  assert.notEqual(before, after);

  const cached = await manager.getSession("sf");
  assert.equal(cached, after);
});

test("getSession — applies engine config options after initialization", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [
        {
          id: "sf",
          label: "Stockfish",
          path: "/sf",
          options: { Threads: 4, Hash: 256 },
        },
      ],
    },
    factory,
  );

  await manager.getSession("sf");
  const mock = mocks.get("sf")!;
  assert.ok(
    mock.sent.some((l) => l === "setoption name Threads value 4"),
    "should have set Threads option",
  );
  assert.ok(
    mock.sent.some((l) => l === "setoption name Hash value 256"),
    "should have set Hash option",
  );
});

// ── getSession — error cases ────────────────────────────────────────────────

test("getSession — throws when engine id not found", async () => {
  const { factory } = makeFactory();
  const manager = createEngineManager(
    { engines: [{ id: "sf", label: "S", path: "/sf", options: {} }] },
    factory,
  );

  await assert.rejects(
    async () => { await manager.getSession("nonexistent"); },
    /Engine "nonexistent" not found/,
  );
});

test("getSession — throws when no default engine is configured", async () => {
  const { factory } = makeFactory();
  const manager = createEngineManager({ engines: [] }, factory);

  await assert.rejects(
    async () => { await manager.getSession(); },
    /Engine .* not found/,
  );
});

test("getSession — different engine ids create separate sessions", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [
        { id: "sf", label: "Stockfish", path: "/sf", options: {} },
        { id: "lc0", label: "Leela", path: "/lc0", options: {} },
      ],
    },
    factory,
  );

  const s1 = await manager.getSession("sf");
  const s2 = await manager.getSession("lc0");
  assert.notEqual(s1, s2, "different engines should return different sessions");
  assert.ok(mocks.has("sf"));
  assert.ok(mocks.has("lc0"));
});

// ── shutdownAll ─────────────────────────────────────────────────────────────

test("shutdownAll — sends quit to all initialized engines", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    {
      engines: [
        { id: "sf", label: "S1", path: "/sf", options: {} },
        { id: "lc0", label: "S2", path: "/lc0", options: {} },
      ],
    },
    factory,
  );

  await manager.getSession("sf");
  await manager.getSession("lc0");
  await manager.shutdownAll();

  assert.ok(mocks.get("sf")!.sent.includes("quit"));
  assert.ok(mocks.get("lc0")!.sent.includes("quit"));
});

test("shutdownAll — subsequent getSession re-initializes engine", async () => {
  const { factory, mocks } = makeFactory();
  const manager = createEngineManager(
    { engines: [{ id: "sf", label: "S", path: "/sf", options: {} }] },
    factory,
  );

  await manager.getSession("sf");
  await manager.shutdownAll();

  // After shutdown, a new session should be created for the same engine id
  const session2 = await manager.getSession("sf");
  assert.ok(session2, "should return a new session after shutdown");

  // A second mock process should have been created (the factory was called again)
  // The mocks map will have been overwritten with a new mock for "sf"
  assert.equal(mocks.get("sf")!.sent.filter((l) => l === "uci").length, 1);
});

test("shutdownAll — does nothing when no engines initialized", async () => {
  const { factory } = makeFactory();
  const manager = createEngineManager(
    { engines: [{ id: "sf", label: "S", path: "/sf", options: {} }] },
    factory,
  );
  // Should not throw
  await manager.shutdownAll();
});
