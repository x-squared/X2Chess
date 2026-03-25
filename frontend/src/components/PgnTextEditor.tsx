/**
 * PgnTextEditor — renders the PGN annotation editor from the computed token plan.
 *
 * Converts the `PgnModel` to a flat token plan via `buildTextEditorPlan()` and
 * renders it as React JSX using React's virtual-DOM reconciler.
 *
 * Integration API:
 * - `<PgnTextEditor />` — mount inside a sized container; no props required.
 * - Reads: `pgnModel`, `pgnLayoutMode`, `selectedMoveId`, `pendingFocusCommentId`
 *   from `AppStoreState` context.
 * - Writes: dispatches `set_selected_move_id` on move click.
 *
 * Configuration API:
 * - No props required.  All data flows through `AppStoreState` context.
 *
 * Communication API:
 * - Outbound: `dispatch({ type: "set_selected_move_id", id })` on move click.
 * - Inbound: re-renders when `pgnModel`, `pgnLayoutMode`, or `selectedMoveId` change.
 * - Comment saves and insert-comment actions are wired to `useServiceContext()`
 *   callbacks (`insertComment`, `saveCommentText`, `gotoMoveById`).
 * - Game-link chips (`[%link ...]`) rendered via `LinkBadge`; insertion via
 *   `GamePickerDialog`; navigation via `services.openGameFromRecordId`.
 */

import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import type { ReactElement, KeyboardEvent as ReactKeyboardEvent, FormEvent, MouseEvent } from "react";
import { buildTextEditorPlan } from "../editor/text_editor_plan";
import type { PlanBlock, PlanToken, InlineToken, CommentToken } from "../editor/text_editor_plan";
import { useAppContext } from "../state/app_context";
import {
  selectPgnModel,
  selectLayoutMode,
  selectSelectedMoveId,
  selectPendingFocusCommentId,
  selectPositionPreviewOnHover,
} from "../state/selectors";
import { useHoverPreview } from "./HoverPreviewContext";
import { resolveMovePositionById, type PgnModelForMoves } from "../board/move_position";
import { useServiceContext } from "../state/ServiceContext";
import { useTranslator } from "../hooks/useTranslator";
import {
  truncateAfter,
  truncateBefore,
  deleteVariation,
  deleteVariationsAfter,
  promoteToMainline,
  findCursorForMoveId,
} from "../model/pgn_move_ops";
import { TruncationMenu } from "./TruncationMenu";
import type { TruncationAction } from "./TruncationMenu";
import { QaBadge, QaInsertDialog } from "./QaBadge";
import {
  parseQaAnnotations,
  hasQaAnnotations,
  stripQaAnnotations,
} from "../resources_viewer/qa_parser";
import { useQaDialog } from "../editor/useQaDialog";
import { TodoBadge, TodoInsertDialog, TodoPanel } from "./TodoBadge";
import type { TodoPanelItem } from "./TodoBadge";
import {
  parseTodoAnnotations,
  hasTodoAnnotations,
  stripTodoAnnotations,
} from "../resources_viewer/todo_parser";
import { useTodoDialog } from "../editor/useTodoDialog";
import { LinkBadge } from "./LinkBadge";
import {
  parseLinkAnnotations,
  hasLinkAnnotations,
  stripLinkAnnotations,
} from "../resources_viewer/link_parser";
import { useLinkDialog } from "../editor/useLinkDialog";
import { GamePickerDialog } from "./GamePickerDialog";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Meta/Ctrl shortcut letter → execCommand style name for comment formatting. */
const FORMAT_KEYS: Readonly<Record<string, string>> = {
  b: "bold",
  i: "italic",
  u: "underline",
} as const;

// ── Collapse helpers ──────────────────────────────────────────────────────────

const pathKey = (path: readonly number[]): string => path.join(".");

/**
 * Returns true when the block should be hidden because one of its ancestor
 * variation paths is in the collapsed set.
 */
