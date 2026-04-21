import assert from "node:assert/strict";
import { parsePgnToModel } from "../../src/pgn_model.js";
import { serializeModelToPgn } from "../../src/pgn_serialize.js";
import { collectPgnModelInvariantIssues } from "../../src/pgn_invariants.js";
import { getMoveCommentsAfter, getMoveRavs } from "../../src/pgn_move_attachments.js";
import type { PgnCursor } from "../../src/pgn_move_ops.js";
import type { PgnEntryNode, PgnModel, PgnMoveNode, PgnVariationNode } from "../../src/pgn_model.js";

/**
 * Parse PGN text into a model for tests.
 *
 * @param pgn - Raw PGN input.
 * @returns Parsed model.
 */
export const parseModel = (pgn: string): PgnModel => parsePgnToModel(pgn);

/**
 * Serialize a model back to PGN text for tests.
 *
 * @param model - Parsed model.
 * @returns Serialized PGN text.
 */
export const serializeModel = (model: PgnModel): string => serializeModelToPgn(model);

/**
 * Parse -> serialize -> parse helper for round-trip checks.
 *
 * @param pgn - Raw PGN input.
 * @returns Initial model, serialized output, and reparsed model.
 */
export const roundTrip = (pgn: string): {
  firstModel: PgnModel;
  serialized: string;
  secondModel: PgnModel;
} => {
  const firstModel: PgnModel = parseModel(pgn);
  const serialized: string = serializeModel(firstModel);
  const secondModel: PgnModel = parseModel(serialized);
  return { firstModel, serialized, secondModel };
};

/**
 * Assert model graph invariants with a contextual message.
 *
 * @param model - Model to validate.
 * @param context - Optional context label for clearer failures.
 */
export const expectInvariantSafe = (model: PgnModel, context: string = "model"): void => {
  const issues = collectPgnModelInvariantIssues(model);
  assert.deepEqual(issues, [], `${context} violated invariants: ${JSON.stringify(issues)}`);
};

/**
 * Collect SAN text from root variation moves only.
 *
 * @param model - Source model.
 * @returns SAN sequence in root variation order.
 */
export const mainlineSans = (model: PgnModel): string[] => model.root.entries
  .filter((entry: PgnEntryNode): boolean => entry.type === "move")
  .map((entry: PgnEntryNode): string => (entry as PgnMoveNode).san);

/**
 * Assert exact root variation SAN sequence.
 *
 * @param model - Source model.
 * @param expectedSans - Expected SAN sequence.
 */
export const expectMainlineSans = (model: PgnModel, expectedSans: string[]): void => {
  assert.deepEqual(mainlineSans(model), expectedSans);
};

/**
 * Collect root variation move-number token texts.
 *
 * @param model - Source model.
 * @returns Move-number tokens in root variation order.
 */
export const mainlineMoveNumbers = (model: PgnModel): string[] => model.root.entries
  .filter((entry: PgnEntryNode): boolean => entry.type === "move_number")
  .map((entry: PgnEntryNode): string => (entry as { text: string }).text);

/**
 * Assert exact root variation move-number sequence.
 *
 * @param model - Source model.
 * @param expectedNumbers - Expected move-number token texts.
 */
export const expectMainlineMoveNumbers = (model: PgnModel, expectedNumbers: string[]): void => {
  assert.deepEqual(mainlineMoveNumbers(model), expectedNumbers);
};

/**
 * Shared type guard for move entries.
 *
 * @param entry - Variation entry.
 * @returns True when the entry is a move node.
 */
export const isMoveEntry = (entry: PgnEntryNode): entry is PgnMoveNode => entry.type === "move";

/**
 * Shared SAN matcher predicate for move entries.
 *
 * @param san - SAN string to match.
 * @returns Predicate that matches move entries with this SAN.
 */
export const isMoveWithSan = (san: string) =>
  (entry: PgnEntryNode): entry is PgnMoveNode => entry.type === "move" && entry.san === san;

/**
 * Shared ID matcher predicate for move entries.
 *
 * @param moveId - Move ID to match.
 * @returns Predicate that matches move entries with this ID.
 */
export const isMoveWithId = (moveId: string) =>
  (entry: PgnEntryNode): entry is PgnMoveNode => entry.type === "move" && entry.id === moveId;

/**
 * Find the first root-variation move by SAN.
 *
 * @param model - Source model.
 * @param san - SAN to match.
 * @returns Matching move node.
 */
