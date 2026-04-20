import test from "node:test";
import assert from "node:assert/strict";
import {
  doesResourceChangeAffectTab,
  matchesResourceRefSet,
  toResourceKey,
} from "../../../../src/features/resources/services/resource_event_matching.js";

test("doesResourceChangeAffectTab matches exact locator", (): void => {
  const matches: boolean = doesResourceChangeAffectTab(
    "directory",
    "/tmp/games",
    "directory",
    "/tmp/games",
  );
  assert.equal(matches, true);
});

test("doesResourceChangeAffectTab matches nested file for directory tab", (): void => {
  const matches: boolean = doesResourceChangeAffectTab(
    "directory",
    "/tmp/games",
    "directory",
    "/tmp/games/new-game.pgn",
  );
  assert.equal(matches, true);
});

test("doesResourceChangeAffectTab rejects non-directory prefix mismatch", (): void => {
  const matches: boolean = doesResourceChangeAffectTab(
    "file",
    "/tmp/games.pgn",
    "file",
    "/tmp/games.pgn/new-game.pgn",
  );
  assert.equal(matches, false);
});

test("matchesResourceRefSet returns true for precomputed key", (): void => {
  const refSet: Set<string> = new Set<string>([
    toResourceKey("directory", "/tmp/games"),
    toResourceKey("db", "/tmp/library.x2chess"),
  ]);
  const matches: boolean = matchesResourceRefSet(
    { kind: "directory", locator: "/tmp/games" },
    refSet,
  );
  assert.equal(matches, true);
});

test("matchesResourceRefSet returns false for missing key", (): void => {
  const refSet: Set<string> = new Set<string>([
    toResourceKey("directory", "/tmp/games"),
  ]);
  const matches: boolean = matchesResourceRefSet(
    { kind: "db", locator: "/tmp/library.x2chess" },
    refSet,
  );
  assert.equal(matches, false);
});
