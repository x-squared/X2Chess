/**
 * resolveAnchors — walk a PGN model and collect all anchor definitions with
 * their board positions, move paths, and surrounding comment context.
 *
 * Integration API:
 * - `resolveAnchors(pgnModel)` — returns all `ResolvedAnchor` entries in PGN order.
 *
 * Communication API:
 * - Pure function; no I/O or side effects.
 * - Accepts a `PgnModel` from `parts/pgnparser`.
 */

import { Chess } from "chess.js";
import { applySanWithFallback } from "../../../board/move_position";
import {
  parseAnchorAnnotations,
  stripAnchorAnnotations,
} from "../../resources/services/anchor_parser";

// ── Public types ──────────────────────────────────────────────────────────────

export type ResolvedAnchor = {
  /** Anchor identifier, unique within the game (first definition wins). */
  id: string;
  /** Human-readable label. */
  text: string;
  /** Move node ID where the anchor is defined. */
  moveId: string;
  /** SAN of the anchor move (e.g. "Nd5"). */
  moveSan: string;
  /** FEN after the anchor move. */
  fen: string;
  /** From/to squares of the anchor move, or null when unavailable. */
  lastMove: [string, string] | null;
  /**
   * Displayable text of the comment immediately preceding the anchor move,
   * stripped of all `[%...]` annotations.
   */
  precedingCommentText: string;
  /**
   * Displayable text of the anchor's own comment (stripped of the anchor markup
   * itself), representing the annotation/note at the anchor point.
   */
  followingCommentText: string;
  /**
   * Full SAN move sequence from the initial position to the anchor move
   * (formatted as "1.e4 e5 2.Nf3 Nc6 … 13.Rd1").
   */
  movePath: string;
};

// ── Internal runtime types ────────────────────────────────────────────────────

/** Minimal comment shape present on move nodes at runtime. */
type RtComment = {
  raw?: string;
};

/** Minimal post-item shape present on move nodes at runtime. */
type RtPostItem =
  | { type: "comment"; comment?: RtComment }
  | { type: "rav"; rav?: RtVariation };

/** Move node shape expected at runtime (superset of `PgnMoveNode`). */
type RtMove = {
  type: "move";
  id: string;
  san: string;
  commentsBefore?: RtComment[];
  postItems?: RtPostItem[];
};

type RtEntry =
  | RtMove
  | { type: "comment"; raw?: string }
  | { type: string };

type RtVariation = {
  type?: "variation";
  entries: RtEntry[];
  trailingComments?: RtComment[];
};

