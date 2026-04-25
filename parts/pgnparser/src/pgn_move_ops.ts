/**
 * pgn_move_ops — PGN model mutation operations for move entry and editing.
 *
 * Integration API:
 * - Exports: `PgnCursor`, `appendMove`, `insertVariation`, `replaceMove`,
 *   `truncateAfter`, `truncateBefore`, `deleteVariation`,
 *   `deleteVariationsAfter`, `promoteToMainline`, `swapSiblingVariations`, `findCursorForMoveId`,
 *   `findMoveSideById`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure functions; all return a new `PgnModel` (does not mutate the input).
 * - `PgnCursor` identifies a position within the model by move ID.
 *
 * Operation-level contracts:
 * - `appendMove`:
 *   - Preconditions: `cursor.variationId` must resolve; when `cursor.moveId` is set, that move
 *     must exist inside the resolved variation.
 *   - Postconditions: returned cursor points at the newly appended move; model invariants hold.
 * - `insertVariation`:
 *   - Preconditions: target variation must resolve; when inserting from non-root cursor, cursor move
 *     must exist; when inserting from root cursor, target variation must contain a first move.
 *   - Postconditions: returned cursor points at first move of created variation; model invariants hold.
 * - `replaceMove`:
 *   - Preconditions: `cursor.variationId` must resolve; when `cursor.moveId` is set, that move
 *     must exist inside the resolved variation.
 *   - Postconditions: returned cursor points at replacement move; model invariants hold.
 * - `truncateAfter`:
 *   - Preconditions: when `cursor.moveId` is set, cursor variation must resolve and contain cursor move.
 *   - Postconditions: returned cursor references previous move or `null`; model invariants hold.
 * - `truncateBefore`:
 *   - Preconditions: operation only applies in root variation and requires non-null `cursor.moveId`.
 *   - Postconditions: returned cursor unchanged when operation applies; model invariants hold.
 * - `deleteVariation`:
 *   - Preconditions: cursor variation must be non-root and parent move must be resolvable.
 *   - Postconditions: returned cursor points at parent move; model invariants hold.
 * - `promoteToMainline`:
 *   - Preconditions: cursor variation must be non-root, cursor move must be non-null and resolvable.
 *   - Postconditions: returned cursor keeps same `moveId` now in parent variation; model invariants hold.
 * - `deleteVariationsAfter`:
 *   - Preconditions: cursor variation must resolve; when `cursor.moveId` is set, variation must contain it.
 *   - Postconditions: all RAVs on/after cursor in that variation are removed; model invariants hold.
 * - `swapSiblingVariations`:
 *   - Preconditions: both variation IDs must resolve to non-root variations with the same parent move.
 *   - Postconditions: sibling order is swapped under the parent move; model invariants hold.
 */

import type {
  PgnModel,
  PgnVariationNode,
  PgnEntryNode,
  PgnMoveNode,
} from "./pgn_model";
import { assertPgnModelInvariants } from "./pgn_invariants";
import {
  insertBlackMoveNumberAfterRav,
  insertBlackMoveNumberBeforeRavContinuation,
  maybeInsertNestedVariationWhiteMoveNumber,
  maybeInsertMoveNumber,
  normalizeAfterNullMoveRemoval,
  prependMoveNumberToRav,
} from "./pgn_move_numbering";
import { appendMoveRav, clearMoveRavs, getMoveRavs, removeMoveRavById } from "./pgn_move_attachments";
import { getHeaderValue } from "./pgn_headers";

// ── Cursor type ───────────────────────────────────────────────────────────────

/** A cursor pointing to a specific move in a PGN model. */
export type PgnCursor = {
  /** ID of the move node this cursor points to. Null = root (before any move). */
  moveId: string | null;
  /** ID of the variation containing the cursor move. */
  variationId: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

// structuredClone preserves shared references within the object graph.
const cloneModel = <T>(value: T): T => structuredClone(value);
const finalizeMutation = (model: PgnModel, context: string): PgnModel =>
  assertPgnModelInvariants(model, context);
const assertContract = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`pgn_move_ops contract violated: ${message}`);
};

