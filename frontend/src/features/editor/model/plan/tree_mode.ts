/**
 * Tree mode plan builder and variation numbering.
 *
 * Integration API:
 * - `buildTreeEditorPlan(model, state, numberingStrategy)` — populates `state.blocks`
 *   with one block per variation (DFS order).  Each non-mainline block starts with a
 *   `branch_header` token carrying the variation label.
 * - `VariationNumberingStrategy` — type for custom label functions.
 * - `alphaNumericPathStrategy` — default label strategy (A, B, A.1, …).
 */

import type { PlanState, PgnComment, PgnEntry, PgnModel, PgnMove, PgnVariation } from "./types";
import { nagGlyph } from "../../../../../../parts/pgnparser/src/nag_defs";
import {
  addCommentToken,
  addInlineToken,
  addSpace,
  addTextWithBreaks,
  applyPersistentIndentDelta,
  buildRichCommentView,
  currentBlock,
  nextBlock,
  parseMoveNumberToken,
  shouldSuppressMoveNumberToken,
  getMoveCommentsAfter,
  getMoveRavs,
} from "./types";

// ── Variation numbering ───────────────────────────────────────────────────────

/**
 * Maps a numbering path (structural `variationPath` with the leading `[0]` stripped)
 * to a human-readable label.
 *
 * Examples using `alphaNumericPathStrategy`:
 *   [0]       → "A"    (first top-level RAV)
 *   [1]       → "B"    (second top-level RAV)
 *   [0, 0]    → "A.1"  (first sub-RAV of A)
 *   [0, 1]    → "A.2"  (second sub-RAV of A)
 *   [0, 0, 0] → "A.1.1"
 *   [1, 0]    → "B.1"
 */
export type VariationNumberingStrategy = (path: readonly number[]) => string;

/**
 * Default numbering strategy.
 * - Depth-0 segment: uppercase letter (0 → A, 1 → B, …).
 * - Deeper segments: 1-based integer.
 * - Segments joined with ".".
 */
export const alphaNumericPathStrategy: VariationNumberingStrategy = (
  path: readonly number[],
): string => {
  if (path.length === 0) return "";
  return path
    .map((index: number, depth: number): string =>
      depth === 0 ? String.fromCharCode(65 + index) : (index + 1).toString(),
    )
    .join(".");
};

// ── Tree comment emitter ──────────────────────────────────────────────────────

const emitTreeComment = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  applyIntroStyling: boolean,
  variationDepth: number,
): void => {
  // Match text-mode marker behaviour in tree mode via shared formatter.
  const view = buildRichCommentView(comment, rawText);
  applyPersistentIndentDelta(state, view.indentDelta);
  addCommentToken(
    state,
    comment,
    view.visibleText,
    rawText,
    view.hasIndentDirective,
    view.indentDirectiveDepth,
    applyIntroStyling,
    false,
    applyIntroStyling,
    variationDepth,
  );
  // Intro comments occupy their own line before the branch moves.
  const shouldBreakAfterComment: boolean = applyIntroStyling
    || state.commentLineBreakPolicy === "always"
    || (state.commentLineBreakPolicy === "mainline_only" && variationDepth === 0);
  if (shouldBreakAfterComment) {
    nextBlock(state);
  } else {
    addSpace(state);
  }
};

// ── Tree-local addComment (manages intro-styling state per variation) ─────────

const addComment = (state: PlanState, comment: PgnComment, variationDepth: number): void => {
  const rawText: string = String(comment.raw ?? "");
  const isFirstComment: boolean = !state.firstCommentId;
  if (isFirstComment) state.firstCommentId = comment.id;
  const applyIntroStyling: boolean = isFirstComment && !state.firstMoveEmitted;
  emitTreeComment(state, comment, rawText, applyIntroStyling, variationDepth);
};

// ── Tree variation traversal ──────────────────────────────────────────────────

/**
 * Emit a single variation as a flat block in tree mode.
 *
 * - All moves/comments of THIS variation land in the current block.
 * - Child RAVs are collected during the walk and emitted as new blocks (DFS) after
 *   this variation's content.
 * - `state.firstCommentId` and `state.firstMoveEmitted` are saved and reset so the
 *   first comment of each variation receives intro styling independently.
 */
