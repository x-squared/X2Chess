import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createVersionedStore } from "../../src/storage/versioned_store";
import type { StorageBackend } from "../../src/storage/versioned_store";

// ── In-memory storage stub ────────────────────────────────────────────────────

const makeStorage = (initial: Record<string, string> = {}): StorageBackend => {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createVersionedStore", () => {
  it("returns defaultValue when key is absent", () => {
    const s = makeStorage();
    const store = createVersionedStore({ key: "k", version: 1, defaultValue: 42, migrations: [], storage: s });
    assert.equal(store.read(), 42);
  });

  it("does not write when key is absent", () => {
    const s = makeStorage();
    const store = createVersionedStore({ key: "k", version: 1, defaultValue: 99, migrations: [], storage: s });
    store.read();
    assert.equal(s.getItem("k"), null);
  });

  it("returns stored value at current version without write-back", () => {
    const s = makeStorage({ k: JSON.stringify({ v: 1, data: "hello" }) });
    const store = createVersionedStore({ key: "k", version: 1, defaultValue: "", migrations: [], storage: s });
    assert.equal(store.read(), "hello");
    // Raw value should be unchanged (no re-write for current version).
    assert.equal(s.getItem("k"), JSON.stringify({ v: 1, data: "hello" }));
  });

  it("migrates v0 raw (legacy) payload to current version", () => {
    // Raw value with no envelope — treated as v0.
    const s = makeStorage({ k: JSON.stringify({ name: "Alice" }) });
    const store = createVersionedStore<{ name: string; age: number }>({
      key: "k",
      version: 1,
      defaultValue: { name: "", age: 0 },
      migrations: [(raw) => ({ ...(raw as object), age: 30 })],
      storage: s,
    });
    const result = store.read();
    assert.equal(result.name, "Alice");
    assert.equal(result.age, 30);
    // Should have written the migrated envelope back at the current version.
    const envelope = s.getItem("k");
    assert.ok(envelope !== null, "migrated key should be written back");
    assert.equal(JSON.parse(envelope).v, 1);
  });

  it("applies multi-step migration chain in order", () => {
    // Raw (no envelope) value treated as v0. Two steps bring it to v2.
    const s = makeStorage({ k: JSON.stringify(1) });
    const store = createVersionedStore<number>({
      key: "k",
      version: 2,
      defaultValue: 0,
      migrations: [
        (raw) => (raw as number) + 10,  // v0→v1: 1+10=11
        (raw) => (raw as number) * 2,   // v1→v2: 11*2=22
      ],
      storage: s,
    });
    assert.equal(store.read(), 22);
  });

  it("returns defaultValue for future-version data without overwriting", () => {
    const s = makeStorage({ k: JSON.stringify({ v: 99, data: "future" }) });
    const store = createVersionedStore({ key: "k", version: 1, defaultValue: "default", migrations: [], storage: s });
    assert.equal(store.read(), "default");
    // Must NOT overwrite the future data.
    const rawStr = s.getItem("k");
    assert.ok(rawStr !== null, "future key must not be deleted");
    assert.equal(JSON.parse(rawStr).v, 99);
  });

  it("returns defaultValue and resets key on corrupt JSON", () => {
    const s = makeStorage({ k: "{ not valid json" });
    const store = createVersionedStore({ key: "k", version: 1, defaultValue: "fallback", migrations: [], storage: s });
    assert.equal(store.read(), "fallback");
    assert.equal(s.getItem("k"), null);
  });

  it("returns defaultValue and resets when migration step returns null", () => {
    const s = makeStorage({ k: JSON.stringify({ v: 1, data: "bad" }) });
    const store = createVersionedStore<string>({
      key: "k",
      version: 2,
      defaultValue: "default",
      migrations: [() => null],
      storage: s,
    });
    assert.equal(store.read(), "default");
    assert.equal(s.getItem("k"), null);
  });

  it("write() persists an envelope at current version", () => {
    const s = makeStorage();
    const store = createVersionedStore({ key: "k", version: 2, defaultValue: 0, migrations: [() => 0], storage: s });
    store.write(55);
    const writtenStr = s.getItem("k");
    assert.ok(writtenStr !== null, "key must be written");
    const written = JSON.parse(writtenStr);
    assert.equal(written.v, 2);
    assert.equal(written.data, 55);
  });

  it("reset() removes the key", () => {
    const s = makeStorage({ k: JSON.stringify({ v: 1, data: "x" }) });
    const store = createVersionedStore({ key: "k", version: 1, defaultValue: "", migrations: [], storage: s });
    store.reset();
    assert.equal(s.getItem("k"), null);
  });
});
