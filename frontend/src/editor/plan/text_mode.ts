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
  nextBlock,
  buildVariationWalker,
  getIndentDirectiveDepth,
  hasIndentBlockDirective,
  stripIndentDirectives,
} from "./types";

const emitTextComment = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  applyIntroStyling: boolean,
): void => {
  // Apply [[indent]] directive for block indentation.
  // [[br]] markers are converted to newlines so the contentEditable shows
  // visual line breaks (WYSIWYG). On save, newlines are normalised back to [[br]].
  const indentDirectiveDepth: number = getIndentDirectiveDepth(comment);
  const hasIndent: boolean = indentDirectiveDepth > 0;
  const strippedText: string = hasIndent ? stripIndentDirectives(rawText) : rawText;
  const visibleText: string = strippedText.replace(/\[\[br\]\]/gi, "\n");
  addCommentToken(
    state,
    comment,
    visibleText,
    rawText,
    hasIndent,
    indentDirectiveDepth,
    applyIntroStyling,
    false,
    applyIntroStyling,
  );
  // The intro comment occupies its own block so the first move starts on a
  // new line rather than immediately following the intro text.
  if (applyIntroStyling) {
    nextBlock(state);
  } else {
    addSpace(state);
  }
};

// `hasIndentBlockDirective` is intentionally unused here — the shared variation
// walker in `types.ts` handles the [[indent]]-before-RAV detection.
void hasIndentBlockDirective;

const { emitVariation, strategyRegistry } = buildVariationWalker(emitTextComment);

export const buildTextModeEditorPlan = (model: PgnModel, state: PlanState): void => {
  if (!model.root) return;
  emitVariation(model.root, state, strategyRegistry);
};
