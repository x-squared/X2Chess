/**
 * Re-export shim — the implementation has moved to `./plan/`.
 *
 * All consumers (React layer, legacy text_editor, tests) continue to import
 * from this path without change.
 */

export type { InlineToken, CommentToken, PlanToken, PlanBlock } from "./plan/types";
export type { VariationNumberingStrategy } from "./plan/tree_mode";
export { buildTextEditorPlan } from "./plan/index";
