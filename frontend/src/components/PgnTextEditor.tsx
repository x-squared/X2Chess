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
 */

import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import type { ReactElement, KeyboardEvent, FormEvent, MouseEvent } from "react";
import { buildTextEditorPlan } from "../editor/text_editor_plan";
import type { PlanBlock, PlanToken, InlineToken, CommentToken } from "../editor/text_editor_plan";
import { useAppContext } from "../state/app_context";
import {
  selectPgnModel,
  selectLayoutMode,
  selectSelectedMoveId,
  selectPendingFocusCommentId,
} from "../state/selectors";
import { useServiceContext } from "../state/ServiceContext";
import { useTranslator } from "../hooks/useTranslator";

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
 * The element is intentionally **uncontrolled**: React sets the initial
 * `children` once on mount but never overwrites user edits.  The parent
 * must supply a stable key derived from the comment ID so that model updates
 * trigger a fresh mount with the new text.
 *
 * Cmd/Ctrl+B/I/U apply bold, italic, and underline formatting via `execCommand`,
 * which remains the de-facto standard for `contentEditable` inline styling.
 */
const CommentBlock = ({ token, isFocused, onEdit }: CommentBlockProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  // Set initial text on mount only — never update reactively.
  // Passing token.text as React children would cause React to reconcile the
  // text node on every model update, resetting the caret position.
  useEffect((): void => {
    if (ref.current) ref.current.innerText = token.text;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

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
  }, [isFocused]);

  const handleInput = (e: FormEvent<HTMLDivElement>): void => {
    onEdit(token.commentId, (e.currentTarget as HTMLDivElement).innerText);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const withMeta: boolean = e.metaKey || e.ctrlKey;
    if (!withMeta) return;
    const command: string | undefined = FORMAT_KEYS[e.key.toLowerCase()];
    if (!command) return;
    e.preventDefault();
    // execCommand is deprecated but remains the only cross-browser API for
    // inline formatting inside contentEditable elements.
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
  /**
   * Called when the user clicks an insert-comment ± button.
   * @param moveId - PGN move node ID adjacent to the insert point.
   * @param position - Whether to insert before or after the move.
   */
  onInsertComment: (moveId: string, position: "before" | "after") => void;
  /** Translator function. */
  t: (key: string, fallback?: string) => string;
};

/**
 * Renders a clickable SAN move token.
 *
 * Hover state is local (`useState`) so each span is self-contained and
 * no global hover atom is required.  The ± insert buttons appear on hover,
 * allowing the user to insert a comment before or after the move.
 */
const MoveSpan = ({
  token,
  isSelected,
  onMoveClick,
  onInsertComment,
  t,
}: MoveSpanProps): ReactElement => {
  const moveId: string = String(token.dataset.nodeId ?? "");

  const handleClick = useCallback((): void => {
    onMoveClick(moveId);
  }, [moveId, onMoveClick]);

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onMoveClick(moveId);
    }
  };

  const handleInsertBefore = useCallback(
    (e: MouseEvent): void => {
      e.stopPropagation();
      onInsertComment(moveId, "before");
    },
    [moveId, onInsertComment],
  );

  const handleInsertAfter = useCallback(
    (e: MouseEvent): void => {
      e.stopPropagation();
      onInsertComment(moveId, "after");
    },
    [moveId, onInsertComment],
  );

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
      onKeyDown={handleKeyDown}
    >
      {/* Before-button: shown left of move on hover via CSS */}
      <button
        type="button"
        className="text-editor-insert-before"
        tabIndex={-1}
        onClick={handleInsertBefore}
        aria-label={t("editor.insertBefore", "Insert comment before move")}
        aria-hidden="true"
      >
        +
      </button>
      {token.text}
      {/* After-button: shown right of move on hover via CSS */}
      <button
        type="button"
        className="text-editor-insert-after"
        tabIndex={-1}
        onClick={handleInsertAfter}
        aria-label={t("editor.insertAfter", "Insert comment after move")}
        aria-hidden="true"
      >
        +
      </button>
    </span>
  );
};

// ── TokenView ─────────────────────────────────────────────────────────────────

