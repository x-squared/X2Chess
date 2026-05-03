/**
 * Regression tests for PGN-style PV token layout (analysis panel).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPvMoveTokens } from "../../../src/features/analysis/pv_move_tokens";

describe("buildPvMoveTokens", () => {
  it("numbers white-first lines as 1. w b 2. w b without spurious 1…", () => {
    const moves: string[] = ["Nf3", "d5", "d4", "Nf6"];
    const tokens = buildPvMoveTokens(moves, "w");
    const labels: string[] = tokens.map((t) => t.label);
    assert.deepEqual(labels, ["1.", "Nf3", "d5", "2.", "d4", "Nf6"]);
  });

  it("uses 1… before Black’s first move when Black is to move", () => {
    const moves: string[] = ["Nf6", "d4", "g6"];
    const tokens = buildPvMoveTokens(moves, "b");
    const labels: string[] = tokens.map((t) => t.label);
    assert.deepEqual(labels, ["1…", "Nf6", "2.", "d4", "g6"]);
  });

  it("keeps full-move numbers and moves as separate tokens (layout gap applies between siblings)", () => {
    const moves: string[] = ["e4", "e5"];
    const out = buildPvMoveTokens(moves, "w");
    assert.equal(out.length, 3);
    assert.equal(out[0]?.label, "1.");
    assert.equal(out[0]?.isNumber, true);
    assert.equal(out[1]?.label, "e4");
    assert.equal(out[2]?.label, "e5");
    assert.equal(out[2]?.isNumber, false);
  });
});
