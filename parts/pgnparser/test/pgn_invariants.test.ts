import test from "node:test";
import assert from "node:assert/strict";
import { collectPgnModelInvariantIssues, isPgnModelStructurallyValid } from "../src/pgn_invariants.js";
import type { PgnModel, PgnMoveNode } from "../src/pgn_model.js";
import { expectInvariantSafe, findMainlineMoveBySan, parseModel } from "./support/pgn_harness.js";

test("collectPgnModelInvariantIssues — parsed PGN is structurally valid", () => {
  const model: PgnModel = parseModel("[Event \"?\"]\n\n1. e4 {x} (1... c5) e5 *");
  expectInvariantSafe(model, "parsed model");
  assert.equal(isPgnModelStructurallyValid(model), true);
});

test("collectPgnModelInvariantIssues — flags orphan variation parent id", () => {
  const model: PgnModel = parseModel("[Event \"?\"]\n\n1. e4 {x} e5 *");
  const e4: PgnMoveNode = findMainlineMoveBySan(model, "e4");
  const firstRavItem = e4.postItems.find((item) => item.type === "rav");
  if (firstRavItem?.type === "rav") {
    firstRavItem.rav.parentMoveId = "missing-move-id";
  } else {
    e4.postItems.push({
      type: "rav",
      rav: {
        id: "variation_test",
        type: "variation",
        depth: 1,
        parentMoveId: "missing-move-id",
        entries: [],
        trailingComments: [],
      },
    });
  }

  const issues = collectPgnModelInvariantIssues(model);
  assert.equal(
    issues.some((issue) => issue.code === "orphan_parent_move_id"),
    true,
    `expected orphan parent issue, got ${JSON.stringify(issues)}`,
  );
  assert.equal(isPgnModelStructurallyValid(model), false);
});
