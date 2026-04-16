import { Chess, type Move } from "chess.js";
import type {
  PgnModel,
  PgnVariationNode,
  PgnEntryNode,
  PgnMoveNode,
  PgnPostItem,
} from "../../../parts/pgnparser/src/pgn_model";
import { log } from "../logger";

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
 * - `replayPvToPosition(startFen, pvSans, upToIndex)`
 */

/**
 * Board-position metadata for a single move node in the PGN tree.
 *
 * Written by `buildMovePositionById` and stored in `MovePositionIndex`.
 * Read by `navigation.ts` for prev/next/variation traversal and by the board
 * renderer to display the correct position and highlight squares.
 */
export type MovePositionRecord = {
  /** FEN string of the position *after* this move was played. */
  fen: string;
  /** From- and to-squares of the move (`[from, to]`), or `null` for the start position. */
  lastMove: [string, string] | null;
  /** Sequential 1-based half-move count within the mainline (starting from the
   *  first recorded move, regardless of any `[FEN]` / `[SetUp]` header),
   *  or `null` for variation moves. */
  mainlinePly: number | null;
  /** Move ID of the move that starts the variation containing this move,
   *  or `null` for mainline moves. */
  parentMoveId: string | null;
  /** `true` when this is the first move of a nested variation (RAV or inline). */
  isVariationStart?: boolean;
  /** Move IDs of the first move of each child variation branching *after* this move. */
  variationFirstMoveIds: string[];
  /** Move ID of the preceding move in the same variation, or `null` at the variation start. */
  previousMoveId?: string | null;
  /** Move ID of the next move in the same variation, or `null` at the variation end. */
  nextMoveId?: string | null;
};

/**
 * Lightweight board-position result returned by `resolveMovePositionById`.
 *
 * Contains only the fields needed to display a position; use `MovePositionIndex`
 * when navigation (prev/next/variation links) is also required.
 */
export type MovePositionResolved = {
  /** FEN string of the position *after* this move was played. */
  fen: string;
  /** From- and to-squares of the move (`[from, to]`), or `null` for the start position. */
  lastMove: [string, string] | null;
  /** Sequential 1-based half-move count within the mainline (starting from the
   *  first recorded move, regardless of any `[FEN]` / `[SetUp]` header),
   *  or `null` for variation moves. */
  mainlinePly: number | null;
  /** Move ID of the variation-start move, or `null` for mainline moves. */
  parentMoveId: string | null;
};

/**
 * Full move-position index keyed by move ID.
 *
 * Built once per game load by `buildMovePositionById` and stored on the session.
 * Provides O(1) lookup of any move's board position and navigation links.
 */
export type MovePositionIndex = Record<string, MovePositionRecord>;

/**
 * Sequential half-move index (1-based) for mainline moves, keyed by move ID.
 *
 * Built by `buildMainlinePlyByMoveId`; covers only mainline moves.
 *
 * **Limitation**: the count always starts at 1 for the first recorded move,
 * regardless of any `[FEN]` / `[SetUp]` header.  For games that begin from a
 * custom position the values will *not* match the actual chess half-move numbers.
 */
export type MainlinePlyByMoveId = Record<string, number>;

/**
 * Clone a Chess instance from current FEN.
 */
const cloneGame = (game: Chess): Chess => {
  const clonedGame = new Chess();
  clonedGame.load(game.fen());
  return clonedGame;
};

/**
 * Detect PGN null/pass move SAN tokens (for example `--`, `1.--`, `...--`, `--?!`).
 */
const isNullMoveSan = (san: string): boolean => {
  if (!san || typeof san !== "string") return false;
  const normalized = san
    .trim()
    .replace(/^\d+\.(?:\.\.)?/, "")
    .replace(/^(?:\.\.\.|…)+/, "")
    .replaceAll(/[!?]+/g, "")
    .trim();
  return normalized === "--";
};

