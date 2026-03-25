/**
 * PGN editor plan — public API.
 *
 * Integration API:
 * - `buildTextEditorPlan(pgnModel, { layoutMode, numberingStrategy })` — converts a
 *   PGN model into a flat `PlanBlock[]` suitable for rendering by `PgnTextEditor`.
 * - `layoutMode`:
 *   - `plain`  — literal comment text, no marker processing.
 *   - `text`   — `[[indent]]` drives block indentation; `[[br]]` becomes a newline
 *                in the contentEditable; first comment receives intro styling.
 *   - `tree`   — one block per variation (DFS); markers shown as greyed literal text;
 *                first comment of each variation receives intro styling independently.
 * - Re-exports public token/block types consumed by the React render layer.
 */

export type { InlineToken, CommentToken, PlanToken, PlanBlock } from "./types";
export type { VariationNumberingStrategy } from "./tree_mode";

import type { LayoutMode, PgnModel } from "./types";
import { createBlock, createPlanState } from "./types";
import type { VariationNumberingStrategy } from "./tree_mode";
import { alphaNumericPathStrategy, buildTreeEditorPlan } from "./tree_mode";
import { buildPlainEditorPlan } from "./plain_mode";
import { buildTextModeEditorPlan } from "./text_mode";
import type { PlanBlock } from "./types";

export const buildTextEditorPlan = (
  pgnModel: unknown,
  options: { layoutMode?: LayoutMode; numberingStrategy?: VariationNumberingStrategy } = {},
): PlanBlock[] => {
  const layoutMode: LayoutMode =
    options.layoutMode === "plain" ||
    options.layoutMode === "text" ||
    options.layoutMode === "tree"
      ? options.layoutMode
      : "plain";

  const state = createPlanState(layoutMode);
  const model: PgnModel | null = (pgnModel as PgnModel | null) ?? null;
  if (!model || !model.root) return state.blocks;

  if (layoutMode === "tree") {
    const numbering: VariationNumberingStrategy =
      options.numberingStrategy ?? alphaNumericPathStrategy;
    buildTreeEditorPlan(model, state, numbering);
  } else if (layoutMode === "text") {
    buildTextModeEditorPlan(model, state);
  } else {
    buildPlainEditorPlan(model, state);
  }

  const firstNonEmpty: number = state.blocks.findIndex(
    (block: PlanBlock): boolean => block.tokens.length > 0,
  );
  if (firstNonEmpty === -1) return [createBlock(0, 0)];
  let lastNonEmpty: number = 0;
  for (let i: number = state.blocks.length - 1; i >= 0; i -= 1) {
    if (state.blocks[i].tokens.length > 0) {
      lastNonEmpty = i;
      break;
    }
  }
  return state.blocks.slice(firstNonEmpty, lastNonEmpty + 1);
};
