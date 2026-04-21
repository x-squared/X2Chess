/**
 * Text mode plan builder.
 *
 * Text-mode layout contract (normative):
 * - Mainline content is left-aligned (`indentDepth === 0`).
 * - RAV branches render on their own blocks and are indented by variation depth.
 * - Comments after a mainline move start on a new line.
 * - Whether a mainline variation starts on a new line is controlled by the
 *   preceding comment: append a trailing break marker (`[[br]]`, `<br>`, `\n`)
 *   to start the variation on a new line; otherwise it stays inline.
 * - Variation comments follow the same alignment behavior as variation moves.
 * - Mainline continuation after a RAV starts on a new left-aligned block.
 * - Black move numbers are suppressed only when redundant in the same block;
 *   when a continuation starts on a new block (for example after a RAV),
 *   the black move number is shown.
 *
 * Integration API:
 * - `buildTextModeEditorPlan(model, state)` — populates `state.blocks` with a
 *   token plan where structural variation depth drives block indentation, `[[br]]` becomes
 *   a visible newline in the contentEditable comment, and the first comment of
 *   each variation receives intro styling.
 */

import type { CommentBreakBehavior, PlanState, PgnComment, PgnModel } from "./types";
import {
  addCommentToken,
  addSpace,
  buildRichCommentView,
  nextBlock,
  buildVariationWalker,
} from "./types";

export const TRAILING_VARIATION_BREAK_SENTINEL: string = "\u2063";

const emitTextComment = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  applyIntroStyling: boolean,
  variationDepth: number,
  breakBehavior: CommentBreakBehavior,
): void => {
  const trailingBreakPattern: RegExp = /(?:\[\[br\]\]|<br\s*\/?>|\\n|\n)\s*$/i;
  const rawTextForView: string = breakBehavior === "force_break"
    ? rawText.replace(trailingBreakPattern, TRAILING_VARIATION_BREAK_SENTINEL)
    : rawText;
  // Apply shared rich-mode marker handling.
  const view = buildRichCommentView(comment, rawTextForView);
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
    breakBehavior === "force_inline",
    variationDepth,
  );
  // The intro comment occupies its own block so the first move starts on a
  // new line rather than immediately following the intro text.
  const defaultBreakAfterComment: boolean = applyIntroStyling
    || state.commentLineBreakPolicy === "always"
    || (state.commentLineBreakPolicy === "mainline_only" && variationDepth === 0);
  const shouldBreakAfterComment: boolean = breakBehavior === "force_break"
    ? true
    : breakBehavior === "force_inline"
      ? false
      : defaultBreakAfterComment;
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