/** Apply a null/pass move to advance side-to-move without changing piece placement. */
const applyNullMove = (game: Chess): boolean => {
  try {
    game.move("--");
    return true;
  } catch {
    return false;
  }
};

/**
 * Apply a SAN string to a `chess.js` game using tolerant normalization fallbacks.
 *
 * Tries the raw SAN first, then progressively strips move-number prefixes
 * (`1.`, `1...`), ellipsis prefixes (`...`, `…`), and annotation glyphs
 * (`!`, `?`, `!!`, `??`, `!?`, `?!`) in combination. Mutates `game` in place
 * when a candidate succeeds.
 *
 * @param game - The `chess.js` `Chess` instance to apply the move to (mutated on success).
 * @param san - Raw SAN string, possibly containing move numbers or annotation glyphs.
 * @returns The `chess.js` `Move` object on success, or `null` when all candidates fail.
 */
export const applySanWithFallback = (game: Chess, san: string): Move | null => {
  if (!san || typeof san !== "string") return null;
  const raw = san.trim();
  if (!raw) return null;
  // Reject null/pass moves (`--`). chess.js accepts them via game.move() internally
  // but they are not real chess moves and must not be indexed or replayed on the board.
  if (raw === "--") return null;
  const candidates = new Set([raw]);
  candidates.add(raw.replaceAll(/[!?]+/g, ""));
  candidates.add(raw.replace(/^\d+\.(?:\.\.)?/, "").trim());
  candidates.add(raw.replace(/^(?:\.\.\.|…)+/, "").trim());
  candidates.add(
    raw
      .replace(/^\d+\.(?:\.\.)?/, "")
      .replace(/^(?:\.\.\.|…)+/, "")
      .replaceAll(/[!?]+/g, "")
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
  // Intentionally silent: SAN replay misses are frequent in imported side-variations.
  return null;
};

/**
 * RAV children attached to a move: prefer `postItems` order when present,
 * otherwise fall back to `ravs` (matches `resolveMovePositionById`).
 */
const ravVariationsForMove = (move: PgnMoveNode): PgnVariationNode[] => {
  if (Array.isArray(move.postItems)) {
    const out: PgnVariationNode[] = [];
    for (const item of move.postItems) {
      if (item.type === "rav" && item.rav) {
        out.push(item.rav);
      }
    }
    return out;
  }
  if (Array.isArray(move.ravs)) {
    return move.ravs;
  }
  return [];
};

/**
 * Record that a nested variation's first move branches from `branchParentMoveId`.
 */
const pushVariationFirstChild = (
  index: MovePositionIndex,
  branchParentMoveId: string | null,
  childFirstMoveId: string,
): void => {
  if (!branchParentMoveId) return;
  const parent: MovePositionRecord | undefined = index[branchParentMoveId];
  if (!parent) return;
  if (!Array.isArray(parent.variationFirstMoveIds)) {
    parent.variationFirstMoveIds = [];
  }
  parent.variationFirstMoveIds.push(childFirstMoveId);
};

type WalkVariationArgs = {
  index: MovePositionIndex;
  variation: PgnVariationNode;
  baseGame: Chess;
  isMainline: boolean;
  mainlinePly: number;
  parentMoveId: string | null;
};

/** Mutable cursor while walking one variation's `entries` array. */
type IndexWalkCursor = {
  mainlinePly: number;
  firstMoveId: string | null;
  lastMoveId: string | null;
};

/**
 * Nested `(…)` variation entry: recurse and attach first-move link to the branch parent.
 */
const processNestedVariationForIndex = (
  index: MovePositionIndex,
  game: Chess,
  cursor: IndexWalkCursor,
  nested: PgnVariationNode,
): void => {
  const childFirst: string | null = walkVariationForIndex({
    index,
    variation: nested,
    baseGame: game,
    isMainline: false,
    mainlinePly: cursor.mainlinePly,
    parentMoveId: cursor.lastMoveId,
  });
  if (childFirst) {
    pushVariationFirstChild(index, cursor.lastMoveId, childFirst);
  }
};

/**
 * Apply one SAN move, write its `MovePositionRecord`, link prev/next, walk RAVs.
 */
const processMoveEntryForIndex = (
  index: MovePositionIndex,
  game: Chess,
  cursor: IndexWalkCursor,
  move: PgnMoveNode,
  isMainline: boolean,
  parentMoveId: string | null,
): void => {
  const gameBeforeMove: Chess = cloneGame(game);
  const isNullMove: boolean = isNullMoveSan(move.san);
  const moved: Move | null = isNullMove ? null : applySanWithFallback(game, move.san);
  if (isNullMove && !applyNullMove(game)) {
    log.warn("move_position", `processMoveEntryForIndex: null move rejected id="${move.id}" san="${move.san}"`);
    return;
  }
  if (!moved && !isNullMove) {
    log.warn("move_position", `processMoveEntryForIndex: skipping move id="${move.id}" san="${move.san}"`);
    return;
  }

  if (isMainline) {
    cursor.mainlinePly += 1;
  }
  if (!cursor.firstMoveId) {
    cursor.firstMoveId = move.id;
  }

  const childVariationFirstMoveIds: string[] = [];
  const previousMoveId: string | null = cursor.lastMoveId;

  index[move.id] = {
    fen: game.fen(),
    lastMove: moved?.from && moved?.to ? [moved.from, moved.to] : null,
    mainlinePly: isMainline ? cursor.mainlinePly : null,
    parentMoveId: isMainline ? null : parentMoveId,
    isVariationStart: !isMainline && cursor.firstMoveId === move.id,
    variationFirstMoveIds: childVariationFirstMoveIds,
    previousMoveId,
    nextMoveId: null,
  };

  if (previousMoveId && index[previousMoveId]) {
    index[previousMoveId].nextMoveId = move.id;
  }

  for (const rav of ravVariationsForMove(move)) {
    const ravFirst: string | null = walkVariationForIndex({
      index,
      variation: rav,
      baseGame: gameBeforeMove,
      isMainline: false,
      mainlinePly: cursor.mainlinePly,
      parentMoveId: move.id,
    });
    if (ravFirst) {
      childVariationFirstMoveIds.push(ravFirst);
    }
  }

  cursor.lastMoveId = move.id;
};

/**
 * Depth-first walk: populate `index` and return the first move id in this variation, or null.
 */
const walkVariationForIndex = (args: WalkVariationArgs): string | null => {
  const { index, variation, baseGame, isMainline, parentMoveId } = args;

  const game: Chess = cloneGame(baseGame);
  const cursor: IndexWalkCursor = {
    mainlinePly: args.mainlinePly,
    firstMoveId: null,
    lastMoveId: parentMoveId,
  };

  for (const entry of variation.entries) {
    if (entry.type === "variation") {
      processNestedVariationForIndex(index, game, cursor, entry);
      continue;
    }
    if (entry.type !== "move") continue;
    processMoveEntryForIndex(index, game, cursor, entry, isMainline, parentMoveId);
  }

  return cursor.firstMoveId;
};

/**
 * Build a complete `MovePositionIndex` for all moves in the PGN game tree.
 *
 * Performs a depth-first walk of the mainline and all nested variations (RAVs).
 * Each entry in the returned index contains the FEN after the move, from/to
 * squares, mainline ply, parent-move link, variation-start flag, child-variation
 * first-move IDs, and doubly-linked prev/next pointers within each variation.
 *
 * Called once per game load (in `session_model` and `pgn_runtime`) and stored
 * on the session for O(1) board-position and navigation lookups.
 *
 * @param pgnModel - Parsed PGN game model exposing a `root` variation node.
 * @returns Index keyed by move ID; empty object when `pgnModel.root` is absent.
 */
export const buildMovePositionById = (pgnModel: PgnModel): MovePositionIndex => {
  const index: MovePositionIndex = {};
  if (!pgnModel?.root) return index;

  const startFen = pgnModel.headers?.find(h => h.key === "FEN")?.value?.trim();
  const baseGame = startFen ? new Chess(startFen) : new Chess();

  walkVariationForIndex({
    index,
    variation: pgnModel.root,
    baseGame,
    isMainline: true,
    mainlinePly: 0,
    parentMoveId: null,
  });
  return index;
};

/**
 * Resolve a single move ID to board-position metadata by traversing the PGN tree.
 *
 * Performs a targeted depth-first search; cheaper than building the full index
 * when only one position is needed (e.g. move-click in `PgnTextEditor`).
 * Checks the move itself and all sub-variations reachable from it.
 *
 * @param pgnModel - Parsed PGN game model exposing a `root` variation node.
 * @param moveId - ID of the move node to resolve.
 * @returns FEN, last-move squares, mainline ply, and parent-move ID for the move,
 *   or `null` when the move ID is not found or `pgnModel.root` is absent.
 */
export const resolveMovePositionById = (
  pgnModel: PgnModel,
  moveId: string,
): MovePositionResolved | null => {
  if (!moveId || !pgnModel?.root) {
    log.debug("move_position", () => `resolveMovePositionById: early exit moveId="${moveId}" hasRoot=${!!pgnModel?.root}`);
    return null;
  }

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

    // Helper to resolve mainline move and test for match
    const resolveMoveEntry = (
      entry: PgnMoveNode,
      game: Chess,
      ply: number,
      isMainline: boolean,
      parentMoveId: string | null
    ): MovePositionResolved | null => {
      const gameBeforeMove = cloneGame(game);
      const isNullMove: boolean = isNullMoveSan(String(entry?.san ?? ""));
      const moved = isNullMove ? null : applySanWithFallback(game, entry.san);
      if (isNullMove && !applyNullMove(game)) {
        return null;
      }
      if (!moved && !isNullMove) {
        return null;
      }
      const nextPly = isMainline ? ply + 1 : ply;

      const resolved: MovePositionResolved = {
        fen: game.fen(),
        lastMove: moved?.from && moved?.to ? [moved.from, moved.to] : null,
        mainlinePly: isMainline ? nextPly : null,
        parentMoveId: isMainline ? null : parentMoveId,
      };
      if (entry.id === moveId) {
        return resolved;
      }
      // Check for sub-variations after this move
      const foundInSub = findInSubVariations(entry, gameBeforeMove, nextPly, entry.id);
      if (foundInSub) return foundInSub;
      return null;
    };

    // Helper to traverse postItems/ravs variations for a move, used after resolving main move entry
    const findInSubVariations = (
      entry: PgnMoveNode,
      gameBeforeMove: Chess,
      ply: number,
      parentMoveId: string | null
    ): MovePositionResolved | null => {
      const ravsToCheck = Array.isArray(entry.postItems)
        ? entry.postItems.flatMap((item: PgnPostItem) => item.type === "rav" && item.rav ? [item.rav] : [])
        : (() => {
            if (Array.isArray(entry.ravs)) {
              return entry.ravs;
            }
            return [];
          })()
     
      for (const rav of ravsToCheck) {
        const found = walkVariation(rav, gameBeforeMove, false, ply, entry.id);
        if (found) return found;
      }
      return null;
    };

    for (const entry of variation.entries) {
      if (entry.type === "variation") {
        const found = walkVariation(entry, game, false, ply, lastMoveId);
        if (found) return found;
        continue;
      }
      if (entry.type !== "move") continue;

      const result = resolveMoveEntry(entry, game, ply, isMainline, parentMoveId);
      if (result) return result;

      if (isMainline) ply += 1;
      lastMoveId = entry.id;
    }
    log.warn("move_position", `walkVariation: target="${moveId}" not found (isMainline=${isMainline} parentMoveId="${parentMoveId}")`);
    return null;
  };

  const startFen = pgnModel.headers?.find(h => h.key === "FEN")?.value?.trim();
  const startGame = startFen ? new Chess(startFen) : new Chess();
  return walkVariation(pgnModel.root, startGame, true, 0);
};