export const findMainlineMoveBySan = (model: PgnModel, san: string): PgnMoveNode => {
  const move = model.root.entries.find(isMoveWithSan(san));
  if (!move) assert.fail(`Expected mainline move "${san}" to exist`);
  return move;
};

/**
 * Find the first move in a variation entry list.
 *
 * @param entries - Variation entries to scan.
 * @returns First move node in the list.
 */
export const findFirstMoveInEntries = (entries: PgnEntryNode[]): PgnMoveNode => {
  const move = entries.find((entry: PgnEntryNode): entry is PgnMoveNode => entry.type === "move");
  if (!move) assert.fail("Expected entries to contain at least one move");
  return move;
};

/**
 * Find any move by ID across the full variation tree.
 *
 * @param model - Source model.
 * @param moveId - Move node ID to locate.
 * @returns Matching move node or null.
 */
export const findMoveNodeById = (model: PgnModel, moveId: string): PgnMoveNode | null => {
  const stack: PgnVariationNode[] = [model.root];
  while (stack.length > 0) {
    const variation: PgnVariationNode | undefined = stack.pop();
    if (!variation) continue;
    for (const entry of variation.entries) {
      if (entry.type === "move") {
        if (entry.id === moveId) return entry;
        getMoveRavs(entry).forEach((rav): void => stack.push(rav));
      } else if (entry.type === "variation") {
        stack.push(entry);
      }
    }
  }
  return null;
};

/**
 * Assert all "after" comment raws for a specific root move.
 *
 * @param model - Source model.
 * @param san - Mainline move SAN.
 * @param expectedRawComments - Expected comment raw strings.
 */
export const expectAfterCommentRaws = (
  model: PgnModel,
  san: string,
  expectedRawComments: string[],
): void => {
  const move: PgnMoveNode = findMainlineMoveBySan(model, san);
  const raws: string[] = getMoveCommentsAfter(move).map((comment): string => comment.raw);
  assert.deepEqual(raws, expectedRawComments);
};

/**
 * Assert the number of attached RAVs for a mainline move.
 *
 * @param model - Source model.
 * @param san - Mainline move SAN.
 * @param count - Expected RAV count.
 */
export const expectRavCount = (model: PgnModel, san: string, count: number): void => {
  const move: PgnMoveNode = findMainlineMoveBySan(model, san);
  assert.equal(getMoveRavs(move).length, count);
};

/**
 * Cursor positioned before the first move in root variation.
 *
 * @param model - Source model.
 * @returns Root cursor.
 */
export const rootCursor = (model: PgnModel): PgnCursor => ({
  moveId: null,
  variationId: model.root.id,
});

/**
 * Cursor positioned at the last move in root variation.
 *
 * @param model - Source model.
 * @returns Cursor to final mainline move.
 */
export const lastMainlineCursor = (model: PgnModel): PgnCursor => {
  const moves: PgnEntryNode[] = model.root.entries.filter((entry: PgnEntryNode): boolean => entry.type === "move");
  const lastMove: PgnEntryNode | undefined = moves.at(-1);
  const moveId: string | null = lastMove?.type === "move" ? lastMove.id : null;
  return { moveId, variationId: model.root.id };
};

/**
 * Assert exact serialized PGN output.
 *
 * @param model - Source model.
 * @param expectedPgn - Expected serialized PGN.
 */
export const expectSerializedExact = (model: PgnModel, expectedPgn: string): void => {
  const actual: string = serializeModel(model);
  assert.equal(actual, expectedPgn);
};

/**
 * Contract checker: mutation result must preserve structural invariants.
 *
 * @param model - Updated model returned by mutator.
 * @param opName - Mutator operation name for diagnostics.
 */
export const expectContractModelInvariantSafe = (model: PgnModel, opName: string): void => {
  expectInvariantSafe(model, `${opName} contract`);
};

/**
 * Contract checker: cursor returned by mutator points to an existing move.
 *
 * @param model - Updated model returned by mutator.
 * @param cursor - Cursor returned by mutator.
 * @param opName - Mutator operation name for diagnostics.
 */
export const expectContractCursorTargetsExistingMove = (
  model: PgnModel,
  cursor: PgnCursor,
  opName: string,
): void => {
  assert.ok(cursor.moveId, `${opName} contract: cursor.moveId must be non-null`);
  const targetMove = findMoveNodeById(model, cursor.moveId ?? "");
  assert.ok(targetMove, `${opName} contract: cursor move must exist in updated model`);
};
