/**
 * PGN Commands module.
 *
 * Integration API:
 * - Primary exports from this module: `setCommentTextById` (removes the comment
 *   when the new body is empty or only whitespace / `[[br]]` markers),
 *   `removeCommentById`,
 *   `getFirstCommentMetadata`, `setFirstCommentIntroRole`, `toggleFirstCommentIntroRole`,
 *   `resolveOwningMoveIdForCommentId`, `findExistingCommentIdAroundMove`,
 *   `applyDefaultIndentDirectives`, `applyDefaultLayout`, `insertCommentAroundMove`,
 *   `toggleMoveNag`.
 *
 * Configuration API:
 * - All behavior is configured through typed function arguments (`model`, `moveId`, `commentId`, `position`, `rawText`) and internal traversal callbacks.
 *
 * Communication API:
 * - Pure model transformations and lookups over PGN AST-like structures; no I/O or DOM effects.
 */

import { isCommentBodyEffectivelyEmpty, parseCommentRuns } from "./pgn_model";
import type { PgnModel, PgnMoveNode, PgnVariationNode, PgnCommentNode, PgnEntryNode, PgnPostItem } from "./pgn_model";
import { siblingCodesInGroup } from "./nag_defs";
import { assertPgnModelInvariants } from "./pgn_invariants";
import { getMoveCommentsAfter, getMoveRavs, insertAfterCommentBeforeFirstRav, syncMoveAttachmentMirrors } from "./pgn_move_attachments";


const cloneModel = <T>(model: T): T => structuredClone(model);
const finalizeMutation = (model: PgnModel, context: string): PgnModel =>
  assertPgnModelInvariants(model, context);

const visitVariation = (
  variation: PgnVariationNode,
  visitMove: (move: PgnMoveNode) => void,
  visitComment: (comment: PgnCommentNode) => void,
): void => {
  for (const entry of variation.entries) {
    if (entry.type === "comment") {
      visitComment(entry);
      continue;
    }
    if (entry.type === "move") {
      visitMove(entry);
      entry.commentsBefore.forEach((comment: PgnCommentNode): void => visitComment(comment));
      getMoveCommentsAfter(entry).forEach((comment: PgnCommentNode): void => visitComment(comment));
      entry.postItems.forEach((item: PgnPostItem): void => {
        if (item.type === "comment" && item.comment) visitComment(item.comment);
        if (item.type === "rav" && item.rav) visitVariation(item.rav, visitMove, visitComment);
      });
    } else if (entry.type === "variation") {
      visitVariation(entry, visitMove, visitComment);
    }
  }
  (Array.isArray(variation.trailingComments) ? variation.trailingComments : []).forEach((comment: PgnCommentNode): void => visitComment(comment));
};

/** Return the raw text of the comment with the given ID, or null if not found. */
export const getCommentRawById = (model: PgnModel, commentId: string): string | null => {
  if (!model.root) return null;
  let found: string | null = null;
  visitVariation(
    model.root,
    (): void => {},
    (comment: PgnCommentNode): void => {
      if (comment.id === commentId) found = comment.raw;
    },
  );
  return found;
};

export const setCommentTextById = (model: PgnModel, commentId: string, rawText: string): PgnModel => {
  if (isCommentBodyEffectivelyEmpty(rawText)) {
    return removeCommentById(model, commentId);
  }
  const next = cloneModel(model);
  if (!next.root) return model;
  visitVariation(
    next.root,
    (): void => {},
    (comment: PgnCommentNode): void => {
      if (comment.id !== commentId) return;
      comment.raw = rawText;
      comment.runs = parseCommentRuns(rawText);
    },
  );
  return finalizeMutation(next, "setCommentTextById");
};

const removeCommentInVariation = (variation: PgnVariationNode, commentId: string): boolean => {
  let removed = false;
  variation.entries = variation.entries.filter((entry: PgnEntryNode): boolean => {
    if (entry.type === "comment" && entry.id === commentId) {
      removed = true;
      return false;
    }
    return true;
  });
  variation.trailingComments = (Array.isArray(variation.trailingComments) ? variation.trailingComments : []).filter((comment: PgnCommentNode): boolean => {
    if (comment.id === commentId) {
      removed = true;
      return false;
    }
    return true;
  });

  variation.entries.forEach((entry: PgnEntryNode): void => {
    if (entry.type === "variation") {
      if (removeCommentInVariation(entry, commentId)) removed = true;
      return;
    }
    if (entry.type !== "move") return;

    const beforeLen = entry.commentsBefore.length;
    entry.commentsBefore = entry.commentsBefore.filter((comment: PgnCommentNode): boolean => comment.id !== commentId);
    if (entry.commentsBefore.length !== beforeLen) removed = true;

    const afterLen = getMoveCommentsAfter(entry).length;
    const postLen = entry.postItems.length;
    entry.postItems = entry.postItems.filter((item: PgnPostItem): boolean => !(item.type === "comment" && item.comment?.id === commentId));
    syncMoveAttachmentMirrors(entry);
    if (entry.postItems.length !== postLen) removed = true;
    if (getMoveCommentsAfter(entry).length !== afterLen) removed = true;
    entry.postItems.forEach((item: PgnPostItem): void => {
      if (item.type === "rav" && item.rav) {
        if (removeCommentInVariation(item.rav, commentId)) removed = true;
      }
    });
  });
  return removed;
};