let _idCounter = 1_000_000; // Start high to avoid collision with parser IDs.
const nextId = (prefix: string): string => `${prefix}_op${++_idCounter}`;

const makeMoveNode = (san: string): PgnMoveNode => ({
  id: nextId("move"),
  type: "move",
  san,
  nags: [],
  commentsBefore: [],
  postItems: [],
});


const makeVariationNode = (
  depth: number,
  parentMoveId: string | null,
): PgnVariationNode => ({
  id: nextId("variation"),
  type: "variation",
  depth,
  parentMoveId,
  entries: [],
  trailingComments: [],
});


/**
 * Walk all variations in depth-first order, calling `visitor` on each.
 * Return `true` from `visitor` to stop traversal.
 */
const walkVariations = (
  variation: PgnVariationNode,
  visitor: (v: PgnVariationNode) => boolean,
): boolean => {
  if (visitor(variation)) return true;
  for (const entry of variation.entries) {
    if (entry.type === "move") {
      for (const rav of getMoveRavs(entry as PgnMoveNode)) {
        if (walkVariations(rav, visitor)) return true;
      }
    }
    if (entry.type === "variation") {
      if (walkVariations(entry as PgnVariationNode, visitor)) return true;
    }
  }
  return false;
};

/**
 * Find the variation containing `moveId`, and the index of that move within
 * its `entries`. Returns `null` if not found.
 */
const locateMove = (
  model: PgnModel,
  moveId: string,
): { variation: PgnVariationNode; index: number } | null => {
  let found: { variation: PgnVariationNode; index: number } | null = null;
  walkVariations(model.root, (v: PgnVariationNode): boolean => {
    const idx = v.entries.findIndex(
      (e: PgnEntryNode): boolean => e.type === "move" && e.id === moveId,
    );
    if (idx !== -1) {
      found = { variation: v, index: idx };
      return true;
    }
    return false;
  });
  return found;
};

/**
 * Find the variation with `variationId`. Returns `null` if not found.
 */
const locateVariation = (
  model: PgnModel,
  variationId: string,
): PgnVariationNode | null => {
  let found: PgnVariationNode | null = null;
  walkVariations(model.root, (v: PgnVariationNode): boolean => {
    if (v.id === variationId) { found = v; return true; }
    return false;
  });
  return found;
};

const assertCursorMoveMatchesVariation = (
  variation: PgnVariationNode,
  cursor: PgnCursor,
  operation: string,
): void => {
  if (!cursor.moveId) return;
  const foundInVariation: boolean = variation.entries.some(
    (entry: PgnEntryNode): boolean => entry.type === "move" && entry.id === cursor.moveId,
  );
  assertContract(
    foundInVariation,
    `${operation} precondition: cursor moveId="${cursor.moveId}" must exist in variation "${variation.id}"`,
  );
};

const assertCursorTargetsExistingMove = (
  model: PgnModel,
  cursor: PgnCursor,
  operation: string,
): void => {
  assertContract(
    cursor.moveId !== null,
    `${operation} postcondition: returned cursor must reference a move (non-null moveId)`,
  );
  const moveId: string = cursor.moveId ?? "";
  const moveExists: boolean = !!findMoveNode(model, moveId);
  assertContract(
    moveExists,
    `${operation} postcondition: returned cursor moveId="${moveId}" must reference an existing move`,
  );
};

/** True when `entries` contains at least one move node. */
const hasMoveEntry = (entries: PgnEntryNode[]): boolean =>
  entries.some((entry: PgnEntryNode): boolean => entry.type === "move");


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a cursor for the given move ID within the model.
 * Returns null if the move ID is not found.
 */
export const findCursorForMoveId = (
  model: PgnModel,
  moveId: string,
): PgnCursor | null => {
  const loc = locateMove(model, moveId);
  if (!loc) return null;
  return { moveId, variationId: loc.variation.id };
};

/**
 * Find the `PgnMoveNode` with `moveId` in `model`.
 * Returns `null` if no such move exists (e.g. the model has been replaced).
 *
 * @param model  - The PGN model to search.
 * @param moveId - The move node's `id` field.
 */