const isBlockHidden = (
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
const treeDepthClass = (variationPath: readonly number[]): string => {
  const depth: number = variationPath.length;
  return depth >= 4 ? "tree-depth-4plus" : `tree-depth-${depth}`;
};

/**
 * Builds a map from parent variation-path key to the greatest child sibling index.
 * Used to trim vertical tree spines for last-sibling blocks.
 */
const buildLastSiblingByParent = (blocks: readonly PlanBlock[]): ReadonlyMap<string, number> => {
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

// ── CommentBlock ──────────────────────────────────────────────────────────────

type CommentBlockProps = {
  /** Token carrying comment metadata and display text. */
  token: CommentToken;
  /**
   * Whether this comment should receive focus immediately after mount.
   * Set when the comment was just inserted by the user.
   */
  isFocused: boolean;
  /** Called after one-time autofocus was consumed for this comment. */
  onFocusHandled: (commentId: string) => void;
  /**
   * Called on every user keystroke inside the contentEditable element.
   * @param commentId - The PGN comment node ID.
   * @param newText - Current `innerText` of the div after the edit.
   */
  onEdit: (commentId: string, newText: string) => void;
};

/**
 * Renders a single PGN comment as a `contentEditable` div.
 *
 * The element is semi-uncontrolled: `innerText` is set on mount and
 * whenever `token.text` changes from an external source (e.g. QA dialog save,
 * layout-mode switch). User keystrokes are NOT overwritten — a ref flag
 * (`isUserEditPending`) suppresses the reactive update for the one render
 * cycle immediately following an `onInput` event, after which external
 * changes are tracked normally.
 *
 * Cmd/Ctrl+B/I/U apply bold, italic, and underline formatting via `execCommand`.
 * In plain/tree mode (plainLiteralComment=true), Enter inserts `[[br]]` rather
 * than a raw newline, keeping line-break markers visible as editable markup.
 */
const CommentBlock = ({ token, isFocused, onEdit, onFocusHandled }: CommentBlockProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  // True for exactly one render cycle after the user makes an edit, so we
  // skip the reactive innerText update and avoid clobbering the user's caret.
  const isUserEditPending = useRef<boolean>(false);

  // Set innerText on mount.
  useEffect((): void => {
    if (ref.current) ref.current.innerText = token.text;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // Re-sync innerText when the model provides a new display value (e.g. QA
  // dialog save, layout-mode switch).  Skipped for the render cycle that
  // immediately follows a user input event.
  useEffect((): void => {
    if (isUserEditPending.current) {
      isUserEditPending.current = false;
      return;
    }
    if (ref.current) ref.current.innerText = token.text;
  }, [token.text]);

  /** Move caret to end of element when this comment should receive focus. */
  useEffect((): void => {
    if (!isFocused || !ref.current) return;
    ref.current.focus();
    const sel: Selection | null = window.getSelection();
    if (!sel) return;
    const range: Range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    onFocusHandled(token.commentId);
  }, [isFocused, onFocusHandled, token.commentId]);

  const handleInput = (e: FormEvent<HTMLDivElement>): void => {
    isUserEditPending.current = true;
    onEdit(token.commentId, (e.currentTarget as HTMLDivElement).innerText);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    // In plain/tree mode, Enter inserts the canonical [[br]] marker rather than
    // a raw newline, keeping line-break markup visible and editable.
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && token.plainLiteralComment) {
      e.preventDefault();
      // execCommand is deprecated but remains the only reliable way to insert
      // text at the caret position inside a contentEditable element.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertText", false, "[[br]]");
      return;
    }
    const withMeta: boolean = e.metaKey || e.ctrlKey;
    if (!withMeta) return;
    const command: string | undefined = FORMAT_KEYS[e.key.toLowerCase()];
    if (!command) return;
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command);
  };

  const className: string = [
    "text-editor-comment",
    "text-editor-comment-block",
    token.introStyling ? "text-editor-comment-intro" : "",
    token.plainLiteralComment ? "plain" : "",
    isFocused ? "text-editor-comment-new" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      data-kind="comment"
      data-comment-id={token.commentId}
      data-focus-first-comment-at-start={token.focusFirstCommentAtStart ? "true" : undefined}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    />
  );
};

// ── MoveSpan ──────────────────────────────────────────────────────────────────

type MoveSpanProps = {
  /** The inline move token from the plan. */
  token: InlineToken;
  /** Whether this move is the currently selected move in the game. */
  isSelected: boolean;
  /**
   * Called when the user activates this move token.
   * @param moveId - PGN move node ID.
   */
  onMoveClick: (moveId: string) => void;
  /** Called when the user right-clicks a move to open the context menu. */
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
  /** Called when the pointer enters a move span (for position preview). */
  onMoveHover?: (moveId: string, rect: DOMRect) => void;
  /** Called when the pointer leaves a move span. */
  onMoveHoverEnd?: () => void;
};

/** Renders a clickable SAN move token. Right-click opens the context menu. */
const MoveSpan = ({
  token,
  isSelected,
  onMoveClick,
  onContextMenu,
  onMoveHover,
  onMoveHoverEnd,
}: MoveSpanProps): ReactElement => {
  const moveId: string = String(token.dataset.nodeId ?? "");

  const handleClick = useCallback((): void => {
    onMoveClick(moveId);
  }, [moveId, onMoveClick]);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      // Prevent browser text-selection on right-click (mousedown fires before contextmenu).
      if (e.button === 2) e.preventDefault();
    },
    [],
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
      const isInVariation = (token.dataset.variationDepth as number ?? 0) > 0;
      onContextMenu(moveId, token.text, isInVariation, rect);
    },
    [moveId, token.text, token.dataset.variationDepth, onContextMenu],
  );

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      onMoveHover?.(moveId, (e.currentTarget as HTMLSpanElement).getBoundingClientRect());
    },
    [moveId, onMoveHover],
  );

  const handleMouseLeave = useCallback((): void => {
    onMoveHoverEnd?.();
  }, [onMoveHoverEnd]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onMoveClick(moveId);
      return;
    }
    // Prevent browser text-selection (Shift+Arrow) and scroll (Arrow) defaults
    // while a move span has focus. Navigation is handled at window level.
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
    }
  };

  const className: string = [token.className, isSelected ? "text-editor-move-selected" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={className}
      data-kind="move"
      data-token-type="move"
      data-node-id={moveId}
      data-variation-depth={String(token.dataset.variationDepth ?? 0)}
      data-move-side={String(token.dataset.moveSide ?? "")}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {token.text}
    </span>
  );
};

