/**
 * PgnEditorModeViews — layout-mode views for the PGN text editor.
 *
 * Exports `LinearModeView` (plain/text modes) and `TreeModeView` (tree mode),
 * the `BranchHeader` collapse toggle, and `buildLastSiblingByParent`.
 * All rendering is driven by the `deps: TokenRenderDeps` bag — no context reads.
 */

import type { ReactElement } from "react";
import type { PlanBlock, InlineToken, PlanToken } from "../model/text_editor_plan";
import { renderToken, hasVisibleTokenInBlock } from "./PgnEditorTokenView";
import type { TokenRenderDeps } from "./PgnEditorTokenView";

// ── Collapse path helpers ─────────────────────────────────────────────────────

export const pathKey = (path: readonly number[]): string => path.join(".");

/**
 * Returns true when the block should be hidden because one of its ancestor
 * variation paths is in the collapsed set.
 */
export const isBlockHidden = (
  variationPath: readonly number[] | undefined,
  collapsedPaths: ReadonlySet<string>,
): boolean => {
  if (!variationPath || collapsedPaths.size === 0) return false;
  for (let len = 1; len < variationPath.length; len += 1) {
    if (collapsedPaths.has(pathKey(variationPath.slice(0, len)))) return true;
  }
  return false;
};

/** CSS depth class for a tree block. */
export const treeDepthClass = (variationPath: readonly number[]): string => {
  const depth: number = variationPath.length;
  return depth >= 4 ? "tree-depth-4plus" : `tree-depth-${depth}`;
};

/**
 * Builds a map from parent variation-path key to the greatest child sibling index.
 * Used to trim vertical tree spines for last-sibling blocks.
 */
export const buildLastSiblingByParent = (blocks: readonly PlanBlock[]): ReadonlyMap<string, number> => {
  const byParent: Map<string, number> = new Map<string, number>();
  blocks.forEach((block: PlanBlock): void => {
    const path: readonly number[] | undefined = block.variationPath;
    if (!path || path.length <= 1) return;
    const parentKey: string = pathKey(path.slice(0, -1));
    const siblingIndex: number = path[path.length - 1] ?? 0;
    const prev: number | undefined = byParent.get(parentKey);
    if (prev === undefined || siblingIndex > prev) {
      byParent.set(parentKey, siblingIndex);
    }
  });
  return byParent;
};

// ── BranchHeader ──────────────────────────────────────────────────────────────

type BranchHeaderProps = {
  label: string;
  blockPathKey: string;
  isCollapsed: boolean;
  onToggle: (key: string) => void;
};

/**
 * Renders the collapsible toggle button for a non-mainline variation block.
 * Triangle glyph flips between ▶ (collapsed) and ▼ (expanded).
 */
const BranchHeader = ({ label, blockPathKey, isCollapsed, onToggle }: BranchHeaderProps): ReactElement => (
  <button
    type="button"
    className="tree-collapse-toggle"
    aria-expanded={!isCollapsed}
    onClick={(): void => { onToggle(blockPathKey); }}
  >
    <span className="tree-collapse-glyph" aria-hidden="true">{isCollapsed ? "▶" : "▼"}</span>
    {" "}{label}
  </button>
);

// ── LinearModeView ────────────────────────────────────────────────────────────

type LinearModeViewProps = {
  blocks: PlanBlock[];
  deps: TokenRenderDeps;
};

export const LinearModeView = ({ blocks, deps }: LinearModeViewProps): ReactElement => (
  <>
    {blocks
      .filter((block: PlanBlock): boolean => hasVisibleTokenInBlock(block, deps))
      .map((block: PlanBlock): ReactElement => (
        <div
          key={block.key}
          className="text-editor-block"
          style={block.indentDepth > 0 ? { paddingLeft: `${block.indentDepth * 1.5}em` } : undefined}
          data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
        >
          {block.tokens.map((token: PlanToken): ReactElement => renderToken(token, deps))}
        </div>
      ))}
  </>
);

// ── TreeModeView ──────────────────────────────────────────────────────────────

type TreeModeViewProps = {
  blocks: PlanBlock[];
  collapsedPaths: ReadonlySet<string>;
  lastSiblingByParent: ReadonlyMap<string, number>;
  onToggle: (key: string) => void;
  deps: TokenRenderDeps;
};

export const TreeModeView = ({
  blocks,
  collapsedPaths,
  lastSiblingByParent,
  onToggle,
  deps,
}: TreeModeViewProps): ReactElement => (
  <>
    {blocks.map((block: PlanBlock): ReactElement | null => {
      if (isBlockHidden(block.variationPath, collapsedPaths)) return null;

      const depthClass: string = block.variationPath ? treeDepthClass(block.variationPath) : "";
      const isCollapsed: boolean = block.variationPath
        ? collapsedPaths.has(pathKey(block.variationPath))
        : false;
      const isTreeLastSibling: boolean = (() => {
        const path: readonly number[] | undefined = block.variationPath;
        if (!path || path.length <= 1) return false;
        const parentKey: string = pathKey(path.slice(0, -1));
        const siblingIndex: number = path[path.length - 1] ?? 0;
        return lastSiblingByParent.get(parentKey) === siblingIndex;
      })();

      const branchLabelToken: InlineToken | undefined = block.isCollapsible
        ? block.tokens.find(
            (tok: PlanToken): tok is InlineToken =>
              tok.kind === "inline" && tok.tokenType === "branch_header",
          )
        : undefined;

      const collapsedPreview: string | null = (() => {
        if (!isCollapsed || !block.isCollapsible) return null;
        const previewTypes: Set<string> = new Set(["move_number", "move", "nag"]);
        const parts: string[] = [];
        for (const tok of block.tokens) {
          if (tok.kind !== "inline") continue;
          const it: InlineToken = tok as InlineToken;
          if (!previewTypes.has(it.tokenType)) continue;
          parts.push(it.text);
          if (parts.length >= 8) break;
        }
        return parts.length > 0 ? parts.join(" ").replace(/\s+/g, " ").trim() : null;
      })();

      return (
        <div
          key={block.key}
          className={["text-editor-block", depthClass].filter(Boolean).join(" ")}
          style={block.indentDepth > 0 ? { paddingLeft: `${block.indentDepth * 1.5}em` } : undefined}
          data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
          data-variation-path={block.variationPath ? pathKey(block.variationPath) : undefined}
          data-tree-last-sibling={isTreeLastSibling ? "true" : undefined}
        >
          {block.isCollapsible && branchLabelToken && (
            <BranchHeader
              label={String(branchLabelToken.dataset.label ?? branchLabelToken.text)}
              blockPathKey={pathKey(block.variationPath!)}
              isCollapsed={isCollapsed}
              onToggle={onToggle}
            />
          )}
          {isCollapsed && collapsedPreview !== null && (
            <span className="tree-collapsed-preview">{collapsedPreview} …</span>
          )}
          {!isCollapsed && block.tokens
            .filter((tok: PlanToken): boolean =>
              !(tok.kind === "inline" && tok.tokenType === "branch_header"),
            )
            .map((token: PlanToken): ReactElement => renderToken(token, deps))}
        </div>
      );
    })}
  </>
);
