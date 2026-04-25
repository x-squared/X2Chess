import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../src/pgn_model.js";
import {
  appendMove,
  insertVariation,
  replaceMove,
  truncateAfter,
  deleteSingleMove,
  truncateBefore,
  deleteVariation,
  deleteVariationsAfter,
  promoteToMainline,
  swapSiblingVariations,
  findCursorForMoveId,
} from "../src/pgn_move_ops.js";
import { getMoveRavs } from "../src/pgn_move_attachments.js";
import {
  expectContractCursorTargetsExistingMove,
  expectContractModelInvariantSafe,
  expectMainlineMoveNumbers,
  expectMainlineSans,
  findFirstMoveInEntries,
  findMainlineMoveBySan,
  isMoveEntry,
  isMoveWithId,
  isMoveWithSan,
  lastMainlineCursor,
  mainlineMoveNumbers,
  mainlineSans,
  rootCursor,
} from "./support/pgn_harness.js";
import type { PgnCursor } from "../src/pgn_move_ops.js";
import type { PgnMoveNode, PgnMoveNumberNode, PgnVariationNode } from "../src/pgn_model.js";

// ── appendMove ─────────────────────────────────────────────────────────────────

test("appendMove — appends to empty game from root", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const [updated] = appendMove(model, rootCursor(model), "e4");
  expectContractModelInvariantSafe(updated, "appendMove");
  expectMainlineSans(updated, ["e4"]);
});

test("appendMove — appends after the last move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const [updated] = appendMove(model, lastMainlineCursor(model), "Nf3");
  expectContractModelInvariantSafe(updated, "appendMove");
  const sans = mainlineSans(updated);
  assert.equal(sans.at(-1), "Nf3");
  assert.equal(sans.length, 3);
});

test("appendMove — does not mutate the original model", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 *");
  const originalLength = mainlineSans(model).length;
  appendMove(model, lastMainlineCursor(model), "e5");
  assert.equal(mainlineSans(model).length, originalLength);
});

test("appendMove — returns a cursor pointing to the new move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n*");
  const [updated, newCursor] = appendMove(model, rootCursor(model), "d4");
  expectContractModelInvariantSafe(updated, "appendMove");
  expectContractCursorTargetsExistingMove(updated, newCursor, "appendMove");
  const d4Entry = updated.root.entries.find(isMoveWithSan("d4"));
  assert.equal(newCursor.moveId, d4Entry?.id);
});

test("appendMove — invalid variation cursor is a no-op", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 *");
  const cursor: PgnCursor = { moveId: null, variationId: "missing-variation" };
  const [updated, nextCursor] = appendMove(model, cursor, "e5");
  assert.equal(updated, model);
  assert.deepEqual(nextCursor, cursor);
});

test("appendMove — supports inserting a null move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. Nf3 Nc6 *");
  const [updated] = appendMove(model, lastMainlineCursor(model), "--");
  expectContractModelInvariantSafe(updated, "appendMove");
  expectMainlineSans(updated, ["Nf3", "Nc6", "--"]);
});

test("appendMove — null after black does not insert duplicate white move number", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n3. h5 Ne3 4. Kg5 *");
  const ne3 = model.root.entries.find(isMoveWithSan("Ne3")) as PgnMoveNode;
  const cursor: PgnCursor = findCursorForMoveId(model, ne3.id) as PgnCursor;
  const [updated] = appendMove(model, cursor, "--");
  expectContractModelInvariantSafe(updated, "appendMove");
  expectMainlineMoveNumbers(updated, ["3.", "4."]);
  expectMainlineSans(updated, ["h5", "Ne3", "--", "Kg5"]);
});

test("appendMove — null after black handles glued move-number format (3.h5)", () => {
  // PGN with no space between move number and SAN ("3.h5" instead of "3. h5").
  // The tokenizer splits these, so the model should be equivalent to the spaced form.
  const model = parsePgnToModel("[Event \"?\"]\n\n3.h5 Ne3 4.Kg5 *");
  const ne3 = model.root.entries.find(isMoveWithSan("Ne3")) as PgnMoveNode;
  const cursor: PgnCursor = findCursorForMoveId(model, ne3.id) as PgnCursor;
  const [updated] = appendMove(model, cursor, "--");
  expectContractModelInvariantSafe(updated, "appendMove");
  expectMainlineMoveNumbers(updated, ["3.", "4."]);
  expectMainlineSans(updated, ["h5", "Ne3", "--", "Kg5"]);
});