const emitTreeVariation = (
  variation: PgnVariation,
  path: readonly number[],
  isMainLine: boolean,
  state: PlanState,
  numberingStrategy: VariationNumberingStrategy,
): void => {
  const savedFirstCommentId: string | null = state.firstCommentId;
  const savedFirstMoveEmitted: boolean = state.firstMoveEmitted;
  state.firstCommentId = null;
  state.firstMoveEmitted = false;

  // Branch header for non-mainline blocks.
  if (!isMainLine) {
    const numberingPath: readonly number[] = path.slice(1);
    const label: string = numberingStrategy(numberingPath);
    addInlineToken(state, label, "tree-branch-header", "branch_header", {
      variationPath: path.join("."),
      label,
    });
    addSpace(state);
  }

  const childRavs: PgnVariation[] = [];
  let moveSide: "white" | "black" = "white";
  const hoistedBeforeCommentMoveIds = new Set<string>();

  for (let idx: number = 0; idx < variation.entries.length; idx += 1) {
    const entry: PgnEntry = variation.entries[idx];

    if (entry.type === "variation") {
      childRavs.push(entry);
      continue;
    }

    if (entry.type === "comment") {
      addComment(state, entry, variation.depth);
      continue;
    }

    if (entry.type === "move_number") {
      const lookahead: PgnEntry | undefined = variation.entries[idx + 1];
      if (
        lookahead?.type === "move" &&
        Array.isArray((lookahead as PgnMove).commentsBefore) &&
        (lookahead as PgnMove).commentsBefore.length > 0
      ) {
        (lookahead as PgnMove).commentsBefore.forEach((c: PgnComment): void => addComment(state, c, variation.depth));
        hoistedBeforeCommentMoveIds.add((lookahead as PgnMove).id);
      }
      const parsed = parseMoveNumberToken(entry.text);
      if (parsed.side === "white" || parsed.side === "black") moveSide = parsed.side;
      if (shouldSuppressMoveNumberToken(state, parsed)) {
        continue;
      }
      addTextWithBreaks(
        state,
        parsed.displayText,
        `${variation.depth === 0 ? "text-editor-main-move" : "text-editor-variation-move-number"} text-editor-move-number-token move-number`,
        "move_number",
        { nodeId: entry.id || "", variationDepth: variation.depth, moveNumberSide: parsed.side },
      );
      if (!parsed.simplified) addSpace(state);
      continue;
    }

    if (entry.type === "result") {
      addTextWithBreaks(state, entry.text, "text-editor-result", "result", { nodeId: entry.id || "" });
      addSpace(state);
      continue;
    }

    if (entry.type === "nag") {
      addTextWithBreaks(state, nagGlyph(entry.text), "text-editor-nag", "nag", { nodeId: entry.id || "" });
      addSpace(state);
      continue;
    }

    if (entry.type === "move") {
      const side: "white" | "black" = moveSide;
      const moveClass: string = variation.depth === 0
        ? `text-editor-main-move move-${side}`
        : `text-editor-variation-move move-${side}`;

      if (!hoistedBeforeCommentMoveIds.has(entry.id)) {
        entry.commentsBefore.forEach((c: PgnComment): void => addComment(state, c, variation.depth));
      }
      addTextWithBreaks(state, entry.san, moveClass, "move", {
        nodeId: entry.id,
        variationDepth: variation.depth,
        moveSide: side,
      });
      state.firstMoveEmitted = true;
      addSpace(state);
      entry.nags.forEach((nag: string): void => {
        addTextWithBreaks(state, nagGlyph(nag), "text-editor-nag", "nag", { moveId: entry.id });
        addSpace(state);
      });

      getMoveCommentsAfter(entry).forEach((c: PgnComment): void => addComment(state, c, variation.depth));
      getMoveRavs(entry).forEach((rav: PgnVariation): void => { childRavs.push(rav); });

      moveSide = moveSide === "white" ? "black" : "white";
    }
  }

  variation.trailingComments.forEach((c: PgnComment): void => addComment(state, c, variation.depth));

  // Recursively emit child variations as new blocks (DFS).
  for (let i: number = 0; i < childRavs.length; i += 1) {
    const childPath: readonly number[] = [...path, i];
    nextBlock(state);
    const childBlock = currentBlock(state);
    childBlock.variationPath = childPath;
    childBlock.isCollapsible = true;
    childBlock.isMainLine = false;
    emitTreeVariation(childRavs[i], childPath, false, state, numberingStrategy);
  }

  state.firstCommentId = savedFirstCommentId;
  state.firstMoveEmitted = savedFirstMoveEmitted;
};

// ── Public builder ────────────────────────────────────────────────────────────

export const buildTreeEditorPlan = (
  model: PgnModel,
  state: PlanState,
  numberingStrategy: VariationNumberingStrategy,
): void => {
  if (!model.root) return;
  const mainBlock = currentBlock(state);
  mainBlock.variationPath = [0];
  mainBlock.isMainLine = true;
  mainBlock.isCollapsible = false;
  emitTreeVariation(model.root, [0], true, state, numberingStrategy);
};
