/**
 * Text mode plan builder.
 *
 * Integration API:
 * - `buildTextModeEditorPlan(model, state)` — populates `state.blocks` with a
 *   token plan where `[[indent]]` drives block indentation, `[[br]]` becomes
 *   a visible newline in the contentEditable comment, and the first comment of
 *   each variation receives intro styling.
 */

import type { PlanState, PgnComment, PgnModel } from "./types";
import {
  addCommentToken,
  addSpace,
  applyPersistentIndentDelta,
  buildRichCommentView,
  nextBlock,
  buildVariationWalker,
} from "./types";

const emitTextComment = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  applyIntroStyling: boolean,
  variationDepth: number,
): void => {
  // Apply shared rich-mode marker handling.
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
  // The intro comment occupies its own block so the first move starts on a
  // new line rather than immediately following the intro text.
  const shouldBreakAfterComment: boolean = applyIntroStyling
    || state.commentLineBreakPolicy === "always"
    || (state.commentLineBreakPolicy === "mainline_only" && variationDepth === 0);
  if (shouldBreakAfterComment) {
    nextBlock(state);
  } else {
    addSpace(state);
  }
};

const { emitVariation, strategyRegistry } = buildVariationWalker(emitTextComment);

export const buildTextModeEditorPlan = (model: PgnModel, state: PlanState): void => {
  if (!model.root) return;
  emitVariation(model.root, state, strategyRegistry);
};