type RtModel = {
  root?: RtVariation;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const stripAllCommands = (raw: string | undefined): string => {
  if (!raw) return "";
  // Strip any [%...] command annotation.
  return raw.replace(/\[%[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
};

/**
 * Collect comments-after from canonical postItems.
 */
const getCommentsAfter = (move: RtMove): RtComment[] => {
  return (move.postItems ?? [])
    .filter(
      (item): item is { type: "comment"; comment: RtComment } =>
        item.type === "comment" && !!item.comment,
    )
    .map((item) => item.comment);
};

/**
 * Collect child variations (RAVs) from canonical postItems.
 */
const getChildVariations = (move: RtMove): RtVariation[] => {
  return (move.postItems ?? [])
    .filter(
      (item): item is { type: "rav"; rav: RtVariation } =>
        item.type === "rav" && !!item.rav,
    )
    .map((item) => item.rav);
};

/**
 * Build a display string for the move path.
 * `halfMoveOffset` = number of half-moves already played before the first entry
 * in this variation (0 for the root variation from the standard start position).
 */
const buildMovePath = (sans: string[], halfMoveOffset: number): string => {
  const parts: string[] = [];
  for (let i = 0; i < sans.length; i += 1) {
    const globalHalfMove: number = halfMoveOffset + i;
    const isWhite: boolean = globalHalfMove % 2 === 0;
    if (isWhite) {
      const moveNum: number = Math.floor(globalHalfMove / 2) + 1;
      parts.push(`${moveNum}.`);
    }
    parts.push(sans[i]);
  }
  return parts.join(" ").trim();
};

const cloneGame = (game: Chess): Chess => {
  const next = new Chess();
  next.load(game.fen());
  return next;
};

// ── Walk ──────────────────────────────────────────────────────────────────────

/**
 * Recursive variation walker. Collects `ResolvedAnchor` entries from anchor
 * annotations found in move comments.
 *
 * @param variation      - Current variation node.
 * @param baseGame       - Chess board state at the start of this variation (not mutated).
 * @param baseSans       - SAN sequence from the root to the start of this variation.
 * @param halfMoveOffset - How many half-moves the baseSans represent (for move number display).
 * @param seenIds        - Set of anchor IDs already collected (first definition wins).
 * @param result         - Accumulator array; entries are appended in PGN order.
 * @param lastCommentText - Displayable text of the most recent comment before the current move.
 */
const walkVariation = (
  variation: RtVariation,
  baseGame: Chess,
  baseSans: string[],
  halfMoveOffset: number,
  seenIds: Set<string>,
  result: ResolvedAnchor[],
  lastCommentText: string,
): void => {
  const game = cloneGame(baseGame);
  const sans: string[] = [...baseSans];
  let prevCommentText: string = lastCommentText;
  let currentHalfMove: number = halfMoveOffset;

  for (const entry of variation.entries) {
    if (entry.type === "comment") {
      const text = stripAllCommands((entry as { type: "comment"; raw?: string }).raw);
      if (text) prevCommentText = text;
      continue;
    }

    if (entry.type !== "move") continue;
    const move = entry as RtMove;

    // Check commentsBefore for context (update prevCommentText).
    if (Array.isArray(move.commentsBefore)) {
      for (const cb of move.commentsBefore) {
        const text = stripAllCommands(cb.raw);
        if (text) prevCommentText = text;
      }
    }

    const capturedPrevComment: string = prevCommentText;

    const moved = applySanWithFallback(game, move.san);
    if (!moved) continue;

    sans.push(move.san);
    currentHalfMove += 1;
    const fen: string = game.fen();
    const lastMove: [string, string] | null =
      moved.from && moved.to ? [moved.from, moved.to] : null;
    const movePath: string = buildMovePath(sans, halfMoveOffset);

    const commentsAfter = getCommentsAfter(move);
    for (const comment of commentsAfter) {
      const raw = comment.raw ?? "";
      const anchors = parseAnchorAnnotations(raw);
      for (const anchor of anchors) {
        if (!seenIds.has(anchor.id)) {
          seenIds.add(anchor.id);
          result.push({
            id: anchor.id,
            text: anchor.text,
            moveId: move.id,
            moveSan: move.san,
            fen,
            lastMove,
            precedingCommentText: capturedPrevComment,
            followingCommentText: stripAnchorAnnotations(
              stripAllCommands(raw),
            ),
            movePath,
          });
        }
      }
      // Update prevCommentText from the comment (stripped of annotations).
      const stripped = stripAllCommands(raw);
      if (stripped) prevCommentText = stripped;
    }

    // Walk child variations from this move.
    const childVariations = getChildVariations(move);
    for (const child of childVariations) {
      walkVariation(child, game, sans, currentHalfMove, seenIds, result, "");
    }
  }

  // Trailing comments on the variation — update prevCommentText but no anchors here.
  for (const tc of variation.trailingComments ?? []) {
    const text = stripAllCommands(tc.raw);
    if (text) prevCommentText = text;
    void prevCommentText; // suppress unused-variable lint warning
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Walk `pgnModel` and collect all anchor definitions in PGN order.
 * Duplicate anchor IDs are silently ignored (first definition wins).
 *
 * @param pgnModel - The active PGN model (same shape as used in PgnTextEditor).
 * @returns Array of `ResolvedAnchor` entries, in the order they appear in the game.
 */
export const resolveAnchors = (pgnModel: unknown): ResolvedAnchor[] => {
  const model = pgnModel as RtModel;
  if (!model?.root) return [];

  const result: ResolvedAnchor[] = [];
  const seenIds = new Set<string>();

  try {
    walkVariation(model.root, new Chess(), [], 0, seenIds, result, "");
  } catch {
    // Tolerant: return whatever was collected before the error.
  }

  return result;
};