/**
 * Build a sequential half-move index for mainline moves only.
 *
 * Iterates only `pgnModel.root.entries`; variation moves are excluded.
 * Cheaper than `buildMovePositionById` when only relative ply numbers are needed
 * (e.g. scroll anchoring or progress display in the text editor).
 *
 * The index always starts at 1 for the first recorded move.  It has no access
 * to PGN headers, so it cannot account for a `[FEN]` / `[SetUp]` starting
 * position; the values will not match actual chess move numbers for such games.
 *
 * @param pgnModel - Parsed PGN game model exposing a `root` variation node.
 * @returns Map of move ID → sequential 1-based ply; empty object when `root` has no entries.
 */
export const buildMainlinePlyByMoveId = (pgnModel: PgnModel): MainlinePlyByMoveId => {
  const byId: MainlinePlyByMoveId = {};
  const entries = pgnModel?.root?.entries;
  if (!Array.isArray(entries)) return byId;
  let ply = 0;
  entries.forEach((entry: PgnEntryNode): void => {
    if (entry?.type !== "move" || !entry?.id) return;
    ply += 1;
    byId[entry.id] = ply;
  });
  return byId;
};

/**
 * Result of replaying engine PV moves to a specific half-move index.
 * Returned by `replayPvToPosition`.
 */
