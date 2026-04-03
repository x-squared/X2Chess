import test from "node:test";
import assert from "node:assert/strict";
import {
  toResourceTabTitle,
  normalizeResourceRefForInsert,
} from "../../src/runtime/resource_ref_utils.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Minimal stub translator that returns the fallback. */
const t = (_key: string, fallback = ""): string => fallback;

// ── toResourceTabTitle ─────────────────────────────────────────────────────────

test("toResourceTabTitle — null ref returns Resources fallback", () => {
  assert.equal(toResourceTabTitle(null, t), "Resources");
});

test("toResourceTabTitle — directory with named locator returns short name", () => {
  const ref = { kind: "directory", locator: "/home/user/games" };
  assert.equal(toResourceTabTitle(ref, t), "games");
});

test("toResourceTabTitle — directory with nested path returns last segment", () => {
  const ref = { kind: "directory", locator: "/a/b/my-collection" };
  assert.equal(toResourceTabTitle(ref, t), "my-collection");
});

test("toResourceTabTitle — directory with Windows-style path uses forward-slash split", () => {
  const ref = { kind: "directory", locator: "C:\\Users\\user\\chess" };
  assert.equal(toResourceTabTitle(ref, t), "chess");
});

test("toResourceTabTitle — directory with 'local-files' locator falls through to kind label", () => {
  const ref = { kind: "directory", locator: "local-files" };
  // Falls through to the t() call with kind label
  const result = toResourceTabTitle(ref, (_key, fallback) => fallback ?? "");
  assert.equal(result, "DIRECTORY");
});

test("toResourceTabTitle — file kind returns uppercased kind fallback", () => {
  const ref = { kind: "file", locator: "/path/to/game.pgn" };
  const result = toResourceTabTitle(ref, (_key, fallback) => fallback ?? "");
  assert.equal(result, "FILE");
});

test("toResourceTabTitle — db kind returns uppercased kind fallback", () => {
  const ref = { kind: "db", locator: "some-db" };
  const result = toResourceTabTitle(ref, (_key, fallback) => fallback ?? "");
  assert.equal(result, "DB");
});

test("toResourceTabTitle — empty kind returns 'RESOURCE' fallback", () => {
  const ref = { kind: "", locator: "" };
  const result = toResourceTabTitle(ref, (_key, fallback) => fallback ?? "");
  assert.equal(result, "RESOURCE");
});

// ── normalizeResourceRefForInsert ─────────────────────────────────────────────

const emptyState = { gameDirectoryPath: "", gameDirectoryHandle: null };

test("normalizeResourceRefForInsert — null ref returns null", () => {
  assert.equal(normalizeResourceRefForInsert(null, emptyState), null);
});

test("normalizeResourceRefForInsert — non-directory ref returned unchanged", () => {
  const ref = { kind: "file", locator: "/path/game.pgn", recordId: "1" };
  assert.equal(normalizeResourceRefForInsert(ref, emptyState), ref);
});

test("normalizeResourceRefForInsert — directory with real locator returned unchanged", () => {
  const ref = { kind: "directory", locator: "/home/games" };
  assert.equal(normalizeResourceRefForInsert(ref, emptyState), ref);
});

test("normalizeResourceRefForInsert — directory with 'local-files' uses gameDirectoryPath", () => {
  const ref = { kind: "directory", locator: "local-files" };
  const state = { gameDirectoryPath: "/resolved/path", gameDirectoryHandle: null };
  const result = normalizeResourceRefForInsert(ref, state);
  assert.deepEqual(result, { kind: "directory", locator: "/resolved/path" });
});

test("normalizeResourceRefForInsert — directory with empty locator uses gameDirectoryPath", () => {
  const ref = { kind: "directory", locator: "" };
  const state = { gameDirectoryPath: "/resolved/path", gameDirectoryHandle: null };
  const result = normalizeResourceRefForInsert(ref, state);
  assert.deepEqual(result, { kind: "directory", locator: "/resolved/path" });
});

test("normalizeResourceRefForInsert — directory with empty locator falls back to browser-handle", () => {
  const ref = { kind: "directory", locator: "" };
  const state = { gameDirectoryPath: "", gameDirectoryHandle: { handle: true } };
  const result = normalizeResourceRefForInsert(ref, state);
  assert.deepEqual(result, { kind: "directory", locator: "browser-handle" });
});

test("normalizeResourceRefForInsert — no path and no handle returns null", () => {
  const ref = { kind: "directory", locator: "" };
  assert.equal(normalizeResourceRefForInsert(ref, emptyState), null);
});
