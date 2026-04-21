import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  expectInvariantSafe,
  findMainlineMoveBySan,
  parseModel,
  serializeModel,
} from "./support/pgn_harness.js";
import type { PgnMoveNode } from "../src/pgn_model.js";
import { getMoveCommentsAfter } from "../src/pgn_move_attachments.js";

/**
 * COPY-ME EXAMPLE #1: fixed regression test from a concrete PGN string.
 *
 * Replace:
 * - pgn input
 * - expected serialized output
 * - domain-specific assertions you care about
 */
test("example regression — comment after first move survives round-trip", () => {
  const pgn = "1. e4 {important note} e5";

  const model = parseModel(pgn);
  expectInvariantSafe(model, "example regression parse");

  const serialized = serializeModel(model);
  assert.equal(serialized, "1. e4 {important note} e5");

  const reparsed = parseModel(serialized);
  expectInvariantSafe(reparsed, "example regression reparse");
  const e4: PgnMoveNode = findMainlineMoveBySan(reparsed, "e4");
  assert.equal(getMoveCommentsAfter(e4)[0]?.raw, "important note");
});

/**
 * COPY-ME EXAMPLE #2: fast-check property test with reproducible seed.
 *
 * Pattern:
 * - generate many inputs (here: simple move/comment sequences),
 * - assert invariants + fixed-point property:
 *   serialize(parse(x)) is stable on reparse.
 */
test("example property — generated move/comment sequences are serialization fixed-points", () => {
  const sanArb = fc.constantFrom("e4", "d4", "Nf3", "c4", "e5", "c5");
  const commentArb = fc.string({ minLength: 1, maxLength: 12 }).map((raw: string): string => raw
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .trim());
  const moveWithOptionalCommentArb = fc.record({
    san: sanArb,
    comment: fc.option(commentArb, { nil: null }),
  });

  const property = fc.property(
    fc.array(moveWithOptionalCommentArb, { minLength: 2, maxLength: 10 }),
    (items: Array<{ san: string; comment: string | null }>): void => {
      const parts: string[] = [];
      let moveNumber = 1;
      items.forEach((item, idx): void => {
        if (idx % 2 === 0) {
          parts.push(`${moveNumber}.`);
          moveNumber += 1;
        }
        parts.push(item.san);
        if (item.comment) parts.push(`{${item.comment}}`);
      });
      const pgn = `${parts.join(" ")} *`.replaceAll(/\s+/g, " ").trim();

      const model1 = parseModel(pgn);
      expectInvariantSafe(model1, `example property parse input="${pgn}"`);
      const serialized1 = serializeModel(model1);
      const model2 = parseModel(serialized1);
      expectInvariantSafe(model2, `example property reparse input="${pgn}"`);
      const serialized2 = serializeModel(model2);
      assert.equal(serialized2, serialized1);
    },
  );

  fc.assert(property, {
    numRuns: 120,
    seed: 20260421,
    verbose: true,
  });
});