export const findMoveNode = (
  model: PgnModel,
  moveId: string,
): PgnMoveNode | null => {
  const loc = locateMove(model, moveId);
  if (!loc) return null;
  const entry = loc.variation.entries[loc.index];
  return entry?.type === "move" ? (entry as PgnMoveNode) : null;
};

/**
 * Append a new move (by SAN) at the end of the variation containing the
 * cursor's move. If `cursor.moveId` is null, appends to the root variation.
 *
 * Returns `[updatedModel, newCursor]`.
 */
export const appendMove = (
  model: PgnModel,
  cursor: PgnCursor,
  san: string,
): [PgnModel, PgnCursor] => {
  const cloned = cloneModel(model);
  const variation = locateVariation(cloned, cursor.variationId);
  if (!variation) return [model, cursor];
  assertCursorMoveMatchesVariation(variation, cursor, "appendMove");

  const newMove = makeMoveNode(san);
  // Find insertion point: after cursor.moveId within the variation.
  if (cursor.moveId) {
    const idx = variation.entries.findIndex(
      (e) => e.type === "move" && e.id === cursor.moveId,
    );
    if (idx !== -1) {
      let insertIdx = idx + 1;
      insertIdx = maybeInsertMoveNumber(cloned, variation, variation.entries, insertIdx, (): string => nextId("move_number"));
      insertIdx = maybeInsertNestedVariationWhiteMoveNumber(
        variation,
        variation.entries,
        insertIdx,
        (): string => nextId("move_number"),
      );
      const parentEntry = variation.entries[idx];
      const parentMove: PgnMoveNode | null = parentEntry?.type === "move" ? (parentEntry as PgnMoveNode) : null;
      const hasRavChildren: boolean = !!parentMove && getMoveRavs(parentMove).length > 0;
      if (hasRavChildren) {
        insertBlackMoveNumberBeforeRavContinuation(
          cloned,
          variation,
          idx,
          insertIdx,
          (): string => nextId("move_number"),
        );
        insertIdx += 1;
      }
      variation.entries.splice(insertIdx, 0, newMove);
    } else {
      variation.entries.push(newMove);
    }
  } else {
    // Insert before any trailing result token so the serialised PGN stays
    // parseable (a freshly-created game has a result node as the only entry).
    const resultIdx = variation.entries.findIndex((e) => e.type === "result");
    let insertIdx = resultIdx !== -1 ? resultIdx : variation.entries.length;
    insertIdx = maybeInsertMoveNumber(cloned, variation, variation.entries, insertIdx, (): string => nextId("move_number"));
    variation.entries.splice(insertIdx, 0, newMove);
  }

  const finalizedModel: PgnModel = finalizeMutation(cloned, "appendMove");
  const nextCursor: PgnCursor = { moveId: newMove.id, variationId: variation.id };
  assertCursorTargetsExistingMove(finalizedModel, nextCursor, "appendMove");
  return [finalizedModel, nextCursor];
};

/**
 * Insert the given move as a new RAV (variation) immediately after the cursor
 * move. The new variation is attached to the cursor move as a child RAV.
 *
 * Returns `[updatedModel, newCursor]` where cursor points to the new move.
 */
