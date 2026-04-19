import test from "node:test";
import assert from "node:assert/strict";
import { resolveEffectiveGamesDirectory } from "../../src/resources/picker_fs_helpers.js";

test("resolveEffectiveGamesDirectory — nested games folder wins over tab root", () => {
  assert.equal(resolveEffectiveGamesDirectory("/proj", "/proj/games"), "/proj/games");
});

test("resolveEffectiveGamesDirectory — equal paths unchanged", () => {
  assert.equal(resolveEffectiveGamesDirectory("/proj/games", "/proj/games"), "/proj/games");
});

test("resolveEffectiveGamesDirectory — empty tab uses state", () => {
  assert.equal(resolveEffectiveGamesDirectory("", "/proj/games"), "/proj/games");
});

test("resolveEffectiveGamesDirectory — unrelated paths keep tab locator", () => {
  assert.equal(resolveEffectiveGamesDirectory("/a/lib1", "/b/other"), "/a/lib1");
});

test("resolveEffectiveGamesDirectory — Windows-style state still matches", () => {
  assert.equal(
    resolveEffectiveGamesDirectory("/Users/foo/Lib", "/Users/foo/Lib/games"),
    "/Users/foo/Lib/games",
  );
});
