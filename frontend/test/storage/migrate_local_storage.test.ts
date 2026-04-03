import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrateLocalStorage } from "../../src/storage/migrate_local_storage";
import { SHELL_PREFS_KEY, DEFAULT_SHELL_PREFS } from "../../src/runtime/shell_prefs_store";
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

const readPrefs = (s: StorageBackend): Record<string, unknown> => {
  const raw = s.getItem(SHELL_PREFS_KEY);
  assert.ok(raw !== null, "Compound key should exist after migration");
  return (JSON.parse(raw) as { v: number; data: Record<string, unknown> }).data;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("migrateLocalStorage", () => {
  it("is idempotent: does nothing when compound key already exists", () => {
    const existing = JSON.stringify({ v: 1, data: { sound: false } });
    const s = makeStorage({ [SHELL_PREFS_KEY]: existing });
    migrateLocalStorage(s);
    // Must not alter the existing compound key.
    assert.equal(s.getItem(SHELL_PREFS_KEY), existing);
  });

  it("writes default envelope on fresh install (no legacy keys)", () => {
    const s = makeStorage();
    migrateLocalStorage(s);
    const prefs = readPrefs(s);
    assert.equal(prefs["sound"], DEFAULT_SHELL_PREFS.sound);
    assert.equal(prefs["pgnLayout"], DEFAULT_SHELL_PREFS.pgnLayout);
  });

  it("consolidates legacy individual keys into the compound store", () => {
    const s = makeStorage({
      "x2chess.sound": "false",
      "x2chess.moveDelayMs": "500",
      "x2chess.locale": "de",
      "x2chess.pgnLayout": "tree",
      "x2chess.developerTools": "true",
      "x2chess.positionPreviewOnHover": "false",
    });
    migrateLocalStorage(s);

    const prefs = readPrefs(s);
    assert.equal(prefs["sound"], false);
    assert.equal(prefs["moveDelayMs"], 500);
    assert.equal(prefs["locale"], "de");
    assert.equal(prefs["pgnLayout"], "tree");
    assert.equal(prefs["developerToolsEnabled"], true);
    assert.equal(prefs["positionPreviewOnHover"], false);
  });

  it("removes legacy keys after consolidation", () => {
    const s = makeStorage({ "x2chess.sound": "true" });
    migrateLocalStorage(s);
    assert.equal(s.getItem("x2chess.sound"), null);
    assert.equal(s.getItem("x2chess.locale"), null);
    assert.equal(s.getItem("x2chess.moveDelayMs"), null);
    assert.equal(s.getItem("x2chess.pgnLayout"), null);
  });

  it("falls back to defaults for missing legacy fields", () => {
    const s = makeStorage({ "x2chess.sound": "false" }); // only one key present
    migrateLocalStorage(s);
    const prefs = readPrefs(s);
    assert.equal(prefs["sound"], false);
    assert.equal(prefs["pgnLayout"], DEFAULT_SHELL_PREFS.pgnLayout);
    assert.equal(prefs["moveDelayMs"], DEFAULT_SHELL_PREFS.moveDelayMs);
  });

  it("running twice is idempotent", () => {
    const s = makeStorage({ "x2chess.moveDelayMs": "200" });
    migrateLocalStorage(s);
    const after1 = s.getItem(SHELL_PREFS_KEY);
    migrateLocalStorage(s);
    const after2 = s.getItem(SHELL_PREFS_KEY);
    assert.equal(after1, after2);
  });
});