export const removeCommentById = (model: PgnModel, commentId: string): PgnModel => {
  const next = cloneModel(model);
  if (!next.root) return model;
  const removed = removeCommentInVariation(next.root, commentId);
  return removed ? finalizeMutation(next, "removeCommentById") : model;
};

const getNextCommentId = (model: PgnModel): string => {
  if (!model.root) return "comment_1";
  let maxId = 0;
  visitVariation(
    model.root,
    (): void => {},
    (comment: PgnCommentNode): void => {
      const match = String(comment.id || "").match(/^comment_(\d+)$/);
      if (!match) return;
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric)) maxId = Math.max(maxId, numeric);
    },
  );
  return `comment_${maxId + 1}`;
};

const makeComment = (id: string, raw: string = ""): PgnCommentNode => ({
  id,
  type: "comment",
  raw,
  runs: parseCommentRuns(raw),
});

const INDENT_DIRECTIVE_PREFIX = /^\s*(?:\\i(?:\s+|$))+/;
const INTRO_DIRECTIVE_PREFIX = /^\s*\\intro(?:\s+|$)/i;
const withLeadingIndentDirective = (rawText: string): string => {
  const source = String(rawText ?? "");
  if (INDENT_DIRECTIVE_PREFIX.test(source)) return source;
  return source.trim() ? `\\i ${source}` : "\\i";
};

const hasIntroDirective = (rawText: string): boolean => INTRO_DIRECTIVE_PREFIX.test(String(rawText ?? ""));
const stripIntroDirective = (rawText: string): string => String(rawText ?? "")
  .replace(INTRO_DIRECTIVE_PREFIX, "")
  .replace(/^\s+/, "");
const withLeadingIntroDirective = (rawText: string): string => {
  const stripped = stripIntroDirective(rawText);
  return stripped ? `\\intro ${stripped}` : "\\intro";
};

