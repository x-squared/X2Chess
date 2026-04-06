/**
 * pgn_move_ops — PGN model mutation operations for move entry and editing.
 *
 * Integration API:
 * - Exports: `PgnCursor`, `appendMove`, `insertVariation`, `replaceMove`,
 *   `truncateAfter`, `truncateBefore`, `deleteVariation`,
 *   `deleteVariationsAfter`, `promoteToMainline`, `findCursorForMoveId`,
 *   `findMoveSideById`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure functions; all return a new `PgnModel` (does not mutate the input).
 * - `PgnCursor` identifies a position within the model by move ID.
 */

import type {
  PgnModel,
  PgnVariationNode,
  PgnEntryNode,
  PgnMoveNode,
} from "./pgn_model";

// ── Cursor type ───────────────────────────────────────────────────────────────

export type PgnCursor = {
  /** ID of the move node this cursor points to. Null = root (before any move). */
  moveId: string | null;
  /** ID of the variation containing the cursor move. */
  variationId: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const cloneModel = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let _idCounter = 1_000_000; // Start high to avoid collision with parser IDs.
const nextId = (prefix: string): string => `${prefix}_op${++_idCounter}`;

const makeMoveNode = (san: string): PgnMoveNode => ({
  id: nextId("move"),
  type: "move",
  san,
  nags: [],
  commentsBefore: [],
  commentsAfter: [],
  ravs: [],
  postItems: [],
});

/**
 * Count move nodes in `entries` before `upToIdx`.
 * Used to determine the ply of a new move being inserted.
 */
const countMovesBeforeIdx = (entries: PgnEntryNode[], upToIdx: number): number => {
  let count = 0;
  for (let i = 0; i < upToIdx && i < entries.length; i += 1) {
    if (entries[i].type === "move") count += 1;
  }
  return count;
};

/**
 * Insert a move_number node before `insertIdx` when the move about to be
 * inserted is a white move and no move_number is already immediately
 * preceding.  Only applied to the root mainline variation.
 *
 * Returns the adjusted insertIdx (incremented when a node was inserted).
 */
const maybeInsertMoveNumber = (
  model: PgnModel,
  variation: PgnVariationNode,
  entries: PgnEntryNode[],
  insertIdx: number,
): number => {
  if (variation.parentMoveId !== null) return insertIdx; // sub-variations: skip
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  const startsWhite = fenHeader
    ? (fenHeader.value.trim().split(/\s+/)[1] ?? "w") !== "b"
    : true;
  const preceding = countMovesBeforeIdx(entries, insertIdx);
  const isWhiteTurn = startsWhite ? preceding % 2 === 0 : preceding % 2 !== 0;
  const prevEntry = insertIdx > 0 ? entries[insertIdx - 1] : undefined;
  if (isWhiteTurn && prevEntry?.type !== "move_number") {
    const moveNum = Math.floor(preceding / 2) + 1;
    entries.splice(insertIdx, 0, {
      id: nextId("move_number"),
      type: "move_number",
      text: `${moveNum}.`,
    });
    return insertIdx + 1;
  }
  return insertIdx;
};

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
      for (const rav of (entry as PgnMoveNode).ravs) {
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

  const newMove = makeMoveNode(san);
  // Find insertion point: after cursor.moveId within the variation.
  if (cursor.moveId) {
    const idx = variation.entries.findIndex(
      (e) => e.type === "move" && e.id === cursor.moveId,
    );
    if (idx !== -1) {
      let insertIdx = idx + 1;
      insertIdx = maybeInsertMoveNumber(cloned, variation, variation.entries, insertIdx);
      variation.entries.splice(insertIdx, 0, newMove);
    } else {
      variation.entries.push(newMove);
    }
  } else {
    // Insert before any trailing result token so the serialised PGN stays
    // parseable (a freshly-created game has a result node as the only entry).
    const resultIdx = variation.entries.findIndex((e) => e.type === "result");
    let insertIdx = resultIdx !== -1 ? resultIdx : variation.entries.length;
    insertIdx = maybeInsertMoveNumber(cloned, variation, variation.entries, insertIdx);
    variation.entries.splice(insertIdx, 0, newMove);
  }

  return [cloned, { moveId: newMove.id, variationId: variation.id }];
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
  if (!cursor.moveId) return [model, cursor]; // Cannot branch at root.
  const cloned = cloneModel(model);
  const loc = locateMove(cloned, cursor.moveId);
  if (!loc) return [model, cursor];

  const parentMove = loc.variation.entries[loc.index] as PgnMoveNode;
  const childVar = makeVariationNode(loc.variation.depth + 1, parentMove.id);
  const newMove = makeMoveNode(san);
  childVar.entries.push(newMove);
  parentMove.ravs.push(childVar);
  parentMove.postItems.push({ type: "rav", rav: childVar });

  return [cloned, { moveId: newMove.id, variationId: childVar.id }];
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

  return [cloned, { moveId: newMove.id, variationId: variation.id }];
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

  return [cloned, newCursor];
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

  const parentMove = parentLoc.variation.entries[parentLoc.index] as PgnMoveNode;
  parentMove.ravs = parentMove.ravs.filter((r) => r.id !== cursor.variationId);
  parentMove.postItems = parentMove.postItems.filter(
    (item) => !(item.type === "rav" && item.rav.id === cursor.variationId),
  );

  return [
    cloned,
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

  return [cloned, cursor];
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
  parentMove.ravs = parentMove.ravs.filter((r) => r.id !== variation.id);
  parentMove.postItems = parentMove.postItems.filter(
    (item) => !(item.type === "rav" && item.rav.id === variation.id),
  );

  // Demote old mainline as a new variation (if it had moves).
  if (oldContinuation.some((e) => e.type === "move")) {
    const demoted = makeVariationNode(
      parentLoc.variation.depth + 1,
      parentMove.id,
    );
    demoted.entries = oldContinuation;
    parentMove.ravs.unshift(demoted);
    parentMove.postItems.unshift({ type: "rav", rav: demoted });
  }

  return [
    cloned,
    { moveId: cursor.moveId, variationId: parentLoc.variation.id },
  ];
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
  const fenHeader = model.headers.find((h) => h.key === "FEN")?.value;
  let startSide: "white" | "black" = "white";
  if (fenHeader) {
    const parts = fenHeader.trim().split(/\s+/);
    if (parts[1] === "b") startSide = "black";
  }

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
      for (const rav of move.ravs) {
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

  let inRange = cursor.moveId === null;
  for (const entry of variation.entries) {
    if (entry.type === "move") {
      const move = entry as PgnMoveNode;
      if (move.id === cursor.moveId) inRange = true;
      if (inRange) {
        move.ravs = [];
        move.postItems = move.postItems.filter((item) => item.type !== "rav");
      }
    }
  }

  return [cloned, cursor];
};
