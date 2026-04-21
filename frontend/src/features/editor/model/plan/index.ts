/**
 * PGN editor plan — public API.
 *
 * Integration API:
 * - `buildTextEditorPlan(pgnModel, { layoutMode, numberingStrategy, commentLineBreakPolicy })` — converts a
 *   PGN model into a flat `PlanBlock[]` suitable for rendering by `PgnTextEditor`.
 * - `layoutMode`:
 *   - `plain`  — literal comment text, no marker processing.
 *   - `text`   — `[[indent]]`/`[[deindent]]` drive persistent indentation; `[[br]]` becomes a newline
 *                in the contentEditable; first comment receives intro styling.
 *   - `tree`   — one block per variation (DFS); markers shown as greyed literal text;
 *                first comment of each variation receives intro styling independently.
 * - Re-exports public token/block types consumed by the React render layer.
 */

export type { InlineToken, CommentToken, PlanToken, PlanBlock } from "./types";
export type { VariationNumberingStrategy } from "./tree_mode";

import type { LayoutMode, PgnModel, PlanToken, PlanBlock } from "./types";
import { createBlock, createPlanState } from "./types";
import type { VariationNumberingStrategy } from "./tree_mode";
import { alphaNumericPathStrategy, buildTreeEditorPlan } from "./tree_mode";
import { buildPlainEditorPlan } from "./plain_mode";
import { buildTextModeEditorPlan } from "./text_mode";

const normalizeMoveNumberTokens = (blocks: PlanBlock[]): PlanBlock[] =>
  blocks.map((block: PlanBlock): PlanBlock => {
    const normalizedTokens: PlanToken[] = [];
    const tokens: PlanToken[] = block.tokens;
    for (let i: number = 0; i < tokens.length; i += 1) {
      const token: PlanToken = tokens[i];
      if (!(token.kind === "inline" && token.tokenType === "move_number")) {
        normalizedTokens.push(token);
        continue;
      }
      const side: string = String(token.dataset?.moveNumberSide ?? "");
      if (side === "black") {
        const variationDepth: number = Number(token.dataset?.variationDepth ?? 0);
        if (variationDepth > 0) {
          normalizedTokens.push(token);
          continue;
        }
        let suppressBlack: boolean = false;
        for (let k: number = normalizedTokens.length - 1; k >= 0; k -= 1) {
          const prev: PlanToken = normalizedTokens[k];
          if (prev.kind === "inline" && prev.tokenType === "space") continue;
          if (prev.kind === "comment") continue;
          suppressBlack = prev.kind === "inline" && prev.tokenType === "move";
          break;
        }
        if (suppressBlack) continue;
      }
      let hasFollowingMoveNumber: boolean = false;
      for (let j: number = i + 1; j < tokens.length; j += 1) {
        const lookahead: PlanToken = tokens[j];
        if (lookahead.kind === "comment") continue;
        if (lookahead.kind !== "inline") break;
        if (lookahead.tokenType === "space") continue;
        hasFollowingMoveNumber = lookahead.tokenType === "move_number";
        break;
      }
      if (hasFollowingMoveNumber) continue;
      normalizedTokens.push(token);
    }
    return { ...block, tokens: normalizedTokens };
  });

export const buildTextEditorPlan = (
  pgnModel: unknown,
  options: {
    layoutMode?: LayoutMode;
    numberingStrategy?: VariationNumberingStrategy;
    commentLineBreakPolicy?: "always" | "mainline_only";
  } = {},
): PlanBlock[] => {
  const layoutMode: LayoutMode =
    options.layoutMode === "plain" ||
    options.layoutMode === "text" ||
    options.layoutMode === "tree"
      ? options.layoutMode
      : "plain";

  const commentLineBreakPolicy: "always" | "mainline_only" =
    options.commentLineBreakPolicy === "always" ? "always" : "mainline_only";
  const state = createPlanState(layoutMode, commentLineBreakPolicy);
  const model: PgnModel | null = (pgnModel as PgnModel | null) ?? null;
  if (!model?.root) return state.blocks;

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
  const trimmedBlocks: PlanBlock[] = state.blocks.slice(firstNonEmpty, lastNonEmpty + 1);
  return normalizeMoveNumberTokens(trimmedBlocks);
};
