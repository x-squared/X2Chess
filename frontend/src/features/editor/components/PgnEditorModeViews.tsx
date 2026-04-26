/**
 * PgnEditorModeViews — layout-mode views for the PGN text editor.
 *
 * Exports `LinearModeView` (plain/text modes) and `TreeModeView` (tree mode),
 * the `BranchHeader` collapse toggle, and `buildLastSiblingByParent`.
 * All rendering is driven by the `deps: TokenRenderDeps` bag — no context reads.
 */

import { useState, type CSSProperties, type DragEvent as ReactDragEvent, type ReactElement } from "react";
import type { PlanBlock, InlineToken, PlanToken } from "../model/text_editor_plan";
import { renderToken, hasVisibleTokenInBlock } from "./PgnEditorTokenView";
import type { TokenRenderDeps } from "./PgnEditorTokenView";

// ── Collapse path helpers ─────────────────────────────────────────────────────

const INTERNAL_VARIATION_DND_TYPE = "application/x-x2chess-variation-move";

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
    const siblingIndex: number = path.at(-1) ?? 0;
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
  firstMoveId: string | null;
  isCollapsed: boolean;
  onToggle: (key: string) => void;
  onDragStart: (e: ReactDragEvent<HTMLButtonElement>, firstMoveId: string | null) => void;
  onDragEnd: () => void;
  onDragOver: (e: ReactDragEvent<HTMLButtonElement>, firstMoveId: string | null) => void;
  onDrop: (e: ReactDragEvent<HTMLButtonElement>, firstMoveId: string | null) => void;
  isDropTarget: boolean;
  isDragging: boolean;
};

/**
 * Renders the collapsible toggle button for a non-mainline variation block.
 * Triangle glyph flips between ▶ (collapsed) and ▼ (expanded).
 */
