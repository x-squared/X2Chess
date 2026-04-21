/**
 * pgn_move_attachments — canonical helpers for move attachment updates.
 *
 * Integration API:
 * - Write helpers update `postItems`, the canonical move attachment source.
 *
 * Configuration API:
 * - Callers choose insertion semantics (start/end/before first RAV).
 *
 * Communication API:
 * - Pure in-memory mutation helpers for `PgnMoveNode.postItems`.
 */
import type { PgnCommentNode, PgnMoveNode, PgnPostItem, PgnVariationNode } from "./pgn_model";

export const syncMoveAttachmentMirrors = (move: PgnMoveNode): void => {
  ensurePostItems(move);
};

const ensurePostItems = (move: PgnMoveNode): void => {
  if (!Array.isArray(move.postItems)) {
    move.postItems = [];
  }
};

export const getMoveRavs = (move: PgnMoveNode): PgnVariationNode[] => {
  ensurePostItems(move);
  return move.postItems
    .filter((item: PgnPostItem): boolean => item.type === "rav")
    .map((item: PgnPostItem): PgnVariationNode => (item as { type: "rav"; rav: PgnVariationNode }).rav);
};

export const getMoveCommentsAfter = (move: PgnMoveNode): PgnCommentNode[] => {
  ensurePostItems(move);
  return move.postItems
    .filter((item: PgnPostItem): boolean => item.type === "comment")
    .map((item: PgnPostItem): PgnCommentNode => (item as { type: "comment"; comment: PgnCommentNode }).comment);
};

export const appendMoveRav = (move: PgnMoveNode, rav: PgnVariationNode, position: "start" | "end" = "end"): void => {
  ensurePostItems(move);
  if (position === "start") {
    move.postItems.unshift({ type: "rav", rav });
  } else {
    move.postItems.push({ type: "rav", rav });
  }
};

export const removeMoveRavById = (move: PgnMoveNode, ravId: string): void => {
  ensurePostItems(move);
  move.postItems = move.postItems.filter(
    (item: PgnPostItem): boolean => !(item.type === "rav" && item.rav.id === ravId),
  );
};

export const clearMoveRavs = (move: PgnMoveNode): void => {
  ensurePostItems(move);
  move.postItems = move.postItems.filter((item: PgnPostItem): boolean => item.type !== "rav");
};

export const insertAfterCommentBeforeFirstRav = (move: PgnMoveNode, comment: PgnCommentNode): void => {
  ensurePostItems(move);
  const firstRavIndex: number = move.postItems.findIndex((item: PgnPostItem): boolean => item.type === "rav");
  const insertAt: number = firstRavIndex >= 0 ? firstRavIndex : move.postItems.length;
  move.postItems.splice(insertAt, 0, { type: "comment", comment });
};