export const insertVariation = (
  model: PgnModel,
  cursor: PgnCursor,
  san: string,
): [PgnModel, PgnCursor] => {
  if (!cursor.moveId) {
    // At root: attach the RAV to the first move in the variation so the
    // new line appears as an alternative to that first move in the PGN text.
    const cloned = cloneModel(model);
    const variation = locateVariation(cloned, cursor.variationId);
    if (!variation) return [model, cursor];
    assertCursorMoveMatchesVariation(variation, cursor, "insertVariation");
    const firstMoveIdx = variation.entries.findIndex((e) => e.type === "move");
    if (firstMoveIdx === -1) return [model, cursor];
    const firstMove = variation.entries[firstMoveIdx] as PgnMoveNode;
    const childVar = makeVariationNode(variation.depth + 1, firstMove.id);
    const newMove = makeMoveNode(san);
    childVar.entries.push(newMove);
    prependMoveNumberToRav(cloned, variation, firstMoveIdx, childVar, (): string => nextId("move_number"));
    appendMoveRav(firstMove, childVar);
    insertBlackMoveNumberAfterRav(cloned, variation, firstMoveIdx, (): string => nextId("move_number"));
    const finalizedModel: PgnModel = finalizeMutation(cloned, "insertVariation");
    const nextCursor: PgnCursor = { moveId: newMove.id, variationId: childVar.id };
    assertCursorTargetsExistingMove(finalizedModel, nextCursor, "insertVariation");
    return [finalizedModel, nextCursor];
  }

  const cloned = cloneModel(model);
  const loc = locateMove(cloned, cursor.moveId);
  if (!loc) return [model, cursor];
  assertCursorMoveMatchesVariation(loc.variation, cursor, "insertVariation");

  const parentMove = loc.variation.entries[loc.index] as PgnMoveNode;
  const childVar = makeVariationNode(loc.variation.depth + 1, parentMove.id);
  const newMove = makeMoveNode(san);
  childVar.entries.push(newMove);
  prependMoveNumberToRav(cloned, loc.variation, loc.index, childVar, (): string => nextId("move_number"));
  appendMoveRav(parentMove, childVar);
  insertBlackMoveNumberAfterRav(cloned, loc.variation, loc.index, (): string => nextId("move_number"));

  const finalizedModel: PgnModel = finalizeMutation(cloned, "insertVariation");
  const nextCursor: PgnCursor = { moveId: newMove.id, variationId: childVar.id };
  assertCursorTargetsExistingMove(finalizedModel, nextCursor, "insertVariation");
  return [finalizedModel, nextCursor];
};

/**
 * Replace the move AFTER the cursor position (i.e., the next move in the same
 * variation) with a new move. The replaced move and all its descendants in the
 * current line are removed.
 *
 * If there is no next move, this behaves like `appendMove`.
 *
 * Returns `[updatedModel, newCursor]`.
 */
export const replaceMove = (
  model: PgnModel,
  cursor: PgnCursor,
  san: string,
): [PgnModel, PgnCursor] => {
  const cloned = cloneModel(model);
  const variation = locateVariation(cloned, cursor.variationId);
  if (!variation) return [model, cursor];
  assertCursorMoveMatchesVariation(variation, cursor, "replaceMove");

  const newMove = makeMoveNode(san);

  if (cursor.moveId) {
    const idx = variation.entries.findIndex(
      (e) => e.type === "move" && e.id === cursor.moveId,
    );
    if (idx !== -1 && idx + 1 < variation.entries.length) {
      // Replace everything from idx+1 onward with just the new move.
      variation.entries.splice(idx + 1, variation.entries.length - idx - 1, newMove);
    } else {
      variation.entries.push(newMove);
    }
  } else {
    // Replace from the very beginning.
    variation.entries.splice(0, variation.entries.length, newMove);
  }

  const finalizedModel: PgnModel = finalizeMutation(cloned, "replaceMove");
  const nextCursor: PgnCursor = { moveId: newMove.id, variationId: variation.id };
  assertCursorTargetsExistingMove(finalizedModel, nextCursor, "replaceMove");
  return [finalizedModel, nextCursor];
};

/**
 * Remove the move at `cursor.moveId` and all subsequent entries in the same
 * variation. Entries before the cursor move are preserved.
 *
 * Returns `[updatedModel, newCursor]` pointing to the move before the removed
 * one (or the root if no preceding move exists).
 */
export const truncateAfter = (
  model: PgnModel,
  cursor: PgnCursor,
): [PgnModel, PgnCursor | null] => {
  if (!cursor.moveId) return [model, null];
  const cloned = cloneModel(model);
  const variation = locateVariation(cloned, cursor.variationId);
  if (!variation) return [model, cursor];
  assertCursorMoveMatchesVariation(variation, cursor, "truncateAfter");
  const loc = locateMove(cloned, cursor.moveId);
  if (!loc) return [model, cursor];

  // Find the preceding move ID (for the returned cursor).
  const prevMoveId: string | null = (() => {
    for (let i = loc.index - 1; i >= 0; i--) {
      if (loc.variation.entries[i].type === "move") {
        return (loc.variation.entries[i] as PgnMoveNode).id;
      }
    }
    return null;
  })();

  // Remove from loc.index onward.
  loc.variation.entries.splice(loc.index);

  const newCursor: PgnCursor | null = prevMoveId
    ? { moveId: prevMoveId, variationId: loc.variation.id }
    : null;

  return [finalizeMutation(cloned, "truncateAfter"), newCursor];
};

