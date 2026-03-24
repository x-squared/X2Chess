/**
 * Plain mode plan builder.
 *
 * Integration API:
 * - `buildPlainEditorPlan(model, state)` — populates `state.blocks` with a flat
 *   token plan where all comment text is shown verbatim (markers are not processed).
 */

import type { PlanState, PgnComment, PgnModel } from "./types";
import { addCommentToken, addSpace, buildVariationWalker } from "./types";

const emitPlainComment = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  _applyIntroStyling: boolean,
): void => {
  addCommentToken(state, comment, rawText, rawText, false, 0, false, true, false);
  addSpace(state);
};

const { emitVariation, strategyRegistry } = buildVariationWalker(emitPlainComment);

export const buildPlainEditorPlan = (model: PgnModel, state: PlanState): void => {
  if (!model.root) return;
  emitVariation(model.root, state, strategyRegistry);
};