// ── replaceMove ────────────────────────────────────────────────────────────────

test("replaceMove — replaces the first move and removes following moves", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const firstMoveEntry = model.root.entries.find(isMoveEntry);
  const cursor: PgnCursor = rootCursor(model);
  const [updated] = replaceMove(model, cursor, "d4");
  expectContractModelInvariantSafe(updated, "replaceMove");
  const sans = mainlineSans(updated);
  assert.equal(sans[0], "d4");
  assert.equal(sans.length, 1);
  // Original is unchanged.
  assert.equal(mainlineSans(model)[0], firstMoveEntry?.san);
});

// ── truncateAfter ──────────────────────────────────────────────────────────────

test("truncateAfter — removes the cursor move and everything after it", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 Nc6 *");
  const e5Entry = model.root.entries.filter(isMoveEntry)[1];
  assert.ok(e5Entry);
  const cursor: PgnCursor = { moveId: e5Entry.id, variationId: model.root.id };
  const [updated] = truncateAfter(model, cursor);
  expectContractModelInvariantSafe(updated, "truncateAfter");
  const sans = mainlineSans(updated);
  assert.deepEqual(sans, ["e4"]);
});

test("truncateAfter — does not mutate the original", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor = lastMainlineCursor(model);
  truncateAfter(model, cursor);
  assert.equal(mainlineSans(model).length, 2);
});

test("deleteSingleMove — removes only the targeted move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. Nf3 -- Nc6 *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  const sans = mainlineSans(updated);
  assert.deepEqual(sans, ["Nf3", "Nc6"]);
});

test("deleteSingleMove — removes dangling move-number after deleting inserted null move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. Nf3 Nc6 2. -- *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Nf3", "Nc6"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["1."]);
});

test("deleteSingleMove — promotes sole null-move continuation variation into mainline", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. Nf3 -- (1... Nc6) *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Nf3", "Nc6"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["1."]);
});

test("deleteSingleMove — removes duplicate white move-number after null move removal", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n3... Ne3 4. -- 4. Kg5 *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Ne3", "Kg5"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["3...", "4."]);
});

test("deleteSingleMove — merges null continuation without leaving split black move number", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n4... Nc4 5. h6 -- (5... Ne5 6. h7 Nf7+ 7. Kg6 Nh8+ 8. Kg7) *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Nc4", "h6", "Ne5", "h7", "Nf7+", "Kg6", "Nh8+", "Kg7"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["4...", "5.", "6.", "7.", "8."]);
});

test("deleteSingleMove — strips continuation move-number even when continuation starts with comment", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n4... Nc4 5. h6 -- ({x} 5... Ne5 6. h7) *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Nc4", "h6", "Ne5", "h7"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["4...", "5.", "6."]);
});

test("deleteSingleMove — mainline after null: joins half-moves (no duplicate black number)", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n4... Nc4 5. h6 -- 5... Ne5 *");
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Nc4", "h6", "Ne5"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["4...", "5."]);
});

test("deleteSingleMove — Unicode black move number after null is merged away", () => {
  const ellipsis = "\u2026";
  const model = parsePgnToModel(`[Event "?"]\n\n4... Nc4 5. h6 -- 5${ellipsis} Ne5 *`);
  const nullMove = model.root.entries.find(isMoveWithSan("--")) as PgnMoveNode;
  const [updated] = deleteSingleMove(model, nullMove.id);
  expectContractModelInvariantSafe(updated, "deleteSingleMove");
  assert.deepEqual(mainlineSans(updated), ["Nc4", "h6", "Ne5"]);
  assert.deepEqual(mainlineMoveNumbers(updated), ["4...", "5."]);
});

// ── truncateBefore ─────────────────────────────────────────────────────────────

