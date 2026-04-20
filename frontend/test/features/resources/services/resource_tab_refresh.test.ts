import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResourceTabReloadPlan,
  collectAffectedResourceTabIds,
} from "../../../../src/features/resources/services/resource_tab_refresh.js";

test("collectAffectedResourceTabIds returns matching exact tab", (): void => {
  const affected: string[] = collectAffectedResourceTabIds(
    [
      { tabId: "a", kind: "directory", locator: "/tmp/games" },
      { tabId: "b", kind: "db", locator: "/tmp/lib.x2chess" },
    ],
    "db",
    "/tmp/lib.x2chess",
  );
  assert.deepEqual(affected, ["b"]);
});

test("collectAffectedResourceTabIds matches directory prefix for file locator", (): void => {
  const affected: string[] = collectAffectedResourceTabIds(
    [
      { tabId: "dir-tab", kind: "directory", locator: "/tmp/games" },
      { tabId: "other-tab", kind: "directory", locator: "/tmp/other" },
    ],
    "directory",
    "/tmp/games/new-game.pgn",
  );
  assert.deepEqual(affected, ["dir-tab"]);
});

test("collectAffectedResourceTabIds returns empty when no tab matches", (): void => {
  const affected: string[] = collectAffectedResourceTabIds(
    [{ tabId: "a", kind: "directory", locator: "/tmp/games" }],
    "file",
    "/tmp/games.pgn",
  );
  assert.deepEqual(affected, []);
});

test("buildResourceTabReloadPlan returns reload entries for matching tabs", (): void => {
  const plan = buildResourceTabReloadPlan(
    [
      {
        tabId: "dir-tab",
        resourceRef: { kind: "directory", locator: "/tmp/games" },
      },
      {
        tabId: "db-tab",
        resourceRef: { kind: "db", locator: "/tmp/lib.x2chess" },
      },
    ],
    "directory",
    "/tmp/games/new-game.pgn",
  );
  assert.deepEqual(plan, [
    {
      tabId: "dir-tab",
      resourceRef: { kind: "directory", locator: "/tmp/games" },
    },
  ]);
});
