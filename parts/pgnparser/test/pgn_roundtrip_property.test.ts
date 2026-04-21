import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { expectInvariantSafe, parseModel, serializeModel } from "./support/pgn_harness.js";

const SAMPLE_SANS: string[] = [
  "e4", "d4", "Nf3", "c4", "e5", "c5", "Nc6", "d5", "Bb5", "g6",
];

const sanitizeComment = (raw: string): string => raw
  .replaceAll("{", "")
  .replaceAll("}", "")
  .replaceAll("(", "")
  .replaceAll(")", "")
  .trim();

type GeneratedMove = {
  white: string;
  black: string | null;
  whiteComment: string | null;
  blackComment: string | null;
  ravAfterWhite: string | null;
};
type GameResult = "*" | "1-0" | "0-1" | "1/2-1/2";

const sanArb = fc.constantFrom(...SAMPLE_SANS);
const commentArb = fc.string({ minLength: 1, maxLength: 18 }).map(sanitizeComment);
const optionalCommentArb = fc.option(commentArb, { nil: null });
const generatedMoveArb: fc.Arbitrary<GeneratedMove> = fc.record({
  white: sanArb,
  black: fc.option(sanArb, { nil: null }),
  whiteComment: optionalCommentArb,
  blackComment: optionalCommentArb,
  ravAfterWhite: fc.option(sanArb, { nil: null }),
});

const renderGeneratedPgn = (moves: GeneratedMove[], result: GameResult): string => {
  const parts: string[] = [];
  moves.forEach((move: GeneratedMove, idx: number): void => {
    const moveNumber: number = idx + 1;
    parts.push(`${moveNumber}.`, move.white);
    if (move.whiteComment) parts.push(`{${move.whiteComment}}`);
    if (move.ravAfterWhite) parts.push(`(${moveNumber}... ${move.ravAfterWhite})`);
    if (move.black) {
      parts.push(move.black);
      if (move.blackComment) parts.push(`{${move.blackComment}}`);
    }
  });
  parts.push(result);
  return parts.join(" ").replaceAll(/\s+/g, " ").trim();
};

test("round-trip property — serialize(parse(x)) reaches a stable fixed-point", () => {
  const property = fc.property(
    fc.array(generatedMoveArb, { minLength: 1, maxLength: 10 }),
    fc.constantFrom<GameResult>("*", "1-0", "0-1", "1/2-1/2"),
    (moves: GeneratedMove[], result: GameResult): void => {
      const pgn: string = renderGeneratedPgn(moves, result);
      const model1 = parseModel(pgn);
      expectInvariantSafe(model1, `property parse model input="${pgn}"`);
      const serialized1: string = serializeModel(model1);
      const model2 = parseModel(serialized1);
      expectInvariantSafe(model2, `property reparsed model input="${pgn}"`);
      const serialized2: string = serializeModel(model2);
      assert.equal(serialized2, serialized1);
    },
  );

  fc.assert(property, {
    numRuns: 250,
    seed: 424242,
    verbose: true,
  });
});