test("truncateBefore — removes all moves before the cursor move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 Nc6 *");
  const nf3Entry = model.root.entries.filter(isMoveEntry)[2];
  assert.ok(nf3Entry);
  const cursor: PgnCursor = { moveId: nf3Entry.id, variationId: model.root.id };
  const [updated] = truncateBefore(model, cursor);
  expectContractModelInvariantSafe(updated, "truncateBefore");
  const sans = mainlineSans(updated);
  assert.deepEqual(sans, ["Nf3", "Nc6"]);
});

// ── insertVariation ────────────────────────────────────────────────────────────

test("insertVariation — adds a RAV after the cursor move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4Entry = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: model.root.id };
  const [updated, newCursor] = insertVariation(model, cursor, "d5");
  expectContractModelInvariantSafe(updated, "insertVariation");
  expectContractCursorTargetsExistingMove(updated, newCursor, "insertVariation");

  const e4InUpdated = updated.root.entries.find(
    isMoveWithSan(e4Entry.san),
  ) as PgnMoveNode;
  assert.equal(getMoveRavs(e4InUpdated).length, 1);
  const ravFirstMove = findFirstMoveInEntries(getMoveRavs(e4InUpdated)[0].entries);
  assert.equal(ravFirstMove.san, "d5");
});

test("insertVariation — invalid move cursor is a no-op", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor: PgnCursor = { moveId: "missing-move", variationId: model.root.id };
  const [updated, nextCursor] = insertVariation(model, cursor, "d5");
  assert.equal(updated, model);
  assert.deepEqual(nextCursor, cursor);
});

test("insertVariation — attaches RAV to first move when cursor is at root", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const [result] = insertVariation(model, rootCursor(model), "d4");
  expectContractModelInvariantSafe(result, "insertVariation");
  // d4 becomes a RAV on e4 (alternative to the first move).
  const e4 = result.root.entries.find(isMoveWithSan("e4")) as PgnMoveNode;
  assert.equal(getMoveRavs(e4).length, 1);
  const ravMove = findFirstMoveInEntries(getMoveRavs(e4)[0].entries);
  assert.equal(ravMove.san, "d4");
  // Mainline is unchanged.
  assert.deepEqual(mainlineSans(result), ["e4", "e5", "Nf3"]);
});

test("insertVariation — RAV at root cursor gets white move number prepended", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const [result] = insertVariation(model, rootCursor(model), "d4");
  expectContractModelInvariantSafe(result, "insertVariation");
  const e4 = result.root.entries.find(isMoveWithSan("e4"));
  assert.ok(e4);
  const ravEntries = getMoveRavs(e4)[0].entries;
  // First entry must be the white move number "1.".
  assert.equal(ravEntries[0]?.type, "move_number");
  assert.equal((ravEntries[0] as { text: string }).text, "1.");
});

test("insertVariation — black-turn RAV gets black move number prepended", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e5Entry = model.root.entries.find(isMoveWithSan("e5")) as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e5Entry.id, variationId: model.root.id };
  const [updated] = insertVariation(model, cursor, "c5");
  expectContractModelInvariantSafe(updated, "insertVariation");

  const e5InUpdated = updated.root.entries.find(isMoveWithId(e5Entry.id)) as PgnMoveNode;
  assert.equal(getMoveRavs(e5InUpdated).length, 1);
  const ravEntries = getMoveRavs(e5InUpdated)[0].entries;
  assert.equal(ravEntries[0]?.type, "move_number");
  assert.equal((ravEntries[0] as { text: string }).text, "1...");
  const ravMove = ravEntries.find(isMoveEntry) as PgnMoveNode;
  assert.equal(ravMove.san, "c5");
});

