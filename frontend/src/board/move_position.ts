import { Chess, type Move } from "chess.js";

/**
 * Board move-position resolver helpers.
 *
 * Intent:
 * - Resolve move IDs to board positions for mainline and variation navigation.
 * - Provide robust SAN parsing with normalization fallbacks.
 *
 * Integration API:
 * - `applySanWithFallback(game, san)`
 * - `buildMovePositionById(pgnModel)`
 * - `resolveMovePositionById(pgnModel, moveId)`
 * - `buildMainlinePlyByMoveId(pgnModel)`
 * - `stripAnnotationsForBoardParser(source)`
 */

/** Parsed variation subtree (matches `parsePgnToModel` output at runtime). */
export type PgnVariationNode = {
  type: "variation";
  entries: PgnVariationEntry[];
};

export type PgnMoveNode = {
  type: "move";
  id: string;
  san: string;
  postItems?: PgnPostItem[];
  ravs?: PgnVariationNode[];
};

type PgnPostItem =
  | { type: "rav"; rav: PgnVariationNode }
  | { type: "comment"; comment: unknown };

/** Non-move tokens that can appear in a variation’s `entries` list. */
export type PgnOtherEntry =
  | { id: string; type: "move_number"; text: string }
  | { id: string; type: "result"; text: string }
  | { id: string; type: "nag"; text: string };

/** All nodes that can appear in a variation’s `entries` list. */
export type PgnVariationEntry = PgnVariationNode | PgnMoveNode | PgnOtherEntry;

/** Minimal model shape for move-position APIs. */
export type PgnModelForMoves = {
  root?: PgnVariationNode;
};

export type MovePositionRecord = {
  fen: string;
  lastMove: [string, string] | null;
  mainlinePly: number | null;
  parentMoveId: string | null;
  isVariationStart?: boolean;
  variationFirstMoveIds: string[];
  previousMoveId?: string | null;
  nextMoveId?: string | null;
};

export type MovePositionResolved = {
  fen: string;
  lastMove: [string, string] | null;
  mainlinePly: number | null;
  parentMoveId: string | null;
};

export type MovePositionIndex = Record<string, MovePositionRecord>;

export type MainlinePlyByMoveId = Record<string, number>;

/**
 * Clone a Chess instance from current FEN.
 */
const cloneGame = (game: Chess): Chess => {
  const next = new Chess();
  next.load(game.fen());
  return next;
};

/**
 * Apply SAN to game using tolerant normalization fallbacks.
 *
 * @returns `chess.js` move object or null when all candidates fail.
 */
export const applySanWithFallback = (game: Chess, san: string): Move | null => {
  if (!san || typeof san !== "string") return null;
  const raw = san.trim();
  if (!raw) return null;
  const candidates = new Set([raw]);
  candidates.add(raw.replace(/[!?]+/g, ""));
  candidates.add(raw.replace(/^\d+\.(?:\.\.)?/, "").trim());
  candidates.add(raw.replace(/^(?:\.\.\.|…)+/, "").trim());
  candidates.add(
    raw
      .replace(/^\d+\.(?:\.\.)?/, "")
      .replace(/^(?:\.\.\.|…)+/, "")
      .replace(/[!?]+/g, "")
      .trim(),
  );

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const moved = game.move(candidate);
      if (moved) return moved;
    } catch {
      // Try next candidate.
    }
  }
  return null;
};

/**
 * Build move-position index keyed by move id across mainline and variations.
 */
