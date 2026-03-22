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
  replaceQaAnnotation,
  appendQaAnnotation,
} from "../resources_viewer/qa_parser";
import type { QaAnnotation } from "../resources_viewer/qa_parser";

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
  /** Called when the user requests Q/A insertion on this move (UV10). */
  onInsertQa: (moveId: string) => void;
  /** Called when the user right-clicks a move to open the truncation context menu. */
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
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
  onInsertQa,
  onContextMenu,
  t,
}: MoveSpanProps): ReactElement => {
  const moveId: string = String(token.dataset.nodeId ?? "");

  const handleClick = useCallback((): void => {
    onMoveClick(moveId);
  }, [moveId, onMoveClick]);

  const handleContextMenu = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
      const isInVariation = (token.dataset.variationDepth as number ?? 0) > 0;
      onContextMenu(moveId, token.text, isInVariation, rect);
    },
    [moveId, token.text, token.dataset.variationDepth, onContextMenu],
  );

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

  const handleQaClick = useCallback(
    (e: MouseEvent): void => {
      e.stopPropagation();
      onInsertQa(moveId);
    },
    [moveId, onInsertQa],
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
      onContextMenu={handleContextMenu}
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
      {/* Q/A insert button (UV10) */}
      <button
        type="button"
        className="text-editor-insert-qa"
        tabIndex={-1}
        onClick={handleQaClick}
        aria-label={t("editor.insertQa", "Add Q/A annotation")}
        aria-hidden="true"
      >
        ?
      </button>
    </span>
  );
};

// ── TokenView ─────────────────────────────────────────────────────────────────

type TokenViewProps = {
  token: PlanToken;
  selectedMoveId: string | null;
  pendingFocusCommentId: string | null;
  layoutMode: "plain" | "text" | "tree";
  onMoveClick: (moveId: string) => void;
  onInsertComment: (moveId: string, position: "before" | "after") => void;
  onCommentEdit: (commentId: string, newText: string) => void;
  onEditQa: (commentId: string, index: number, rawText: string) => void;
  onInsertQa: (moveId: string) => void;
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
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
  layoutMode,
  onMoveClick,
  onInsertComment,
  onCommentEdit,
  onEditQa,
  onInsertQa,
  onContextMenu,
  t,
}: TokenViewProps): ReactElement => {
  if (token.kind === "comment") {
    const ct: CommentToken = token;
    const showQaBadge: boolean =
      layoutMode !== "plain" && !ct.plainLiteralComment && hasQaAnnotations(ct.rawText);
    const qaAnnotations = showQaBadge ? parseQaAnnotations(ct.rawText) : [];
    // Show stripped text in the editable block when Q/A is present in text/tree mode.
    const displayToken: CommentToken =
      showQaBadge
        ? { ...ct, text: stripQaAnnotations(ct.rawText) }
        : ct;
    return (
      <>
        {showQaBadge && (
          <QaBadge
            annotations={qaAnnotations}
            t={t}
            onEdit={(index: number): void => {
              onEditQa(ct.commentId, index, ct.rawText);
            }}
          />
        )}
        <CommentBlock
          token={displayToken}
          isFocused={ct.commentId === pendingFocusCommentId}
          onEdit={onCommentEdit}
        />
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
        onInsertComment={onInsertComment}
        onInsertQa={onInsertQa}
        onContextMenu={onContextMenu}
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

// ── Q/A dialog state ──────────────────────────────────────────────────────────

type QaDialogState = {
  /** ID of the comment being edited/created. */
  commentId: string;
  /** Raw text of the comment (for edit). */
  rawText: string;
  /** Index of the annotation being edited, or -1 for insert. */
  editIndex: number;
  /** Pre-filled values when editing. */
  initial?: QaAnnotation;
};

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
      setContextMenu({ moveId, san, isInVariation, anchorRect: rect });
    },
    [],
  );

  const handleTruncationAction = useCallback(
    (action: TruncationAction): void => {
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
    [pgnModel, services],
  );

  // ── Q/A dialog state (UV10/UV11) ─────────────────────────────────────────────
  const [qaDialog, setQaDialog] = useState<QaDialogState | null>(null);

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

  // UV11: open read/edit dialog for an existing Q/A annotation.
  const handleEditQa = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const annotations = parseQaAnnotations(rawText);
      setQaDialog({
        commentId,
        rawText,
        editIndex: index,
        initial: annotations[index],
      });
    },
    [],
  );

  // UV10: insert Q/A on a move — insert a new empty comment first, then open dialog.
  const handleInsertQa = useCallback(
    (moveId: string): void => {
      // Open insert dialog targeted at this move's comment.
      // We use commentId="" to signal "new annotation after move".
      setQaDialog({ commentId: "", rawText: "", editIndex: -1, initial: undefined });
      // Also insert a comment node so the model knows a comment is pending.
      services.insertComment(moveId, "after");
    },
    [services],
  );

  const handleQaDialogSave = useCallback(
    (_moveId: string, annotation: QaAnnotation): void => {
      if (!qaDialog) return;
      if (qaDialog.commentId && qaDialog.editIndex >= 0) {
        // Edit existing annotation.
        const updated = replaceQaAnnotation(qaDialog.rawText, qaDialog.editIndex, annotation);
        services.saveCommentText(qaDialog.commentId, updated);
      } else if (qaDialog.commentId) {
        // Append new annotation to an existing comment.
        const updated = appendQaAnnotation(qaDialog.rawText, annotation);
        services.saveCommentText(qaDialog.commentId, updated);
      }
      // When commentId is empty, the insertComment above created the comment;
      // pendingFocusCommentId will point to it — the user can type the Q/A there.
      setQaDialog(null);
    },
    [qaDialog, services],
  );

  const handleQaDialogClose = useCallback((): void => {
    setQaDialog(null);
  }, []);

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
                    layoutMode={layoutMode}
                    onMoveClick={handleMoveClick}
                    onInsertComment={handleInsertComment}
                    onCommentEdit={handleCommentEdit}
                    onEditQa={handleEditQa}
                    onInsertQa={handleInsertQa}
                    onContextMenu={handleMoveContextMenu}
                    t={t}
                  />
                );
              })}
          </div>
        );
      })}
      {qaDialog !== null && (
        <QaInsertDialog
          moveId={qaDialog.commentId}
          initial={qaDialog.initial}
          t={t}
          onSave={handleQaDialogSave}
          onClose={handleQaDialogClose}
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