export type PvPositionResult = {
  /** FEN string of the position reached after applying moves up to `upToIndex`. */
  fen: string;
  /** From- and to-squares of the last applied move, or `null` when no moves were applied. */
  lastMove: [string, string] | null;
};

/**
 * Replay engine principal-variation (PV) SAN moves from a starting FEN.
 *
 * Applies moves from `pvSans[0]` up to and including `pvSans[upToIndex]` (0-based,
 * inclusive). Used in `AppShell` to preview positions when the user hovers over
 * individual PV move tokens in the analysis panel.
 *
 * Returns the position reached so far when `startFen` is malformed or a SAN
 * fails to apply (partial replay); never throws.
 *
 * @param startFen - FEN string of the position before the first PV move.
 * @param pvSans - Ordered array of SAN strings from the engine PV line.
 * @param upToIndex - 0-based index of the last PV move to apply (inclusive).
 * @returns FEN and last-move squares of the position after replaying to `upToIndex`.
 */
export const replayPvToPosition = (
  startFen: string,
  pvSans: string[],
  upToIndex: number,
): PvPositionResult => {
  let game: Chess;
  try {
    game = new Chess(startFen);
  } catch {
    log.warn("move_position", `replayPvToPosition: malformed startFen="${startFen}"`);
    return { fen: startFen, lastMove: null };
  }

  let lastMove: [string, string] | null = null;
  const limit = Math.min(upToIndex, pvSans.length - 1);
  for (let i = 0; i <= limit; i++) {
    const moved = applySanWithFallback(game, pvSans[i] ?? "");
    if (!moved) break;
    lastMove = [moved.from, moved.to];
  }

  return { fen: game.fen(), lastMove };
};

/**
 * Strip PGN comments (`{ … }`) and side-variations (`( … )`) from raw PGN source.
 *
 * Produces a stripped string suitable for loading into `chess.js` as a fallback
 * when the custom PGN parser fails. Called via the injected
 * `stripAnnotationsForBoardParserFn` callback in `session_model` and `pgn_runtime`.
 *
 * The character-by-character scan correctly handles nesting and ignores content
 * inside comments (so nested braces or parentheses inside `{ }` are skipped).
 *
 * @param source - Raw PGN text, possibly containing comments and RAVs.
 * @returns PGN text with all `{ … }` comment spans and `( … )` RAV spans removed.
 */
export const stripAnnotationsForBoardParser = (source: string): string => {
  let out = "";
  let variationDepth = 0;
  let inComment = false;
  for (const ch of source) {
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
