/**
 * Text mode plan builder.
 * 
 * Text mode essentially means that main lines are shown clearly seperated from
 * comments and variations. Comments and variations are shown as text blocks. The
 * layout of these blocks is fully handled by the user. The main tool is to break
 * lines with [[br]] markers (which are handled invisibly but are apparent in pgn
 * text). Also handling subvariations is left to the user. In particular, they are 
 * not sepetared from the siurrounding block, or indented in any way. Thus this
 * is bare-bones text-editing.
 * 
 * Text-mode layout contract (normative):
 * - Text mode is bare-bones prose editing; the user controls layout.
 * - Subvariations are not automatically moved to new lines.
 * - Subvariations are not automatically indented.
 * - `[[br]]` controls explicit line breaks in comment text.
 * - Comments follow `commentLineBreakPolicy`; with `mainline_only`, variation
 *   comments stay inline unless the user inserts explicit breaks.
 * - Black move numbers are suppressed only when redundant in the same block.
 *
 * Integration API:
 * - `buildTextModeEditorPlan(model, state)` — populates `state.blocks` with a
 *   token plan where `[[br]]` becomes
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
  let shouldBreakAfterComment: boolean = defaultBreakAfterComment;
  if (breakBehavior === "force_break") {
    shouldBreakAfterComment = true;
  } else if (breakBehavior === "force_inline") {
    shouldBreakAfterComment = false;
  }
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
