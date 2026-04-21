/**
 * PgnEditorPreview — lightweight read-only rendering of the PGN text editor plan.
 *
 * Used inside the EditorStyleDialog to provide a live preview of style changes
 * without the full interactive machinery of PgnTextEditor.
 *
 * Integration API:
 * - `<PgnEditorPreview pgnModel={...} layoutMode={...} commentLineBreakPolicy={...} styleVars={...} />`
 *
 * Configuration API:
 * - `pgnModel` — the model to preview; renders a placeholder hint when null.
 * - `layoutMode` — drives the plan builder and CSS data attribute.
 * - `commentLineBreakPolicy` — comment flow policy (`"always"` or `"mainline_only"`).
 * - `styleVars` — CSS custom-property values applied inline to the root element.
 *
 * Communication API:
 * - Read-only; fires no callbacks.
 */

import type { ReactElement, CSSProperties } from "react";
import { useMemo } from "react";
import { buildTextEditorPlan } from "../model/text_editor_plan";
import type { PlanBlock, PlanToken, InlineToken, CommentToken } from "../model/text_editor_plan";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";

// ── Helpers ───────────────────────────────────────────────────────────────────

const pathKey = (path: readonly number[]): string => path.join("-");

const treeDepthClass = (path: readonly number[]): string => {
  const depth = path.length;
  if (depth <= 1) return "tree-depth-1";
  if (depth === 2) return "tree-depth-2";
  if (depth === 3) return "tree-depth-3";
  return "tree-depth-4plus";
};

// ── Token rendering ───────────────────────────────────────────────────────────

const renderInlineToken = (token: InlineToken): ReactElement => {
  switch (token.tokenType) {
    case "move_number":
      return (
        <span key={token.key} className="text-editor-move-number">
          {token.text}
        </span>
      );
    case "move": {
      const cls = token.dataset["variationDepth"] === 0
        ? "text-editor-main-move"
        : "text-editor-variation-move";
      return (
        <span key={token.key} className={cls} data-token-type="move">
          {token.text}
        </span>
      );
    }
    case "nag":
      return (
        <span key={token.key} className="text-editor-nag">
          {token.text}
        </span>
      );
    case "result":
      return (
        <span key={token.key} className="text-editor-result">
          {token.text}
        </span>
      );
    case "space":
      return <span key={token.key}> </span>;
    case "branch_header":
      return (
        <span key={token.key} className="tree-collapse-toggle">
          <span className="tree-collapse-glyph">▸</span>
          {String(token.dataset?.["label"] ?? token.text)}
        </span>
      );
    default:
      return <span key={token.key}>{token.text}</span>;
  }
};

const renderCommentToken = (token: CommentToken): ReactElement => {
  const cls = [
    "text-editor-comment",
    "text-editor-comment-block",
    token.introStyling ? "text-editor-comment-intro" : "",
    token.plainLiteralComment ? "plain" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      key={token.key}
      className={cls}
      data-variation-depth={String(token.variationDepth)}
      data-inline-with-next-variation={token.inlineWithNextVariation ? "true" : undefined}
    >
      {token.text}
    </div>
  );
};

const renderToken = (token: PlanToken): ReactElement => {
  if (token.kind === "comment") return renderCommentToken(token);
  return renderInlineToken(token);
};

const getBlockVariationDepth = (block: PlanBlock): number => {
  if (block.variationDepth > 0) return block.variationDepth;
  let maxDepth: number = 0;
  for (const token of block.tokens) {
    if (token.kind === "comment") {
      if (token.variationDepth > maxDepth) maxDepth = token.variationDepth;
      continue;
    }
    const tokenDepth: unknown = token.dataset?.variationDepth;
    const depth: number = typeof tokenDepth === "number" ? tokenDepth : Number(tokenDepth);
    if (Number.isFinite(depth) && depth > maxDepth) {
      maxDepth = depth;
    }
  }
  return maxDepth;
};

// ── Block rendering ───────────────────────────────────────────────────────────

const renderLinearBlocks = (blocks: PlanBlock[]): ReactElement => (
  <>
    {blocks.map((block: PlanBlock): ReactElement => {
      const variationDepth: number = getBlockVariationDepth(block);
      return (
        <div
          key={block.key}
          className="text-editor-block"
          data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
          data-variation-depth={variationDepth > 0 ? variationDepth : undefined}
        >
          {block.tokens.map(renderToken)}
        </div>
      );
    })}
  </>
);

const renderTreeBlocks = (blocks: PlanBlock[]): ReactElement => (
  <>
    {blocks.map((block: PlanBlock): ReactElement => {
      const depthClass = block.variationPath ? treeDepthClass(block.variationPath) : "";
      return (
        <div
          key={block.key}
          className={["text-editor-block", depthClass].filter(Boolean).join(" ")}
          data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
          data-variation-path={block.variationPath ? pathKey(block.variationPath) : undefined}
        >
          {block.tokens.map(renderToken)}
        </div>
      );
    })}
  </>
);

// ── Component ─────────────────────────────────────────────────────────────────

type PgnEditorPreviewProps = {
  pgnModel: PgnModel | null;
  layoutMode: "plain" | "text" | "tree";
  commentLineBreakPolicy: "always" | "mainline_only";
  styleVars: Record<string, string>;
};

export const PgnEditorPreview = ({
  pgnModel,
  layoutMode,
  commentLineBreakPolicy,
  styleVars,
}: PgnEditorPreviewProps): ReactElement => {
  const blocks: PlanBlock[] = useMemo(() => {
    if (!pgnModel) return [];
    return buildTextEditorPlan(pgnModel, { layoutMode, commentLineBreakPolicy });
  }, [pgnModel, layoutMode, commentLineBreakPolicy]);

  if (!pgnModel) {
    return (
      <div className="text-editor text-editor-empty" style={styleVars as CSSProperties}>
        <p className="text-editor-hint">Open a game to see a preview.</p>
      </div>
    );
  }

  return (
    <div
      className="text-editor pgn-editor-preview"
      data-layout-mode={layoutMode}
      data-comment-linebreak-policy={commentLineBreakPolicy}
      style={styleVars as CSSProperties}
    >
      {layoutMode === "tree" ? renderTreeBlocks(blocks) : renderLinearBlocks(blocks)}
    </div>
  );
};
