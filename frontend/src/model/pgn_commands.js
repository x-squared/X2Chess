import { parseCommentRuns } from "./pgn_model";

const cloneModel = (model) => JSON.parse(JSON.stringify(model));

const visitVariation = (variation, visitMove, visitComment) => {
  for (const entry of variation.entries) {
    if (entry.type === "comment") {
      visitComment(entry);
      continue;
    }
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

export const setCommentTextById = (model, commentId, rawText) => {
  const next = cloneModel(model);
  visitVariation(
    next.root,
    () => {},
    (comment) => {
      if (comment.id !== commentId) return;
      comment.raw = rawText;
      comment.runs = parseCommentRuns(rawText);
    },
  );
  return next;
};

const removeCommentInVariation = (variation, commentId) => {
  let removed = false;
  variation.entries = variation.entries.filter((entry) => {
    if (entry.type === "comment" && entry.id === commentId) {
      removed = true;
      return false;
    }
    return true;
  });
  variation.trailingComments = variation.trailingComments.filter((comment) => {
    if (comment.id === commentId) {
      removed = true;
      return false;
    }
    return true;
  });

  variation.entries.forEach((entry) => {
    if (entry.type === "variation") {
      if (removeCommentInVariation(entry, commentId)) removed = true;
      return;
    }
    if (entry.type !== "move") return;

    const beforeLen = entry.commentsBefore.length;
    entry.commentsBefore = entry.commentsBefore.filter((comment) => comment.id !== commentId);
    if (entry.commentsBefore.length !== beforeLen) removed = true;

    const afterLen = entry.commentsAfter.length;
    entry.commentsAfter = entry.commentsAfter.filter((comment) => comment.id !== commentId);
    if (entry.commentsAfter.length !== afterLen) removed = true;

    if (Array.isArray(entry.postItems)) {
      const postLen = entry.postItems.length;
      entry.postItems = entry.postItems.filter((item) => !(item.type === "comment" && item.comment?.id === commentId));
      if (entry.postItems.length !== postLen) removed = true;
      entry.postItems.forEach((item) => {
        if (item.type === "rav" && item.rav) {
          if (removeCommentInVariation(item.rav, commentId)) removed = true;
        }
      });
    } else {
      entry.ravs.forEach((child) => {
        if (removeCommentInVariation(child, commentId)) removed = true;
      });
    }
  });
  return removed;
};

export const removeCommentById = (model, commentId) => {
  const next = cloneModel(model);
  const removed = removeCommentInVariation(next.root, commentId);
  return removed ? next : model;
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

const INDENT_DIRECTIVE_PREFIX = /^\s*(?:\\i(?:\s+|$))+/;
const INTRO_DIRECTIVE_PREFIX = /^\s*\\intro(?:\s+|$)/i;
const withLeadingIndentDirective = (rawText) => {
  const source = String(rawText ?? "");
  if (INDENT_DIRECTIVE_PREFIX.test(source)) return source;
  return source.trim() ? `\\i ${source}` : "\\i";
};

const hasIntroDirective = (rawText) => INTRO_DIRECTIVE_PREFIX.test(String(rawText ?? ""));
const stripIntroDirective = (rawText) => String(rawText ?? "")
  .replace(INTRO_DIRECTIVE_PREFIX, "")
  .replace(/^\s+/, "");
const withLeadingIntroDirective = (rawText) => {
  const stripped = stripIntroDirective(rawText);
  return stripped ? `\\intro ${stripped}` : "\\intro";
};

const findFirstCommentInVariation = (variation) => {
  for (const entry of variation.entries) {
    if (entry.type === "comment") return entry;
    if (entry.type === "variation") {
      const nested = findFirstCommentInVariation(entry);
      if (nested) return nested;
      continue;
    }
    if (entry.type !== "move") continue;
    if (Array.isArray(entry.commentsBefore) && entry.commentsBefore.length > 0) return entry.commentsBefore[0];
    if (Array.isArray(entry.postItems) && entry.postItems.length > 0) {
      for (const item of entry.postItems) {
        if (item.type === "comment" && item.comment) return item.comment;
        if (item.type === "rav" && item.rav) {
          const nested = findFirstCommentInVariation(item.rav);
          if (nested) return nested;
        }
      }
    } else {
      if (Array.isArray(entry.commentsAfter) && entry.commentsAfter.length > 0) return entry.commentsAfter[0];
      if (Array.isArray(entry.ravs)) {
        for (const child of entry.ravs) {
          const nested = findFirstCommentInVariation(child);
          if (nested) return nested;
        }
      }
    }
  }
  if (Array.isArray(variation.trailingComments) && variation.trailingComments.length > 0) {
    return variation.trailingComments[0];
  }
  return null;
};

/**
 * Resolve metadata for the earliest comment in PGN traversal order.
 *
 * @param {object} model - PGN model root.
 * @returns {{exists: boolean, commentId: string|null, isIntro: boolean}} First-comment role metadata.
 */
export const getFirstCommentMetadata = (model) => {
  if (!model?.root) return { exists: false, commentId: null, isIntro: false };
  const firstComment = findFirstCommentInVariation(model.root);
  if (!firstComment) return { exists: false, commentId: null, isIntro: false };
  return {
    exists: true,
    commentId: firstComment.id ?? null,
    isIntro: hasIntroDirective(firstComment.raw),
  };
};

/**
 * Set or clear the intro role marker (`\intro`) on the first comment only.
 *
 * @param {object} model - PGN model root.
 * @param {boolean} isIntro - True to enforce intro role, false to clear it.
 * @returns {object} Updated model, or original model when unchanged.
 */
export const setFirstCommentIntroRole = (model, isIntro) => {
  if (!model?.root) return model;
  const next = cloneModel(model);
  const firstComment = findFirstCommentInVariation(next.root);
  if (!firstComment) return model;
  const nextRaw = isIntro
    ? withLeadingIntroDirective(firstComment.raw)
    : stripIntroDirective(firstComment.raw);
  if (nextRaw === firstComment.raw) return model;
  firstComment.raw = nextRaw;
  firstComment.runs = parseCommentRuns(nextRaw);
  return next;
};

/**
 * Toggle the intro role marker (`\intro`) on the first comment.
 *
 * @param {object} model - PGN model root.
 * @returns {object} Updated model, or original model when first comment is missing.
 */
export const toggleFirstCommentIntroRole = (model) => {
  const meta = getFirstCommentMetadata(model);
  if (!meta.exists) return model;
  return setFirstCommentIntroRole(model, !meta.isIntro);
};

const findNextMoveIdInEntries = (entries, startIdx) => {
  for (let i = startIdx; i < entries.length; i += 1) {
    const candidate = entries[i];
    if (candidate?.type === "move" && candidate.id) return candidate.id;
  }
  return null;
};

const resolveOwningMoveIdInVariation = (variation, commentId, previousMoveId = null) => {
  let localPreviousMoveId = previousMoveId;
  for (let idx = 0; idx < variation.entries.length; idx += 1) {
    const entry = variation.entries[idx];
    if (entry.type === "comment") {
      if (entry.id === commentId) {
        return findNextMoveIdInEntries(variation.entries, idx + 1) || localPreviousMoveId || null;
      }
      continue;
    }
    if (entry.type === "variation") {
      const nestedOwner = resolveOwningMoveIdInVariation(entry, commentId, localPreviousMoveId);
      if (nestedOwner) return nestedOwner;
      continue;
    }
    if (entry.type !== "move") continue;
    if (Array.isArray(entry.commentsBefore) && entry.commentsBefore.some((comment) => comment.id === commentId)) {
      return entry.id || null;
    }
    if (Array.isArray(entry.commentsAfter) && entry.commentsAfter.some((comment) => comment.id === commentId)) {
      return entry.id || null;
    }
    if (Array.isArray(entry.postItems)) {
      for (const item of entry.postItems) {
        if (item.type === "comment" && item.comment?.id === commentId) {
          return entry.id || null;
        }
        if (item.type === "rav" && item.rav) {
          const nestedOwner = resolveOwningMoveIdInVariation(item.rav, commentId, entry.id || localPreviousMoveId);
          if (nestedOwner) return nestedOwner;
        }
      }
    } else if (Array.isArray(entry.ravs)) {
      for (const child of entry.ravs) {
        const nestedOwner = resolveOwningMoveIdInVariation(child, commentId, entry.id || localPreviousMoveId);
        if (nestedOwner) return nestedOwner;
      }
    }
    localPreviousMoveId = entry.id || localPreviousMoveId;
  }
  if (Array.isArray(variation.trailingComments) && variation.trailingComments.some((comment) => comment.id === commentId)) {
    return localPreviousMoveId || null;
  }
  return null;
};

/**
 * Resolve the move id associated with a given comment id.
 *
 * Mapping strategy:
 * - comments before a move -> that move
 * - comments after a move -> that move
 * - standalone comments in a variation -> next move if present, else previous move
 * - trailing variation comments -> last move in that variation
 *
 * @param {object} model - PGN model root.
 * @param {string} commentId - Target comment identifier.
 * @returns {string|null} Owning move id, or null when no move can be resolved.
 */
export const resolveOwningMoveIdForCommentId = (model, commentId) => {
  if (!model?.root || !commentId) return null;
  return resolveOwningMoveIdInVariation(model.root, commentId, null);
};

const getNearestAfterComment = (move) => {
  if (!Array.isArray(move?.postItems)) return null;
  for (const item of move.postItems) {
    if (item.type === "rav") break;
    if (item.type === "comment" && item.comment) return item.comment;
  }
  return null;
};

const findExistingAroundMoveInVariation = (variation, moveId, position) => {
  for (let idx = 0; idx < variation.entries.length; idx += 1) {
    const entry = variation.entries[idx];
    if (entry.type === "variation") {
      const nested = findExistingAroundMoveInVariation(entry, moveId, position);
      if (nested) return nested;
      continue;
    }
    if (entry.type !== "move") continue;
    if (entry.id === moveId) {
      if (position === "before") {
        if (entry.commentsBefore.length > 0) {
          return entry.commentsBefore[entry.commentsBefore.length - 1];
        }
        let insertIdx = idx;
        while (insertIdx > 0 && variation.entries[insertIdx - 1]?.type === "move_number") {
          insertIdx -= 1;
        }
        if (insertIdx > 0 && variation.entries[insertIdx - 1]?.type === "comment") {
          return variation.entries[insertIdx - 1];
        }
        return null;
      }
      if (Array.isArray(entry.postItems)) {
        const nearestAfter = getNearestAfterComment(entry);
        if (nearestAfter) return nearestAfter;
      }
      return null;
    }
    if (Array.isArray(entry.postItems)) {
      for (const item of entry.postItems) {
        if (item.type === "rav" && item.rav) {
          const nested = findExistingAroundMoveInVariation(item.rav, moveId, position);
          if (nested) return nested;
        }
      }
    } else {
      for (const child of entry.ravs) {
        const nested = findExistingAroundMoveInVariation(child, moveId, position);
        if (nested) return nested;
      }
    }
  }
  return null;
};

export const findExistingCommentIdAroundMove = (model, moveId, position = "after") => {
  if (!model?.root) return null;
  const safePosition = position === "before" ? "before" : "after";
  const existing = findExistingAroundMoveInVariation(model.root, moveId, safePosition);
  return existing?.id ?? null;
};

const normalizeMovePostItems = (move) => {
  if (Array.isArray(move.postItems) && move.postItems.length > 0) return;
  move.postItems = [];
  if (Array.isArray(move.commentsAfter)) {
    move.commentsAfter.forEach((comment) => move.postItems.push({ type: "comment", comment }));
  }
  if (Array.isArray(move.ravs)) {
    move.ravs.forEach((rav) => move.postItems.push({ type: "rav", rav }));
  }
};

export const applyDefaultIndentDirectives = (model) => {
  const next = cloneModel(model);
  let maxId = 0;
  visitVariation(
    next.root,
    () => {},
    (comment) => {
      const match = String(comment.id || "").match(/^comment_(\d+)$/);
      if (!match) return;
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric)) maxId = Math.max(maxId, numeric);
    },
  );
  const createIndentComment = () => makeComment(`comment_${++maxId}`, "\\i");

  const walkVariation = (variation) => {
    for (let idx = 0; idx < variation.entries.length; idx += 1) {
      const entry = variation.entries[idx];
      if (entry.type === "variation") {
        const prev = variation.entries[idx - 1];
        if (prev?.type === "comment") {
          prev.raw = withLeadingIndentDirective(prev.raw);
          prev.runs = parseCommentRuns(prev.raw);
        } else {
          variation.entries.splice(idx, 0, createIndentComment());
          idx += 1;
        }
        walkVariation(entry);
        continue;
      }
      if (entry.type !== "move") continue;
      normalizeMovePostItems(entry);
      for (let postIdx = 0; postIdx < entry.postItems.length; postIdx += 1) {
        const item = entry.postItems[postIdx];
        if (item.type !== "rav" || !item.rav) continue;
        const prev = entry.postItems[postIdx - 1];
        if (prev?.type === "comment" && prev.comment) {
          prev.comment.raw = withLeadingIndentDirective(prev.comment.raw);
          prev.comment.runs = parseCommentRuns(prev.comment.raw);
        } else {
          const inserted = createIndentComment();
          entry.postItems.splice(postIdx, 0, { type: "comment", comment: inserted });
          entry.commentsAfter.push(inserted);
          postIdx += 1;
        }
        walkVariation(item.rav);
      }
    }
  };

  walkVariation(next.root);
  return next;
};

const insertAroundMoveInVariation = (variation, moveId, position, comment) => {
  for (let idx = 0; idx < variation.entries.length; idx += 1) {
    const entry = variation.entries[idx];
    if (entry.type === "variation") {
      if (insertAroundMoveInVariation(entry, moveId, position, comment)) return true;
      continue;
    }
    if (entry.type !== "move") continue;
    if (entry.id === moveId) {
      if (position === "before") {
        let insertIdx = idx;
        while (insertIdx > 0 && variation.entries[insertIdx - 1]?.type === "move_number") {
          insertIdx -= 1;
        }
        variation.entries.splice(insertIdx, 0, comment);
      } else {
        entry.commentsAfter.push(comment);
        if (!Array.isArray(entry.postItems)) entry.postItems = [];
        const firstRavIndex = entry.postItems.findIndex((item) => item.type === "rav");
        const insertAt = firstRavIndex >= 0 ? firstRavIndex : entry.postItems.length;
        entry.postItems.splice(insertAt, 0, { type: "comment", comment });
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
  const existingCommentId = findExistingCommentIdAroundMove(next, moveId, safePosition);
  if (existingCommentId) {
    return {
      model,
      insertedCommentId: existingCommentId,
      created: false,
    };
  }
  const comment = makeComment(getNextCommentId(next), rawText);
  const inserted = insertAroundMoveInVariation(next.root, moveId, safePosition, comment);
  return {
    model: inserted ? next : model,
    insertedCommentId: inserted ? comment.id : null,
    created: Boolean(inserted),
  };
};