test("insertVariation — black-turn RAV is attached to the black move, not the preceding white move", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const e4Entry = model.root.entries.find(isMoveWithSan("e4")) as PgnMoveNode;
  const e5Entry = model.root.entries.find(isMoveWithSan("e5")) as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e5Entry.id, variationId: model.root.id };
  const [updated] = insertVariation(model, cursor, "c5");
  expectContractModelInvariantSafe(updated, "insertVariation");

  const e4Updated = updated.root.entries.find(isMoveWithId(e4Entry.id)) as PgnMoveNode;
  const e5Updated = updated.root.entries.find(isMoveWithId(e5Entry.id)) as PgnMoveNode;
  assert.equal(getMoveRavs(e4Updated).length, 0, "white move should have no RAVs");
  assert.equal(getMoveRavs(e5Updated).length, 1, "black move should carry the RAV");
  // Mainline is unchanged.
  assert.deepEqual(mainlineSans(updated), ["e4", "e5"]);
});

test("insertVariation — sibling RAVs on nested black move keep fullmove number", () => {
  const model = parsePgnToModel(
    "[Event \"?\"]\n\n1. d4 d5 2. c4 e6 3. cxd5 (3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 h6 7. Bh4 Be7 8. Bd3 O-O 9. Qc2 Re8 10. Nge2 Qc7) *",
  );

  const findMoveBySan = (variation: PgnVariationNode, san: string): PgnMoveNode | null => {
    for (const entry of variation.entries) {
      if (entry.type !== "move") continue;
      const move: PgnMoveNode = entry;
      if (move.san === san) return move;
      for (const rav of getMoveRavs(move)) {
        const found: PgnMoveNode | null = findMoveBySan(rav, san);
        if (found) return found;
      }
    }
    return null;
  };

  const qc7 = findMoveBySan(model.root, "Qc7");
  assert.ok(qc7, "expected to find nested move 10... Qc7");
  const cursor: PgnCursor = findCursorForMoveId(model, qc7.id) as PgnCursor;

  const [withFirst] = insertVariation(model, cursor, "Qd7");
  const cursorAfterFirst: PgnCursor = findCursorForMoveId(withFirst, qc7.id) as PgnCursor;
  const [withSecond] = insertVariation(withFirst, cursorAfterFirst, "Qd6");
  expectContractModelInvariantSafe(withSecond, "insertVariation");

  const qc7Updated = findMoveBySan(withSecond.root, "Qc7");
  assert.ok(qc7Updated, "expected to find nested move after insertions");
  const ravs = getMoveRavs(qc7Updated);
  assert.equal(ravs.length, 2);

  const firstPrefix = ravs[0].entries[0];
  const secondPrefix = ravs[1].entries[0];
  assert.equal(firstPrefix?.type, "move_number");
  assert.equal(secondPrefix?.type, "move_number");
  assert.equal((firstPrefix as { text: string }).text, "10...");
  assert.equal((secondPrefix as { text: string }).text, "10...");
});

test("insertVariation — inserts black move number in mainline after root-cursor RAV", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const [result] = insertVariation(model, rootCursor(model), "d4");
  expectContractModelInvariantSafe(result, "insertVariation");
  // After e4 (white's move), the continuation e5 needs "1..." prepended.
  const moveNumbers = mainlineMoveNumbers(result);
  assert.ok(moveNumbers.includes("1..."), `expected "1..." in ${JSON.stringify(moveNumbers)}`);
});

test("appendMove — appending mainline black reply after a RAV inserts black move number", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n3. Rb7+ *");
  const rb7 = base.root.entries.find(isMoveWithSan("Rb7+")) as PgnMoveNode;
  const [withRav] = insertVariation(base, { moveId: rb7.id, variationId: base.root.id }, "Rg8+");
  expectContractModelInvariantSafe(withRav, "insertVariation");

  const rb7InUpdated = withRav.root.entries.find(isMoveWithId(rb7.id)) as PgnMoveNode;
  const cursor: PgnCursor = { moveId: rb7InUpdated.id, variationId: withRav.root.id };
  const [updated] = appendMove(withRav, cursor, "Kg6");
  expectContractModelInvariantSafe(updated, "appendMove");

  const numbers = mainlineMoveNumbers(updated);
  assert.ok(numbers.includes("3..."), `expected "3..." after RAV, got ${JSON.stringify(numbers)}`);
  assert.deepEqual(mainlineSans(updated).slice(-2), ["Rb7+", "Kg6"]);
});