const BranchHeader = ({
  label,
  blockPathKey,
  firstMoveId,
  isCollapsed,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDropTarget,
  isDragging,
}: BranchHeaderProps): ReactElement => (
  <button
    type="button"
    className={[
      "tree-collapse-toggle",
      isDropTarget ? "tree-collapse-toggle-drop-target" : "",
      isDragging ? "is-dragging" : "",
    ].filter(Boolean).join(" ")}
    aria-expanded={!isCollapsed}
    draggable
    onClick={(): void => { onToggle(blockPathKey); }}
    onDragStart={(e): void => { onDragStart(e, firstMoveId); }}
    onDragEnd={onDragEnd}
    onDragOver={(e): void => { onDragOver(e, firstMoveId); }}
    onDrop={(e): void => { onDrop(e, firstMoveId); }}
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

export const LinearModeView = ({ blocks, deps }: LinearModeViewProps): ReactElement => (
  <>
    {blocks
      .filter((block: PlanBlock): boolean => hasVisibleTokenInBlock(block, deps))
      .map((block: PlanBlock): ReactElement => {
        const variationDepth: number = getBlockVariationDepth(block);
        return (
          <div
            key={block.key}
            className="text-editor-block"
            style={block.indentDepth > 0 ? { paddingLeft: `${block.indentDepth * 1.5}em` } : undefined}
            data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
            data-variation-depth={variationDepth > 0 ? variationDepth : undefined}
          >
            {block.tokens.map((token: PlanToken): ReactElement => renderToken(token, deps))}
          </div>
        );
      })}
  </>
);

// ── TreeModeView ──────────────────────────────────────────────────────────────

type TreeModeViewProps = {
  blocks: PlanBlock[];
  collapsedPaths: ReadonlySet<string>;
  lastSiblingByParent: ReadonlyMap<string, number>;
  onToggle: (key: string) => void;
  onVariationHeaderDrop: (sourceMoveId: string, targetMoveId: string) => void;
  deps: TokenRenderDeps;
};

export const TreeModeView = ({
  blocks,
  collapsedPaths,
  lastSiblingByParent,
  onToggle,
  onVariationHeaderDrop,
  deps,
}: TreeModeViewProps): ReactElement => {
  const [dragSourceMoveId, setDragSourceMoveId] = useState<string | null>(null);
  const [dropTargetMoveId, setDropTargetMoveId] = useState<string | null>(null);

  const handleDragStart = (
    e: ReactDragEvent<HTMLButtonElement>,
    firstMoveId: string | null,
  ): void => {
    if (!firstMoveId) return;
    setDragSourceMoveId(firstMoveId);
    setDropTargetMoveId(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(INTERNAL_VARIATION_DND_TYPE, firstMoveId);
  };

  const handleDragOver = (
    e: ReactDragEvent<HTMLButtonElement>,
    firstMoveId: string | null,
  ): void => {
    if (!dragSourceMoveId || !firstMoveId || dragSourceMoveId === firstMoveId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropTargetMoveId(firstMoveId);
  };

  const handleDrop = (
    e: ReactDragEvent<HTMLButtonElement>,
    firstMoveId: string | null,
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSourceMoveId || !firstMoveId || dragSourceMoveId === firstMoveId) {
      setDropTargetMoveId(null);
      setDragSourceMoveId(null);
      return;
    }
    onVariationHeaderDrop(dragSourceMoveId, firstMoveId);
    setDropTargetMoveId(null);
    setDragSourceMoveId(null);
  };

  const handleDragEnd = (): void => {
    setDropTargetMoveId(null);
    setDragSourceMoveId(null);
  };

  return (
    <>
      {blocks.map((block: PlanBlock): ReactElement | null => {
        if (isBlockHidden(block.variationPath, collapsedPaths)) return null;

        const depthClass: string = block.variationPath ? treeDepthClass(block.variationPath) : "";
        const treeIndentLevel: number = block.variationPath ? Math.max(block.variationPath.length - 1, 0) : 0;
        const treeBlockStyle: CSSProperties | undefined = (() => {
          const style: CSSProperties = {};
          let hasStyle: boolean = false;
          if (treeIndentLevel > 0) {
            style["--tree-indent-level" as keyof CSSProperties] = String(treeIndentLevel);
            hasStyle = true;
          }
          if (block.indentDepth > 0) {
            style.paddingLeft = `${block.indentDepth * 1.5}em`;
            hasStyle = true;
          }
          return hasStyle ? style : undefined;
        })();
        const isCollapsed: boolean = block.variationPath
          ? collapsedPaths.has(pathKey(block.variationPath))
          : false;
        const isTreeLastSibling: boolean = (() => {
          const path: readonly number[] | undefined = block.variationPath;
          if (!path || path.length <= 1) return false;
          const parentKey: string = pathKey(path.slice(0, -1));
          const siblingIndex: number = path.at(-1) ?? 0;
          return lastSiblingByParent.get(parentKey) === siblingIndex;
        })();

        const branchLabelToken: InlineToken | undefined = block.isCollapsible
          ? block.tokens.find(
              (tok: PlanToken): tok is InlineToken =>
                tok.kind === "inline" && tok.tokenType === "branch_header",
            )
          : undefined;
        const firstMoveToken: InlineToken | undefined = block.tokens.find(
          (tok: PlanToken): tok is InlineToken =>
            tok.kind === "inline" && tok.tokenType === "move" && typeof tok.dataset?.nodeId === "string",
        );
        const firstMoveId: string | null = firstMoveToken ? String(firstMoveToken.dataset.nodeId) : null;

        const collapsedPreview: string | null = (() => {
          if (!isCollapsed || !block.isCollapsible) return null;
          const previewTypes: Set<string> = new Set(["move_number", "move", "nag"]);
          const parts: string[] = [];
          for (const tok of block.tokens) {
            if (tok.kind !== "inline") continue;
            if (!previewTypes.has(tok.tokenType)) continue;
            parts.push(tok.text);
            if (parts.length >= 8) break;
          }
          return parts.length > 0 ? parts.join(" ").replaceAll(/\s+/g, " ").trim() : null;
        })();

        return (
          <div
            key={block.key}
            className={["text-editor-block", depthClass].filter(Boolean).join(" ")}
            style={treeBlockStyle}
            data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
            data-tree-indent-level={treeIndentLevel > 0 ? treeIndentLevel : undefined}
            data-variation-path={block.variationPath ? pathKey(block.variationPath) : undefined}
            data-tree-last-sibling={isTreeLastSibling ? "true" : undefined}
          >
            {block.isCollapsible && branchLabelToken && (
              <BranchHeader
                label={String(branchLabelToken.dataset.label ?? branchLabelToken.text)}
                blockPathKey={pathKey(block.variationPath!)}
                firstMoveId={firstMoveId}
                isCollapsed={isCollapsed}
                onToggle={onToggle}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDropTarget={dropTargetMoveId !== null && firstMoveId === dropTargetMoveId}
                isDragging={dragSourceMoveId !== null && firstMoveId === dragSourceMoveId}
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
};