/**
 * Delete exactly one move identified by `moveId` while preserving surrounding
 * entries in the same variation.
 *
 * Returns `[updatedModel, newCursor]` where `newCursor` points to the previous
 * move in that variation (or null when none exists).
 */
export const deleteSingleMove = (
  model: PgnModel,
  moveId: string,
): [PgnModel, PgnCursor | null] => {
  const cloned = cloneModel(model);
  const loc = locateMove(cloned, moveId);
  if (!loc) return [model, null];

  const prevMoveId: string | null = (() => {
    for (let i = loc.index - 1; i >= 0; i -= 1) {
      if (loc.variation.entries[i].type === "move") {
        return (loc.variation.entries[i] as PgnMoveNode).id;
      }
    }
    return null;
  })();

  const targetEntry: PgnEntryNode | undefined = loc.variation.entries[loc.index];
  const targetMove: PgnMoveNode | null = targetEntry?.type === "move" ? targetEntry : null;
  const hasMainlineMoveAfterTarget: boolean = loc.variation.entries
    .slice(loc.index + 1)
    .some((entry: PgnEntryNode): boolean => entry.type === "move");
  const soleContinuation: PgnVariationNode | null =
    targetMove &&
    targetMove.san === "--" &&
    getMoveRavs(targetMove).length === 1 &&
    !hasMainlineMoveAfterTarget &&
    hasMoveEntry(getMoveRavs(targetMove)[0].entries)
      ? getMoveRavs(targetMove)[0]
      : null;

  if (soleContinuation) {
    // Promote the only null-move continuation RAV into the parent variation.
    loc.variation.entries.splice(loc.index, 1, ...soleContinuation.entries);
    normalizeAfterNullMoveRemoval(loc.variation, loc.index);
  } else {
    loc.variation.entries.splice(loc.index, 1);
    normalizeAfterNullMoveRemoval(loc.variation, loc.index);
  }

  return [
    finalizeMutation(cloned, "deleteSingleMove"),
    prevMoveId ? { moveId: prevMoveId, variationId: loc.variation.id } : null,
  ];
};

/**
 * Remove the entire variation containing `cursor.moveId` from its parent move's
 * RAV list. If the cursor is in the root variation, this is a no-op.
 *
 * Returns `[updatedModel, newCursor]` pointing to the parent move.
 */
export const deleteVariation = (
  model: PgnModel,
  cursor: PgnCursor,
): [PgnModel, PgnCursor | null] => {
  if (cursor.variationId === model.root.id) return [model, null]; // Cannot delete root.
  const cloned = cloneModel(model);
  const variation = locateVariation(cloned, cursor.variationId);
  if (!variation || !variation.parentMoveId) return [model, cursor];

  const parentLoc = locateMove(cloned, variation.parentMoveId);
  if (!parentLoc) return [model, cursor];
  assertContract(
    parentLoc.variation.entries[parentLoc.index]?.type === "move",
    `deleteVariation precondition: parent move "${variation.parentMoveId}" must be addressable`,
  );

  const parentMove = parentLoc.variation.entries[parentLoc.index] as PgnMoveNode;
  removeMoveRavById(parentMove, cursor.variationId);

  return [
    finalizeMutation(cloned, "deleteVariation"),
    { moveId: parentMove.id, variationId: parentLoc.variation.id },
  ];
};

/**
 * Remove all entries before `cursor.moveId` in the root variation.
 * The cursor move becomes the new start of the game.
 * Only operates when the cursor is in the root variation.
 *
 * If `fenAtCursor` is provided and differs from the standard starting FEN,
 * `[SetUp "1"]` and `[FEN "..."]` headers are set accordingly.
 *
 * Returns `[updatedModel, cursor]` (cursor is unchanged).
 */
