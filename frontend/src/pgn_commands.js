import { parseCommentRuns } from "./pgn_model";

const cloneModel = (model) => JSON.parse(JSON.stringify(model));

const visitVariation = (variation, visitMove, visitComment) => {
  for (const entry of variation.entries) {
    if (entry.type === "move") {
      visitMove(entry);
      entry.commentsBefore.forEach((comment) => visitComment(comment));
      entry.commentsAfter.forEach((comment) => visitComment(comment));
      if (Array.isArray(entry.postItems)) {
        entry.postItems.forEach((item) => {
          if (item.type === "comment" && item.comment) visitComment(item.comment);
          if (item.type === "rav" && item.rav) visitVariation(item.rav, visitMove, visitComment);
        });
      } else {
        entry.ravs.forEach((child) => visitVariation(child, visitMove, visitComment));
      }
    } else if (entry.type === "variation") {
      visitVariation(entry, visitMove, visitComment);
    }
  }
  variation.trailingComments.forEach((comment) => visitComment(comment));
};

export const findCommentById = (model, commentId) => {
  let found = null;
  visitVariation(
    model.root,
    () => {},
    (comment) => {
      if (found || comment.id !== commentId) return;
      found = comment;
    },
  );
  return found;
};

export const setCommentTextById = (model, commentId, rawText) => {
  const next = cloneModel(model);
  let updated = false;
  visitVariation(
    next.root,
    () => {},
    (comment) => {
      if (updated || comment.id !== commentId) return;
      comment.raw = rawText;
      comment.runs = parseCommentRuns(rawText);
      updated = true;
    },
  );
  return next;
};

const getNextCommentId = (model) => {
  let maxId = 0;
  visitVariation(
    model.root,
    () => {},
    (comment) => {
      const match = String(comment.id || "").match(/^comment_(\d+)$/);
      if (!match) return;
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric)) maxId = Math.max(maxId, numeric);
    },
  );
  return `comment_${maxId + 1}`;
};

const makeComment = (id, raw = "") => ({
  id,
  type: "comment",
  raw,
  runs: parseCommentRuns(raw),
});

const insertAroundMoveInVariation = (variation, moveId, position, comment) => {
  for (const entry of variation.entries) {
    if (entry.type === "variation") {
      if (insertAroundMoveInVariation(entry, moveId, position, comment)) return true;
      continue;
    }
    if (entry.type !== "move") continue;
    if (entry.id === moveId) {
      if (position === "before") {
        entry.commentsBefore.push(comment);
      } else {
        entry.commentsAfter.push(comment);
        if (!Array.isArray(entry.postItems)) entry.postItems = [];
        entry.postItems.push({ type: "comment", comment });
      }
      return true;
    }
    if (Array.isArray(entry.postItems)) {
      for (const item of entry.postItems) {
        if (item.type === "rav" && item.rav) {
          if (insertAroundMoveInVariation(item.rav, moveId, position, comment)) return true;
        }
      }
    } else {
      for (const child of entry.ravs) {
        if (insertAroundMoveInVariation(child, moveId, position, comment)) return true;
      }
    }
  }
  return false;
};

export const insertCommentAroundMove = (model, moveId, position = "after", rawText = "") => {
  const next = cloneModel(model);
  const safePosition = position === "before" ? "before" : "after";
  const comment = makeComment(getNextCommentId(next), rawText);
  const inserted = insertAroundMoveInVariation(next.root, moveId, safePosition, comment);
  return inserted ? next : model;
};