test("appendMove — nested black-turn variation continuation inserts white move number", () => {
  const model = parsePgnToModel(
    "[Event \"?\"]\n\n1. d4 d5 2. c4 e6 3. cxd5 exd5 4. Nc3 c6 5. Nf3 Nf6 *",
  );
  const nf6 = model.root.entries.find(isMoveWithSan("Nf6")) as PgnMoveNode;
  const cursorAtNf6: PgnCursor = { moveId: nf6.id, variationId: model.root.id };
  const [withVariation, varCursor] = insertVariation(model, cursorAtNf6, "Bd6");
  const [withBg5, bg5Cursor] = appendMove(withVariation, varCursor, "Bg5");
  const [updated] = appendMove(withBg5, bg5Cursor, "Ne7");
  expectContractModelInvariantSafe(updated, "appendMove");

  const nf6Updated = updated.root.entries.find(isMoveWithId(nf6.id)) as PgnMoveNode;
  const rav = getMoveRavs(nf6Updated)[0];
  const moveNumbers = rav.entries
    .filter((entry): entry is PgnMoveNumberNode => entry.type === "move_number")
    .map((entry) => entry.text);
  assert.deepEqual(moveNumbers, ["5...", "6."]);
  const ravMoves = rav.entries.filter(isMoveEntry) as PgnMoveNode[];
  assert.deepEqual(ravMoves.map((move) => move.san), ["Bd6", "Bg5", "Ne7"]);
});

// ── deleteVariation ────────────────────────────────────────────────────────────

test("deleteVariation — removes a RAV from its parent move", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4Entry = base.root.entries.find(isMoveEntry) as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: base.root.id };
  const [withVariation] = insertVariation(base, cursor, "d5");

  const e4InModel = withVariation.root.entries.find(isMoveWithId(e4Entry.id)) as PgnMoveNode;
  const ravId = getMoveRavs(e4InModel)[0].id;
  const ravCursor: PgnCursor = { moveId: null, variationId: ravId };

  const [deleted] = deleteVariation(withVariation, ravCursor);
  expectContractModelInvariantSafe(deleted, "deleteVariation");
  const e4After = deleted.root.entries.find(isMoveWithId(e4Entry.id)) as PgnMoveNode;
  assert.equal(getMoveRavs(e4After).length, 0);
});

test("deleteVariation — root variation cursor is a no-op returning null cursor", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const [updated, nextCursor] = deleteVariation(model, rootCursor(model));
  assert.equal(updated, model);
  assert.equal(nextCursor, null);
});

// ── swapSiblingVariations ─────────────────────────────────────────────────────

test("swapSiblingVariations — swaps RAV order under the same parent move", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const e4: PgnMoveNode = findMainlineMoveBySan(base, "e4");
  const cursor: PgnCursor = { moveId: e4.id, variationId: base.root.id };
  const [withFirstRav] = insertVariation(base, cursor, "d5");
  const [withTwoRavs] = insertVariation(withFirstRav, cursor, "c5");
  const e4Before = findMainlineMoveBySan(withTwoRavs, "e4");
  const [firstBefore, secondBefore] = getMoveRavs(e4Before);
  const firstBeforeSan = findFirstMoveInEntries(firstBefore.entries).san;
  const secondBeforeSan = findFirstMoveInEntries(secondBefore.entries).san;
  assert.deepEqual([firstBeforeSan, secondBeforeSan], ["d5", "c5"]);

  const swapped = swapSiblingVariations(withTwoRavs, firstBefore.id, secondBefore.id);
  expectContractModelInvariantSafe(swapped, "swapSiblingVariations");

  const e4After = findMainlineMoveBySan(swapped, "e4");
  const [firstAfter, secondAfter] = getMoveRavs(e4After);
  const firstAfterSan = findFirstMoveInEntries(firstAfter.entries).san;
  const secondAfterSan = findFirstMoveInEntries(secondAfter.entries).san;
  assert.deepEqual([firstAfterSan, secondAfterSan], ["c5", "d5"]);
});