export const truncateBefore = (
  model: PgnModel,
  cursor: PgnCursor,
  fenAtCursor?: string,
): [PgnModel, PgnCursor] => {
  if (!cursor.moveId) return [model, cursor];
  if (cursor.variationId !== model.root.id) return [model, cursor];

  const cloned = cloneModel(model);
  const rootVar = cloned.root;
  assertContract(
    cursor.variationId === rootVar.id,
    `truncateBefore precondition: cursor variation "${cursor.variationId}" must be root`,
  );
  const idx = rootVar.entries.findIndex(
    (e) => e.type === "move" && e.id === cursor.moveId,
  );
  if (idx <= 0) return [model, cursor]; // Nothing to remove.

  rootVar.entries.splice(0, idx);

  const STANDARD_START =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  if (fenAtCursor && fenAtCursor !== STANDARD_START) {
    const setupIdx = cloned.headers.findIndex((h) => h.key === "SetUp");
    const fenIdx = cloned.headers.findIndex((h) => h.key === "FEN");
    if (setupIdx >= 0) cloned.headers[setupIdx].value = "1";
    else cloned.headers.push({ key: "SetUp", value: "1" });
    if (fenIdx >= 0) cloned.headers[fenIdx].value = fenAtCursor;
    else cloned.headers.push({ key: "FEN", value: fenAtCursor });
  }

  return [finalizeMutation(cloned, "truncateBefore"), cursor];
};

/**
 * Promote the variation containing `cursor.moveId` to be the mainline.
 * The existing mainline continuation from the parent move is demoted to a
 * new variation attached to the parent move.
 *
 * If the cursor is already in the root variation this is a no-op.
 *
 * Returns `[updatedModel, newCursor]` pointing to the same move, now in
 * the parent variation.
 */
export const promoteToMainline = (
  model: PgnModel,
  cursor: PgnCursor,
): [PgnModel, PgnCursor] => {
  if (cursor.variationId === model.root.id) return [model, cursor];

  const cloned = cloneModel(model);
  const variation = locateVariation(cloned, cursor.variationId);
  if (!variation || !variation.parentMoveId) return [model, cursor];
  assertContract(
    !!cursor.moveId,
    "promoteToMainline precondition: cursor must reference a move inside promoted variation",
  );
  const cursorMoveId: string = cursor.moveId ?? "";
  assertContract(
    !!locateMove(cloned, cursorMoveId),
    `promoteToMainline precondition: cursor move "${cursor.moveId}" must exist`,
  );

  const parentLoc = locateMove(cloned, variation.parentMoveId);
  if (!parentLoc) return [model, cursor];

  const parentMove = parentLoc.variation.entries[parentLoc.index] as PgnMoveNode;

  // Save old mainline continuation.
  const oldContinuation = parentLoc.variation.entries.splice(
    parentLoc.index + 1,
  );

  // Replace mainline from parent move forward with variation's entries.
  parentLoc.variation.entries.push(...variation.entries);

  // Remove promoted variation from parent move's RAV list.
  removeMoveRavById(parentMove, variation.id);

  // Demote old mainline as a new variation (if it had moves).
  if (oldContinuation.some((e) => e.type === "move")) {
    const demoted = makeVariationNode(
      parentLoc.variation.depth + 1,
      parentMove.id,
    );
    demoted.entries = oldContinuation;
    appendMoveRav(parentMove, demoted, "start");
  }

  return [
    finalizeMutation(cloned, "promoteToMainline"),
    { moveId: cursor.moveId, variationId: parentLoc.variation.id },
  ];
};

/**
 * Swap two sibling variations that share the same parent move.
 *
 * Returns the unchanged model when either variation is missing, either one is
 * root, or both do not share the same parent.
 *
 * @param model - Source model.
 * @param variationIdA - First sibling variation ID.
 * @param variationIdB - Second sibling variation ID.
 * @returns Updated model with swapped sibling variation order.
 */
