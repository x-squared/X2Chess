/**
 * Plain mode plan builder.
 *
 * Plain-mode layout contract (normative):
 * - The movetext is rendered as a flat stream of tokens.
 * - Comments are shown verbatim (no marker interpretation).
 * - No mode-specific branching indentation or block shaping is applied.
 *
 * Integration API:
 * - `buildPlainEditorPlan(model, state)` — populates `state.blocks` with a flat
 *   token plan where all comment text is shown verbatim (markers are not processed).
 */

import type { CommentBreakBehavior, PlanState, PgnComment, PgnModel } from "./types";
import { addCommentToken, addSpace, buildVariationWalker } from "./types";

const emitPlainComment = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  _applyIntroStyling: boolean,
  variationDepth: number,
  _breakBehavior: CommentBreakBehavior,
): void => {
  addCommentToken(state, comment, rawText, rawText, false, 0, false, true, false, false, variationDepth);
  addSpace(state);
};

const { emitVariation, strategyRegistry } = buildVariationWalker(emitPlainComment);

export const buildPlainEditorPlan = (model: PgnModel, state: PlanState): void => {
  if (!model.root) return;
  emitVariation(model.root, state, strategyRegistry);
};