const findFirstCommentInVariation = (variation: PgnVariationNode): PgnCommentNode | null => {
  for (const entry of variation.entries) {
    if (entry.type === "comment") return entry;
    if (entry.type === "variation") {
      const nested = findFirstCommentInVariation(entry);
      if (nested) return nested;
      continue;
    }
    if (entry.type !== "move") continue;
    if (Array.isArray(entry.commentsBefore) && entry.commentsBefore.length > 0) return entry.commentsBefore[0];
    if (entry.postItems.length > 0) {
      for (const item of entry.postItems) {
        if (item.type === "comment" && item.comment) return item.comment;
        if (item.type === "rav" && item.rav) {
          const nested = findFirstCommentInVariation(item.rav);
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
export const getFirstCommentMetadata = (model: PgnModel): { exists: boolean; commentId: string | null; isIntro: boolean } => {
  if (!model.root) return { exists: false, commentId: null, isIntro: false };
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
export const setFirstCommentIntroRole = (model: PgnModel, isIntro: boolean): PgnModel => {
  if (!model.root) return model;
  const next = cloneModel(model);
  if (!next.root) return model;
  const firstComment = findFirstCommentInVariation(next.root);
  if (!firstComment) return model;
  const nextRaw = isIntro
    ? withLeadingIntroDirective(firstComment.raw)
    : stripIntroDirective(firstComment.raw);
  if (nextRaw === firstComment.raw) return model;
  firstComment.raw = nextRaw;
  firstComment.runs = parseCommentRuns(nextRaw);
  return finalizeMutation(next, "setFirstCommentIntroRole");
};

/**
 * Toggle the intro role marker (`\intro`) on the first comment.
 *
 * @param {object} model - PGN model root.
 * @returns {object} Updated model, or original model when first comment is missing.
 */
export const toggleFirstCommentIntroRole = (model: PgnModel): PgnModel => {
  const meta = getFirstCommentMetadata(model);
  if (!meta.exists) return model;
  return setFirstCommentIntroRole(model, !meta.isIntro);
};

const findNextMoveIdInEntries = (entries: PgnEntryNode[], startIdx: number): string | null => {
  for (let i = startIdx; i < entries.length; i += 1) {
    const candidate = entries[i];
    if (candidate?.type === "move" && candidate.id) return candidate.id;
  }
  return null;
};

const resolveOwningMoveIdInVariation = (variation: PgnVariationNode, commentId: string, previousMoveId: string | null = null): string | null => {
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
    if (Array.isArray(entry.commentsBefore) && entry.commentsBefore.some((comment: PgnCommentNode): boolean => comment.id === commentId)) {
      return entry.id || null;
    }
    if (getMoveCommentsAfter(entry).some((comment: PgnCommentNode): boolean => comment.id === commentId)) {
      return entry.id || null;
    }
    for (const item of entry.postItems) {
      if (item.type === "comment" && item.comment?.id === commentId) {
        return entry.id || null;
      }
      if (item.type === "rav" && item.rav) {
        const nestedOwner = resolveOwningMoveIdInVariation(item.rav, commentId, entry.id || localPreviousMoveId);
        if (nestedOwner) return nestedOwner;
      }
    }
    localPreviousMoveId = entry.id || localPreviousMoveId;
  }
  if (Array.isArray(variation.trailingComments) && variation.trailingComments.some((comment: PgnCommentNode): boolean => comment.id === commentId)) {
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
export const resolveOwningMoveIdForCommentId = (model: PgnModel, commentId: string): string | null => {
  if (!model.root || !commentId) return null;
  return resolveOwningMoveIdInVariation(model.root, commentId, null);
};

const getNearestAfterComment = (move: PgnMoveNode): PgnCommentNode | null => {
  if (!Array.isArray(move?.postItems)) return null;
  for (const item of move.postItems) {
    if (item.type === "rav") break;
    if (item.type === "comment" && item.comment) return item.comment;
  }
  return null;
};

const findExistingAroundMoveInVariation = (variation: PgnVariationNode, moveId: string, position: "before" | "after"): PgnCommentNode | null => {
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
          return variation.entries[insertIdx - 1] as PgnCommentNode;
        }
        return null;
      }
      if (Array.isArray(entry.postItems)) {
        const nearestAfter = getNearestAfterComment(entry);
        if (nearestAfter) return nearestAfter;
      }
      return null;
    }
    for (const child of getMoveRavs(entry)) {
      const nested = findExistingAroundMoveInVariation(child, moveId, position);
      if (nested) return nested;
    }
  }
  return null;
};

export const findExistingCommentIdAroundMove = (model: PgnModel, moveId: string, position: "before" | "after" = "after"): string | null => {
  if (!model.root) return null;
  const safePosition = position === "before" ? "before" : "after";
  const existing = findExistingAroundMoveInVariation(model.root, moveId, safePosition);
  return existing?.id ?? null;
};

const normalizeMovePostItems = (move: PgnMoveNode): void => {
  if (!Array.isArray(move.postItems)) move.postItems = [];
};

export const applyDefaultIndentDirectives = (model: PgnModel): PgnModel => {
  const next = cloneModel(model);
  if (!next.root) return model;
  let maxId = 0;
  visitVariation(
    next.root,
    (): void => {},
    (comment: PgnCommentNode): void => {
      const match = String(comment.id || "").match(/^comment_(\d+)$/);
      if (!match) return;
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric)) maxId = Math.max(maxId, numeric);
    },
  );
  const createIndentComment = (): PgnCommentNode => makeComment(`comment_${++maxId}`, "\\i");

  const walkVariation = (variation: PgnVariationNode): void => {
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
      const postItems: PgnPostItem[] = entry.postItems ?? [];
      for (let postIdx = 0; postIdx < postItems.length; postIdx += 1) {
        const item = postItems[postIdx];
        if (item.type !== "rav" || !item.rav) continue;
        const prev = postItems[postIdx - 1];
        if (prev?.type === "comment" && prev.comment) {
          prev.comment.raw = withLeadingIndentDirective(prev.comment.raw);
          prev.comment.runs = parseCommentRuns(prev.comment.raw);
        } else {
          const inserted = createIndentComment();
          insertAfterCommentBeforeFirstRav(entry, inserted);
          postIdx += 1;
        }
        walkVariation(item.rav);
      }
    }
  };

  walkVariation(next.root);
  return finalizeMutation(next, "applyDefaultIndentDirectives");
};

/**
 * Apply a configurable default structural layout to the game.
 *
 * Operations (each individually togglable via `prefs`):
 * 1. Insert an intro comment at the start when none exists.
 * 2. Prepend `[[br]]` to every main-line comment (intro excluded) so text
 *    begins on its own visual line in plain and text modes.
 *    Comments inside variations are not touched.
 *
 * @param model - Source PGN model.
 * @param prefs - Which operations to apply and with what parameters.
 * @returns Updated model clone, or original when no changes are needed.
 */