export const swapSiblingVariations = (
  model: PgnModel,
  variationIdA: string,
  variationIdB: string,
): PgnModel => {
  if (variationIdA === variationIdB) return model;

  const cloned: PgnModel = cloneModel(model);
  const variationA: PgnVariationNode | null = locateVariation(cloned, variationIdA);
  const variationB: PgnVariationNode | null = locateVariation(cloned, variationIdB);
  if (!variationA || !variationB) return model;
  if (!variationA.parentMoveId || !variationB.parentMoveId) return model;
  if (variationA.parentMoveId !== variationB.parentMoveId) return model;

  const parentLoc = locateMove(cloned, variationA.parentMoveId);
  if (!parentLoc) return model;
  const parentEntry: PgnEntryNode | undefined = parentLoc.variation.entries[parentLoc.index];
  if (!parentEntry || parentEntry.type !== "move") return model;

  const parentMove: PgnMoveNode = parentEntry;
  if (!Array.isArray(parentMove.postItems)) parentMove.postItems = [];
  const ravIndexes: number[] = [];
  for (let i = 0; i < parentMove.postItems.length; i += 1) {
    const item = parentMove.postItems[i];
    if (item.type !== "rav") continue;
    if (item.rav.id === variationIdA || item.rav.id === variationIdB) ravIndexes.push(i);
  }
  if (ravIndexes.length !== 2) return model;

  const firstIndex: number = ravIndexes[0];
  const secondIndex: number = ravIndexes[1];
  const firstItem = parentMove.postItems[firstIndex];
  parentMove.postItems[firstIndex] = parentMove.postItems[secondIndex];
  parentMove.postItems[secondIndex] = firstItem;

  return finalizeMutation(cloned, "swapSiblingVariations");
};

/**
 * Determine which side ("white" | "black") plays the move with `moveId`.
 *
 * The starting side is read from the `[FEN]` header field 2 (default "w" = white).
 * Ply index is computed by walking the tree from the root:
 * - Each move in a variation increments the ply counter.
 * - RAVs attached to move M start at the same ply as M (they replay from the
 *   position before M, so their first move is at M's ply).
 *
 * Returns `null` if `moveId` is not found in the model.
 *
 * @param model  - PGN model to search.
 * @param moveId - Target move node ID.
 */
export const findMoveSideById = (
  model: PgnModel,
  moveId: string,
): "white" | "black" | null => {
  const startSide: "white" | "black" =
    getHeaderValue(model, "FEN").trim().split(/\s+/)[1] === "b" ? "black" : "white";

  // Returns the 0-based ply index of moveId, or null.
  const findPly = (
    variation: PgnVariationNode,
    startPly: number,
  ): number | null => {
    let ply = startPly;
    for (const entry of variation.entries) {
      if (entry.type !== "move") continue;
      const move = entry as PgnMoveNode;
      if (move.id === moveId) return ply;
      // RAVs start from the same ply as the current move (before increment).
      for (const rav of getMoveRavs(move)) {
        const found = findPly(rav, ply);
        if (found !== null) return found;
      }
      ply++;
    }
    return null;
  };

  const ply = findPly(model.root, 0);
  if (ply === null) return null;
  const isWhiteStart = startSide === "white";
  return (ply % 2 === 0) === isWhiteStart ? "white" : "black";
};

/**
 * Remove all variations (RAVs) attached to moves at and after the cursor
 * position in the cursor's variation. Leaves mainline intact.
 *
 * Returns `[updatedModel, cursor]` (cursor is unchanged).
 */
export const deleteVariationsAfter = (
  model: PgnModel,
  cursor: PgnCursor,
): [PgnModel, PgnCursor] => {
  const cloned = cloneModel(model);
  const variation = locateVariation(cloned, cursor.variationId);
  if (!variation) return [model, cursor];
  assertCursorMoveMatchesVariation(variation, cursor, "deleteVariationsAfter");

  let inRange = cursor.moveId === null;
  for (const entry of variation.entries) {
    if (entry.type === "move") {
      const move = entry as PgnMoveNode;
      if (move.id === cursor.moveId) inRange = true;
      if (inRange) {
        clearMoveRavs(move);
      }
    }
  }

  return [finalizeMutation(cloned, "deleteVariationsAfter"), cursor];
};