export const buildMovePositionById = (pgnModel: PgnModelForMoves): MovePositionIndex => {
  const index: MovePositionIndex = {};
  if (!pgnModel?.root) return index;

  const root = pgnModel.root as PgnVariationNode;

  const walkVariation = (
    variation: PgnVariationNode,
    baseGame: Chess,
    isMainline: boolean,
    mainlinePly: number,
    parentMoveId: string | null = null,
  ): string | null => {
    const game = cloneGame(baseGame);
    let ply = mainlinePly;
    let firstMoveId: string | null = null;
    let lastMoveId: string | null = parentMoveId;
    for (const entry of variation.entries) {
      if (entry.type === "variation") {
        const childFirstMoveId = walkVariation(entry, game, false, ply, lastMoveId);
        if (childFirstMoveId && lastMoveId && index[lastMoveId]) {
          const nextStarts = Array.isArray(index[lastMoveId].variationFirstMoveIds)
            ? index[lastMoveId].variationFirstMoveIds
            : [];
          index[lastMoveId].variationFirstMoveIds = [...nextStarts, childFirstMoveId];
        }
        continue;
      }
      if (entry.type !== "move") continue;
      const gameBeforeMove = cloneGame(game);
      const moved = applySanWithFallback(game, entry.san);
      if (!moved) continue;
      if (isMainline) ply += 1;
      if (!firstMoveId) firstMoveId = entry.id;
      const childVariationFirstMoveIds: string[] = [];
      const previousMoveId = lastMoveId;
      index[entry.id] = {
        fen: game.fen(),
        lastMove: moved.from && moved.to ? [moved.from, moved.to] : null,
        mainlinePly: isMainline ? ply : null,
        parentMoveId: isMainline ? null : parentMoveId,
        isVariationStart: !isMainline && firstMoveId === entry.id,
        variationFirstMoveIds: childVariationFirstMoveIds,
        previousMoveId,
        nextMoveId: null,
      };
      if (previousMoveId && index[previousMoveId]) {
        index[previousMoveId].nextMoveId = entry.id;
      }
      if (Array.isArray(entry.postItems)) {
        entry.postItems.forEach((item) => {
          if (item.type === "rav" && item.rav) {
            const childFirstMoveId = walkVariation(item.rav, gameBeforeMove, false, ply, entry.id);
            if (childFirstMoveId) childVariationFirstMoveIds.push(childFirstMoveId);
          }
        });
      } else if (Array.isArray(entry.ravs)) {
        entry.ravs.forEach((child) => {
          const childFirstMoveId = walkVariation(child, gameBeforeMove, false, ply, entry.id);
          if (childFirstMoveId) childVariationFirstMoveIds.push(childFirstMoveId);
        });
      }
      lastMoveId = entry.id;
    }
    return firstMoveId;
  };

  walkVariation(root, new Chess(), true, 0);
  return index;
};

/**
 * Resolve a single move id to board position metadata by traversing model.
 */
export const resolveMovePositionById = (
  pgnModel: PgnModelForMoves,
  moveId: string,
): MovePositionResolved | null => {
  if (!moveId || !pgnModel?.root) return null;

  const root = pgnModel.root as PgnVariationNode;

  const walkVariation = (
    variation: PgnVariationNode,
    baseGame: Chess,
    isMainline: boolean,
    mainlinePly: number,
    parentMoveId: string | null = null,
  ): MovePositionResolved | null => {
    const game = cloneGame(baseGame);
    let ply = mainlinePly;
    let lastMoveId: string | null = parentMoveId;

    for (const entry of variation.entries) {
      if (entry.type === "variation") {
        const found = walkVariation(entry, game, false, ply, lastMoveId);
        if (found) return found;
        continue;
      }
      if (entry.type !== "move") continue;

      const gameBeforeMove = cloneGame(game);
      const moved = applySanWithFallback(game, entry.san);
      if (!moved) continue;

      if (isMainline) ply += 1;
      const resolved: MovePositionResolved = {
        fen: game.fen(),
        lastMove: moved.from && moved.to ? [moved.from, moved.to] : null,
        mainlinePly: isMainline ? ply : null,
        parentMoveId: isMainline ? null : parentMoveId,
      };
      if (entry.id === moveId) return resolved;

      if (Array.isArray(entry.postItems)) {
        for (const item of entry.postItems) {
          if (item.type === "rav" && item.rav) {
            const found = walkVariation(item.rav, gameBeforeMove, false, ply, entry.id);
            if (found) return found;
          }
        }
      } else if (Array.isArray(entry.ravs)) {
        for (const child of entry.ravs) {
          const found = walkVariation(child, gameBeforeMove, false, ply, entry.id);
          if (found) return found;
        }
      }
      lastMoveId = entry.id;
    }
    return null;
  };

  return walkVariation(root, new Chess(), true, 0);
};

/**
 * Build mainline ply index by move id.
 */
export const buildMainlinePlyByMoveId = (pgnModel: PgnModelForMoves): MainlinePlyByMoveId => {
  const byId: MainlinePlyByMoveId = {};
  const entries = pgnModel?.root?.entries;
  if (!Array.isArray(entries)) return byId;
  let ply = 0;
  entries.forEach((entry) => {
    if (entry?.type !== "move" || !entry?.id) return;
    ply += 1;
    byId[entry.id] = ply;
  });
  return byId;
};

/**
 * Remove comments and side-variations from PGN source for board parser fallback.
 */
export const stripAnnotationsForBoardParser = (source: string): string => {
  let out = "";
  let variationDepth = 0;
  let inComment = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inComment) {
      if (ch === "}") inComment = false;
      continue;
    }
    if (ch === "{") {
      inComment = true;
      continue;
    }
    if (ch === "(") {
      variationDepth += 1;
      continue;
    }
    if (ch === ")") {
      variationDepth = Math.max(0, variationDepth - 1);
      continue;
    }
    if (variationDepth > 0) continue;
    out += ch;
  }
  return out;
};