type TokenViewProps = {
  token: PlanToken;
  selectedMoveId: string | null;
  pendingFocusCommentId: string | null;
  onMoveClick: (moveId: string) => void;
  onInsertComment: (moveId: string, position: "before" | "after") => void;
  onCommentEdit: (commentId: string, newText: string) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Dispatches a plan token to the appropriate sub-component.
 *
 * - `comment` tokens → `<CommentBlock>`
 * - `move` inline tokens → `<MoveSpan>`
 * - All other inline tokens (move_number, nag, result, space) → plain `<span>`
 */
const TokenView = ({
  token,
  selectedMoveId,
  pendingFocusCommentId,
  onMoveClick,
  onInsertComment,
  onCommentEdit,
  t,
}: TokenViewProps): ReactElement => {
  if (token.kind === "comment") {
    const ct: CommentToken = token;
    return (
      <CommentBlock
        token={ct}
        isFocused={ct.commentId === pendingFocusCommentId}
        onEdit={onCommentEdit}
      />
    );
  }

  const it: InlineToken = token;

  if (it.tokenType === "move") {
    return (
      <MoveSpan
        token={it}
        isSelected={String(it.dataset.nodeId ?? "") === selectedMoveId}
        onMoveClick={onMoveClick}
        onInsertComment={onInsertComment}
        t={t}
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

// ── PgnTextEditor (root) ──────────────────────────────────────────────────────

/** Renders the full PGN annotation editor from the computed token plan. */
export const PgnTextEditor = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const pgnModel = selectPgnModel(state);
  const layoutMode: "plain" | "text" | "tree" = selectLayoutMode(state);
  const selectedMoveId: string | null = selectSelectedMoveId(state);
  const pendingFocusCommentId: string | null = selectPendingFocusCommentId(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  // ── Collapse state (tree mode only; reset when model changes) ───────────────
  const [collapsedPaths, setCollapsedPaths] = useState<ReadonlySet<string>>(new Set());
  useEffect((): void => { setCollapsedPaths(new Set()); }, [pgnModel]);

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

  const handleMoveClick = useCallback(
    (moveId: string): void => {
      services.gotoMoveById(moveId);
    },
    [services],
  );

  const handleInsertComment = useCallback(
    (moveId: string, position: "before" | "after"): void => {
      services.insertComment(moveId, position);
    },
    [services],
  );

  const handleCommentEdit = useCallback(
    (commentId: string, newText: string): void => {
      services.saveCommentText(commentId, newText);
    },
    [services],
  );

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
      {blocks.map((block: PlanBlock): ReactElement | null => {
        // Hide blocks whose ancestor variation path is collapsed.
        if (isBlockHidden(block.variationPath, collapsedPaths)) return null;

        const depthClass: string = block.variationPath
          ? treeDepthClass(block.variationPath)
          : "";
        const isCollapsed: boolean = block.variationPath
          ? collapsedPaths.has(pathKey(block.variationPath))
          : false;

        // Find the branch_header label for collapsible blocks.
        const branchLabelToken: InlineToken | undefined = block.isCollapsible
          ? (block.tokens.find(
              (tok: PlanToken): tok is InlineToken =>
                tok.kind === "inline" && tok.tokenType === "branch_header",
            ))
          : undefined;

        return (
          <div
            key={block.key}
            className={["text-editor-block", depthClass].filter(Boolean).join(" ")}
            style={
              block.indentDepth > 0
                ? { paddingLeft: `${block.indentDepth * 1.5}em` }
                : undefined
            }
            data-indent-depth={block.indentDepth > 0 ? block.indentDepth : undefined}
            data-variation-path={block.variationPath ? pathKey(block.variationPath) : undefined}
          >
            {block.isCollapsible && branchLabelToken && (
              <BranchHeader
                label={String(branchLabelToken.dataset.label ?? branchLabelToken.text)}
                blockPathKey={pathKey(block.variationPath!)}
                isCollapsed={isCollapsed}
                onToggle={handleToggle}
              />
            )}
            {/* When collapsed, render only the header (tokens hidden). */}
            {!isCollapsed && block.tokens
              .filter((tok: PlanToken): boolean =>
                !(tok.kind === "inline" && tok.tokenType === "branch_header"),
              )
              .map((token: PlanToken): ReactElement => {
                /**
                 * Comment tokens use a stable key derived from their ID so that
                 * React does not remount while the user is editing.  Inline tokens
                 * use the positional key from the planner; reordering or structural
                 * changes produce a new key and force a fresh mount.
                 */
                const stableKey: string =
                  token.kind === "comment"
                    ? `comment_${(token as CommentToken).commentId}`
                    : token.key;

                return (
                  <TokenView
                    key={stableKey}
                    token={token}
                    selectedMoveId={selectedMoveId}
                    pendingFocusCommentId={pendingFocusCommentId}
                    onMoveClick={handleMoveClick}
                    onInsertComment={handleInsertComment}
                    onCommentEdit={handleCommentEdit}
                    t={t}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
};