// ── TokenView ─────────────────────────────────────────────────────────────────

type TokenViewProps = {
  token: PlanToken;
  selectedMoveId: string | null;
  pendingFocusCommentId: string | null;
  consumedFocusCommentId: string | null;
  layoutMode: "plain" | "text" | "tree";
  onMoveClick: (moveId: string) => void;
  onCommentEdit: (commentId: string, newText: string) => void;
  onCommentFocusHandled: (commentId: string) => void;
  onEditQa: (commentId: string, index: number, rawText: string) => void;
  onDeleteQa: (commentId: string, index: number, rawText: string) => void;
  onEditTodo: (commentId: string, index: number, rawText: string) => void;
  onDeleteTodo: (commentId: string, index: number, rawText: string) => void;
  onEditLink: (commentId: string, index: number, rawText: string) => void;
  onDeleteLink: (commentId: string, index: number, rawText: string) => void;
  onOpenLinkedGame: (recordId: string) => void;
  onFetchLinkMetadata: (recordId: string) => Promise<Record<string, string> | null>;
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
  onMoveHover?: (moveId: string, rect: DOMRect) => void;
  onMoveHoverEnd?: () => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Dispatches a plan token to the appropriate sub-component.
 *
 * - `comment` tokens → `<CommentBlock>` (with optional `<QaBadge>` in text/tree mode)
 * - `move` inline tokens → `<MoveSpan>`
 * - All other inline tokens (move_number, nag, result, space) → plain `<span>`
 */
const TokenView = ({
  token,
  selectedMoveId,
  pendingFocusCommentId,
  consumedFocusCommentId,
  layoutMode,
  onMoveClick,
  onCommentEdit,
  onCommentFocusHandled,
  onEditQa,
  onDeleteQa,
  onEditTodo,
  onDeleteTodo,
  onEditLink,
  onDeleteLink,
  onOpenLinkedGame,
  onFetchLinkMetadata,
  onContextMenu,
  onMoveHover,
  onMoveHoverEnd,
  t,
}: TokenViewProps): ReactElement => {
  if (token.kind === "comment") {
    const ct: CommentToken = token;
    const inBadgeMode: boolean = layoutMode !== "plain";
    // Show annotation badges in text/tree mode whenever annotations are present.
    const showQaBadge: boolean = inBadgeMode && hasQaAnnotations(ct.rawText);
    const showTodoBadge: boolean = inBadgeMode && hasTodoAnnotations(ct.rawText);
    const showLinkBadge: boolean = inBadgeMode && hasLinkAnnotations(ct.rawText);
    const qaAnnotations = showQaBadge ? parseQaAnnotations(ct.rawText) : [];
    const todoAnnotations = showTodoBadge ? parseTodoAnnotations(ct.rawText) : [];
    const linkAnnotations = showLinkBadge ? parseLinkAnnotations(ct.rawText) : [];
    // Strip annotation markup from display text; omit the comment block if nothing remains.
    let displayText: string;
    if (showQaBadge || showTodoBadge || showLinkBadge) {
      let stripped: string = ct.rawText;
      if (showQaBadge) stripped = stripQaAnnotations(stripped);
      if (showTodoBadge) stripped = stripTodoAnnotations(stripped);
      if (showLinkBadge) stripped = stripLinkAnnotations(stripped);
      displayText = stripped;
    } else {
      displayText = ct.text;
    }
    const hasDisplayText: boolean = displayText.trim().length > 0;
    const displayToken: CommentToken =
      (showQaBadge || showTodoBadge || showLinkBadge) ? { ...ct, text: displayText } : ct;
    return (
      <>
        {showQaBadge && (
          <QaBadge
            annotations={qaAnnotations}
            t={t}
            onEdit={(index: number): void => {
              onEditQa(ct.commentId, index, ct.rawText);
            }}
            onDelete={(index: number): void => {
              onDeleteQa(ct.commentId, index, ct.rawText);
            }}
          />
        )}
        {showTodoBadge && (
          <TodoBadge
            annotations={todoAnnotations}
            t={t}
            onEdit={(index: number): void => {
              onEditTodo(ct.commentId, index, ct.rawText);
            }}
            onDelete={(index: number): void => {
              onDeleteTodo(ct.commentId, index, ct.rawText);
            }}
          />
        )}
        {showLinkBadge && (
          <LinkBadge
            annotations={linkAnnotations}
            onOpen={onOpenLinkedGame}
            onFetchMetadata={onFetchLinkMetadata}
            t={t}
            onEdit={(index: number): void => {
              onEditLink(ct.commentId, index, ct.rawText);
            }}
            onDelete={(index: number): void => {
              onDeleteLink(ct.commentId, index, ct.rawText);
            }}
          />
        )}
        {hasDisplayText && (
          <CommentBlock
            token={displayToken}
            isFocused={
              ct.commentId === pendingFocusCommentId &&
              pendingFocusCommentId !== consumedFocusCommentId
            }
            onFocusHandled={onCommentFocusHandled}
            onEdit={onCommentEdit}
          />
        )}
      </>
    );
  }

  const it: InlineToken = token;

  if (it.tokenType === "move") {
    return (
      <MoveSpan
        token={it}
        isSelected={String(it.dataset.nodeId ?? "") === selectedMoveId}
        onMoveClick={onMoveClick}
        onContextMenu={onContextMenu}
        onMoveHover={onMoveHover}
        onMoveHoverEnd={onMoveHoverEnd}
      />
    );
  }

  // Spaces, move numbers, NAGs, results, branch headers — non-interactive display-only spans.
  return (
    <span
      className={it.className || undefined}
      data-kind={it.tokenType}
    >
      {it.text}
    </span>
  );
};

type TokenRenderDeps = {
  selectedMoveId: string | null;
  pendingFocusCommentId: string | null;
  consumedFocusCommentId: string | null;
  layoutMode: "plain" | "text" | "tree";
  onMoveClick: (moveId: string) => void;
  onCommentEdit: (commentId: string, newText: string) => void;
  onCommentFocusHandled: (commentId: string) => void;
  onEditQa: (commentId: string, index: number, rawText: string) => void;
  onDeleteQa: (commentId: string, index: number, rawText: string) => void;
  onEditTodo: (commentId: string, index: number, rawText: string) => void;
  onDeleteTodo: (commentId: string, index: number, rawText: string) => void;
  onEditLink: (commentId: string, index: number, rawText: string) => void;
  onDeleteLink: (commentId: string, index: number, rawText: string) => void;
  onOpenLinkedGame: (recordId: string) => void;
  onFetchLinkMetadata: (recordId: string) => Promise<Record<string, string> | null>;
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
  onMoveHover?: (moveId: string, rect: DOMRect) => void;
  onMoveHoverEnd?: () => void;
  t: (key: string, fallback?: string) => string;
};

const tokenStableKey = (token: PlanToken): string => (
  token.kind === "comment"
    ? `comment_${(token as CommentToken).commentId}`
    : token.key
);

const renderToken = (token: PlanToken, deps: TokenRenderDeps): ReactElement => (
  <TokenView
    key={tokenStableKey(token)}
    token={token}
    selectedMoveId={deps.selectedMoveId}
    pendingFocusCommentId={deps.pendingFocusCommentId}
    consumedFocusCommentId={deps.consumedFocusCommentId}
    layoutMode={deps.layoutMode}
    onMoveClick={deps.onMoveClick}
    onCommentEdit={deps.onCommentEdit}
    onCommentFocusHandled={deps.onCommentFocusHandled}
    onEditQa={deps.onEditQa}
    onDeleteQa={deps.onDeleteQa}
    onEditTodo={deps.onEditTodo}
    onDeleteTodo={deps.onDeleteTodo}
    onEditLink={deps.onEditLink}
    onDeleteLink={deps.onDeleteLink}
    onOpenLinkedGame={deps.onOpenLinkedGame}
    onFetchLinkMetadata={deps.onFetchLinkMetadata}
    onContextMenu={deps.onContextMenu}
    onMoveHover={deps.onMoveHover}
    onMoveHoverEnd={deps.onMoveHoverEnd}
    t={deps.t}
  />
);

type LinearModeViewProps = {
  blocks: PlanBlock[];
  deps: TokenRenderDeps;
};

const LinearModeView = ({ blocks, deps }: LinearModeViewProps): ReactElement => (
  <>
    {blocks.map((block: PlanBlock): ReactElement => (
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

type TreeModeViewProps = {
  blocks: PlanBlock[];
  collapsedPaths: ReadonlySet<string>;
  lastSiblingByParent: ReadonlyMap<string, number>;
  onToggle: (key: string) => void;
  deps: TokenRenderDeps;
};

const TreeModeView = ({
  blocks,
  collapsedPaths,
  lastSiblingByParent,
  onToggle,
  deps,
}: TreeModeViewProps): ReactElement => (
  <>
    {blocks.map((block: PlanBlock): ReactElement | null => {
      // Hide blocks whose ancestor variation path is collapsed.
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

// ── PgnTextEditor (root) ──────────────────────────────────────────────────────


/** Renders the full PGN annotation editor from the computed token plan. */
export const PgnTextEditor = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const pgnModel = selectPgnModel(state);
  const layoutMode: "plain" | "text" | "tree" = selectLayoutMode(state);
  const selectedMoveId: string | null = selectSelectedMoveId(state);
  const pendingFocusCommentId: string | null = selectPendingFocusCommentId(state);
  const positionPreviewOnHover: boolean = selectPositionPreviewOnHover(state);
  const [consumedFocusCommentId, setConsumedFocusCommentId] = useState<string | null>(null);
  const t: (key: string, fallback?: string) => string = useTranslator();
  const { showPreview, hidePreview } = useHoverPreview();

  // ── Collapse state (tree mode only; reset when model changes) ───────────────
  const [collapsedPaths, setCollapsedPaths] = useState<ReadonlySet<string>>(new Set());
  useEffect((): void => { setCollapsedPaths(new Set()); }, [pgnModel]);

  // ── Truncation context menu state (M6/M7) ────────────────────────────────────
  type ContextMenuState = {
    moveId: string;
    san: string;
    isInVariation: boolean;
    anchorRect: DOMRect;
  };
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleMoveContextMenu = useCallback(
    (moveId: string, san: string, isInVariation: boolean, rect: DOMRect): void => {
      window.getSelection()?.removeAllRanges();
      setContextMenu({ moveId, san, isInVariation, anchorRect: rect });
    },
    [],
  );

  // ── Q/A dialog state (UV10/UV11) ─────────────────────────────────────────────
  const { qaDialog, handleEditQa, handleInsertQa, handleQaDialogSave, handleQaDialogClose, handleDeleteQa } = useQaDialog(services);

  // ── TODO dialog state ─────────────────────────────────────────────────────────
  const { todoDialog, handleEditTodo, handleInsertTodo, handleTodoDialogSave, handleTodoDialogClose, handleDeleteTodo } = useTodoDialog(services);

  // ── Game-link dialog state ────────────────────────────────────────────────────
  const {
    linkDialog,
    handleInsertLink,
    handleEditLink,
    handleLinkPickerSelect,
    handleLinkDialogClose,
    handleDeleteLink,
  } = useLinkDialog(services);

  const handleOpenLinkedGame = useCallback(
    (recordId: string): void => {
      void services.openGameFromRecordId(recordId);
    },
    [services],
  );

  const handleToggle = useCallback((key: string): void => {
    setCollapsedPaths((prev: ReadonlySet<string>): ReadonlySet<string> => {
      const next: Set<string> = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** Recompute the token plan only when the model or layout mode changes. */
  const blocks: PlanBlock[] = useMemo(
    (): PlanBlock[] => buildTextEditorPlan(pgnModel, { layoutMode }),
    [pgnModel, layoutMode],
  );
  const lastSiblingByParent: ReadonlyMap<string, number> = useMemo(
    (): ReadonlyMap<string, number> => buildLastSiblingByParent(blocks),
    [blocks],
  );

  /** Collect all TODO annotations from all comment tokens, with move context label. */
  const todoPanelItems: TodoPanelItem[] = useMemo((): TodoPanelItem[] => {
    const items: TodoPanelItem[] = [];
    let currentMoveLabel: string = t("editor.todo.intro", "Intro");
    for (const block of blocks) {
      for (const token of block.tokens) {
        if (token.kind === "inline" && token.tokenType === "move") {
          currentMoveLabel = (token as InlineToken).text;
        } else if (token.kind === "comment" && hasTodoAnnotations((token as CommentToken).rawText)) {
          const ct = token as CommentToken;
          parseTodoAnnotations(ct.rawText).forEach((ann, index): void => {
            items.push({
              commentId: ct.commentId,
              index,
              rawText: ct.rawText,
              text: ann.text,
              moveLabel: currentMoveLabel,
            });
          });
        }
      }
    }
    return items;
  }, [blocks, t]);

  const handleMoveClick = useCallback(
    (moveId: string): void => {
      services.gotoMoveById(moveId);
      // If an after-comment exists for this move, focus it for editing.
      services.focusCommentAroundMove(moveId, "after");
    },
    [services],
  );

  const handleMoveHover = useCallback(
    (moveId: string, rect: DOMRect): void => {
      if (!positionPreviewOnHover || !pgnModel) return;
      // Cast is safe: PgnModel is structurally compatible at runtime.
      const resolved = resolveMovePositionById(pgnModel as unknown as PgnModelForMoves, moveId);
      if (!resolved) return;
      showPreview(resolved.fen, resolved.lastMove, rect);
    },
    [positionPreviewOnHover, pgnModel, showPreview],
  );

  const handleMoveHoverEnd = useCallback((): void => {
    hidePreview();
  }, [hidePreview]);

  const handleInsertComment = useCallback(
    (moveId: string, position: "before" | "after"): void => {
      services.insertComment(moveId, position);
    },
    [services],
  );

  const handleTruncationAction = useCallback(
    (action: TruncationAction): void => {
      switch (action.type) {
        case "insert_comment_before":
          handleInsertComment(action.moveId, "before");
          return;
        case "insert_comment_after":
          handleInsertComment(action.moveId, "after");
          return;
        case "insert_qa":
          handleInsertQa(action.moveId);
          return;
        case "insert_todo":
          handleInsertTodo(action.moveId);
          return;
        case "insert_link":
          handleInsertLink(action.moveId);
          return;
        default:
          break;
      }
      if (!pgnModel) return;
      const cursor = findCursorForMoveId(pgnModel, action.moveId);
      if (!cursor) return;
      let newModel: import("../model/pgn_model").PgnModel;
      let newCursor: import("../model/pgn_move_ops").PgnCursor | null;
      switch (action.type) {
        case "delete_from_here":
          [newModel, newCursor] = truncateAfter(pgnModel, cursor);
          break;
        case "delete_before_here":
          [newModel, newCursor] = truncateBefore(pgnModel, cursor);
          break;
        case "delete_variation":
          [newModel, newCursor] = deleteVariation(pgnModel, cursor);
          break;
        case "delete_variations_after":
          [newModel, newCursor] = deleteVariationsAfter(pgnModel, cursor);
          break;
        case "promote_to_mainline":
          [newModel, newCursor] = promoteToMainline(pgnModel, cursor);
          break;
        default:
          return;
      }
      services.applyPgnModelEdit(newModel, newCursor?.moveId ?? null);
    },
    [pgnModel, services, handleInsertComment, handleInsertQa, handleInsertTodo, handleInsertLink],
  );

  const handleCommentEdit = useCallback(
    (commentId: string, newText: string): void => {
      // Normalize any raw newlines (from Enter, paste, etc.) to [[br]] markers
      // so the canonical PGN comment always uses the [[br]] convention.
      services.saveCommentText(commentId, newText.replace(/\n/g, "[[br]]"));
    },
    [services],
  );

  useEffect((): void => {
    setConsumedFocusCommentId(null);
  }, [pendingFocusCommentId]);

  const handleCommentFocusHandled = useCallback((commentId: string): void => {
    setConsumedFocusCommentId(commentId);
  }, []);

  useEffect((): (() => void) => {
    const shouldIgnoreHotkey = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag: string = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest("[contenteditable=\"true\"]"));
    };

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (shouldIgnoreHotkey(event.target)) return;
      services.handleEditorArrowHotkey(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return (): void => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [services]);

  if (!pgnModel) {
    return (
      <div className="text-editor text-editor-empty">
        <p className="text-editor-hint">
          {t("editor.hint", "Open a PGN game to start annotating.")}
        </p>
      </div>
    );
  }

  return (
    <div className="text-editor" data-layout-mode={layoutMode}>
      {layoutMode === "tree" ? (
        <TreeModeView
          blocks={blocks}
          collapsedPaths={collapsedPaths}
          lastSiblingByParent={lastSiblingByParent}
          onToggle={handleToggle}
          deps={{
            selectedMoveId,
            pendingFocusCommentId,
            consumedFocusCommentId,
            layoutMode,
            onMoveClick: handleMoveClick,
            onCommentEdit: handleCommentEdit,
            onCommentFocusHandled: handleCommentFocusHandled,
            onEditQa: handleEditQa,
            onDeleteQa: handleDeleteQa,
            onEditTodo: handleEditTodo,
            onDeleteTodo: handleDeleteTodo,
            onEditLink: handleEditLink,
            onDeleteLink: handleDeleteLink,
            onOpenLinkedGame: handleOpenLinkedGame,
            onFetchLinkMetadata: services.fetchGameMetadataByRecordId,
            onContextMenu: handleMoveContextMenu,
            onMoveHover: handleMoveHover,
            onMoveHoverEnd: handleMoveHoverEnd,
            t,
          }}
        />
      ) : (
        <LinearModeView
          blocks={blocks}
          deps={{
            selectedMoveId,
            pendingFocusCommentId,
            consumedFocusCommentId,
            layoutMode,
            onMoveClick: handleMoveClick,
            onCommentEdit: handleCommentEdit,
            onCommentFocusHandled: handleCommentFocusHandled,
            onEditQa: handleEditQa,
            onDeleteQa: handleDeleteQa,
            onEditTodo: handleEditTodo,
            onDeleteTodo: handleDeleteTodo,
            onEditLink: handleEditLink,
            onDeleteLink: handleDeleteLink,
            onOpenLinkedGame: handleOpenLinkedGame,
            onFetchLinkMetadata: services.fetchGameMetadataByRecordId,
            onContextMenu: handleMoveContextMenu,
            onMoveHover: handleMoveHover,
            onMoveHoverEnd: handleMoveHoverEnd,
            t,
          }}
        />
      )}
      <TodoPanel
        items={todoPanelItems}
        t={t}
        onEdit={handleEditTodo}
        onDelete={handleDeleteTodo}
      />
      {qaDialog !== null && (
        <QaInsertDialog
          moveId={qaDialog.commentId}
          initial={qaDialog.initial}
          t={t}
          onSave={handleQaDialogSave}
          onClose={handleQaDialogClose}
        />
      )}
      {todoDialog !== null && (
        <TodoInsertDialog
          moveId={todoDialog.commentId}
          initial={todoDialog.initial}
          t={t}
          onSave={handleTodoDialogSave}
          onClose={handleTodoDialogClose}
        />
      )}
      {linkDialog !== null && (
        <GamePickerDialog
          resourceRef={linkDialog.resourceRef}
          onSelect={handleLinkPickerSelect}
          onCancel={handleLinkDialogClose}
          t={t}
        />
      )}
      {contextMenu !== null && (
        <TruncationMenu
          moveId={contextMenu.moveId}
          san={contextMenu.san}
          isInVariation={contextMenu.isInVariation}
          anchorRect={contextMenu.anchorRect}
          t={t}
          onAction={handleTruncationAction}
          onClose={(): void => { setContextMenu(null); }}
        />
      )}
    </div>
  );
};