export const applyDefaultLayout = (
  model: PgnModel,
  prefs: { addIntroIfMissing: boolean; introText: string; addBrToMainLineComments: boolean },
): PgnModel => {
  const next = cloneModel(model);
  if (!next.root) return model;

  // Compute the current maximum comment numeric ID so new IDs don't collide.
  let maxId = 0;
  visitVariation(
    next.root,
    (): void => {},
    (comment: PgnCommentNode): void => {
      const match = String(comment.id || "").match(/^comment_(\d+)$/);
      if (!match) return;
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric)) maxId = Math.max(maxId, numeric);
    },
  );

  // Step 1: Optionally insert an intro comment if there is no comment before the first move.
  let introCommentId: string | null = findFirstCommentInVariation(next.root)?.id ?? null;
  if (prefs.addIntroIfMissing && !introCommentId) {
    const introComment = makeComment(`comment_${++maxId}`, prefs.introText);
    next.root.entries.unshift(introComment);
    introCommentId = introComment.id;
  }

  // Step 2: Optionally prepend [[br]] to main-line comments (skip the intro).
  if (prefs.addBrToMainLineComments) {
    const addBr = (comment: PgnCommentNode): void => {
      if (comment.id === introCommentId) return;
      if (comment.raw.startsWith("[[br]]")) return;
      comment.raw = `[[br]]${comment.raw}`;
      comment.runs = parseCommentRuns(comment.raw);
    };

    for (const entry of next.root.entries) {
      if (entry.type === "comment") {
        addBr(entry);
        continue;
      }
      if (entry.type !== "move") continue;
      entry.commentsBefore.forEach(addBr);
      for (const item of entry.postItems) {
        // Only process inline comments; do NOT recurse into RAVs.
        if (item.type === "comment" && item.comment) addBr(item.comment);
      }
    }
    (next.root.trailingComments ?? []).forEach(addBr);
  }

  return finalizeMutation(next, "applyDefaultLayout");
};

const insertAroundMoveInVariation = (variation: PgnVariationNode, moveId: string, position: "before" | "after", comment: PgnCommentNode): boolean => {
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
        insertAfterCommentBeforeFirstRav(entry, comment);
      }
      return true;
    }
    for (const child of getMoveRavs(entry)) {
      if (insertAroundMoveInVariation(child, moveId, position, comment)) return true;
    }
  }
  return false;
};

export const insertCommentAroundMove = (model: PgnModel, moveId: string, position: "before" | "after" = "after", rawText: string = ""): { model: PgnModel; insertedCommentId: string | null; created: boolean } => {
  const next = cloneModel(model);
  if (!next.root) {
    return { model, insertedCommentId: null, created: false };
  }
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
    model: inserted ? finalizeMutation(next, "insertCommentAroundMove") : model,
    insertedCommentId: inserted ? comment.id : null,
    created: Boolean(inserted),
  };
};

// ── NAG mutation ──────────────────────────────────────────────────────────────

/**
 * Toggle a NAG on the target move with within-group exclusivity.
 *
 * - If `nag` is already present on the move → removes it (toggle off).
 * - Otherwise → adds `nag`, removing all other NAGs in the same NAG group first.
 *
 * Group membership is resolved via `siblingCodesInGroup` from `nag_defs`.
 * If the NAG code is unknown (not in the registry), the toggle operates
 * without group exclusivity (unknown NAGs are freely addable/removable).
 *
 * Returns a new `PgnModel`, or the original model unchanged if `moveId` is
 * not found.
 *
 * @param model  - Source PGN model.
 * @param moveId - Target move node ID.
 * @param nag    - NAG code to toggle, e.g. "$1".
 */
export const toggleMoveNag = (
  model: PgnModel,
  moveId: string,
  nag: string,
): PgnModel => {
  if (!model.root) return model;

  const next = cloneModel(model);
  if (!next.root) return model;

  let found = false;
  visitVariation(
    next.root,
    (move: PgnMoveNode): void => {
      if (move.id !== moveId) return;
      found = true;
      const nags: string[] = move.nags;
      const alreadyPresent = nags.includes(nag);
      if (alreadyPresent) {
        // Toggle off: remove the NAG.
        nags.splice(nags.indexOf(nag), 1);
      } else {
        // Toggle on: remove siblings in the same group, then add.
        for (const sibling of siblingCodesInGroup(nag)) {
          const si = nags.indexOf(sibling);
          if (si !== -1) nags.splice(si, 1);
        }
        nags.push(nag);
      }
    },
    (): void => {},
  );

  return found ? finalizeMutation(next, "toggleMoveNag") : model;
};