test("swapSiblingVariations — different parents is a no-op", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const e4: PgnMoveNode = findMainlineMoveBySan(base, "e4");
  const e5: PgnMoveNode = findMainlineMoveBySan(base, "e5");
  const [withE4Rav] = insertVariation(base, { moveId: e4.id, variationId: base.root.id }, "d5");
  const [withBothRavs] = insertVariation(withE4Rav, { moveId: e5.id, variationId: base.root.id }, "c5");
  const e4After = findMainlineMoveBySan(withBothRavs, "e4");
  const e5After = findMainlineMoveBySan(withBothRavs, "e5");
  const e4Rav = getMoveRavs(e4After)[0];
  const e5Rav = getMoveRavs(e5After)[0];

  const unchanged = swapSiblingVariations(withBothRavs, e4Rav.id, e5Rav.id);
  assert.equal(unchanged, withBothRavs);
});

// ── findCursorForMoveId ────────────────────────────────────────────────────────

test("findCursorForMoveId — returns null for unknown id", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor = findCursorForMoveId(model, "nonexistent");
  assert.equal(cursor, null);
});

test("findCursorForMoveId — finds a move in the mainline", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const e4Entry = model.root.entries.find(isMoveEntry) as PgnMoveNode;
  const cursor = findCursorForMoveId(model, e4Entry.id);
  assert.notEqual(cursor, null);
  assert.equal(cursor?.moveId, e4Entry.id);
  assert.equal(cursor?.variationId, model.root.id);
});

// ── promoteToMainline ──────────────────────────────────────────────────────────

test("promoteToMainline — moves the RAV move to become mainline response", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4Entry = base.root.entries.find(isMoveEntry) as PgnMoveNode;
  const cursor: PgnCursor = { moveId: e4Entry.id, variationId: base.root.id };
  const [withVariation] = insertVariation(base, cursor, "d5");

  const e4InModel = withVariation.root.entries.find(isMoveWithId(e4Entry.id)) as PgnMoveNode;
  const ravId = getMoveRavs(e4InModel)[0].id;
  const d5Move = findFirstMoveInEntries(getMoveRavs(e4InModel)[0].entries);
  const ravCursor: PgnCursor = { moveId: d5Move.id, variationId: ravId };

  const [promoted, nextCursor] = promoteToMainline(withVariation, ravCursor);
  expectContractModelInvariantSafe(promoted, "promoteToMainline");
  expectContractCursorTargetsExistingMove(promoted, nextCursor, "promoteToMainline");
  const sans = mainlineSans(promoted);
  assert.equal(sans[0], "e4");
  assert.equal(sans[1], "d5");
});

test("promoteToMainline — root variation cursor is a no-op", () => {
  const model = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 *");
  const cursor = rootCursor(model);
  const [updated, nextCursor] = promoteToMainline(model, cursor);
  assert.equal(updated, model);
  assert.deepEqual(nextCursor, cursor);
});

// ── deleteVariationsAfter ───────────────────────────────────────────────────────

test("deleteVariationsAfter — clears ravs from cursor move onward", () => {
  const base = parsePgnToModel("[Event \"?\"]\n\n1. e4 e5 2. Nf3 *");
  const e4: PgnMoveNode = findMainlineMoveBySan(base, "e4");
  const e5: PgnMoveNode = findMainlineMoveBySan(base, "e5");
  const [withFirstRav] = insertVariation(base, { moveId: e4.id, variationId: base.root.id }, "d4");
  const [withTwoRavs] = insertVariation(withFirstRav, { moveId: e5.id, variationId: base.root.id }, "c5");
  const [updated] = deleteVariationsAfter(withTwoRavs, { moveId: e5.id, variationId: withTwoRavs.root.id });
  expectContractModelInvariantSafe(updated, "deleteVariationsAfter");
  const updatedE4: PgnMoveNode = findMainlineMoveBySan(updated, "e4");
  const updatedE5: PgnMoveNode = findMainlineMoveBySan(updated, "e5");
  assert.equal(getMoveRavs(updatedE4).length, 1);
  assert.equal(getMoveRavs(updatedE5).length, 0);
});
