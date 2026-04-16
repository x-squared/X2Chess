/**
 * PgnEditorTokenView — token-level rendering for the PGN text editor.
 *
 * Exports `TokenView` (dispatches plan tokens to sub-components), the
 * `TokenRenderDeps` bag passed to mode views, and `renderToken` / visibility
 * helpers used by `LinearModeView` and `TreeModeView`.
 *
 * No React context reads; all data arrives via the `TokenRenderDeps` bag.
 */

import type { ReactElement } from "react";
import { QaBadge } from "../../../components/badges/QaBadge";
import {
  parseQaAnnotations,
  hasQaAnnotations,
  stripQaAnnotations,
} from "../../resources/services/qa_parser";
import { TrainBadge } from "../../../components/badges/TrainBadge";
import {
  parseTrainTag,
  hasTrainAnnotation,
  stripTrainAnnotation,
} from "../../resources/services/train_tag_parser";
import { TodoBadge } from "../../../components/badges/TodoBadge";
import {
  parseTodoAnnotations,
  hasTodoAnnotations,
  stripTodoAnnotations,
} from "../../resources/services/todo_parser";
import { LinkBadge } from "../../../components/badges/LinkBadge";
import {
  parseLinkAnnotations,
  hasLinkAnnotations,
  stripLinkAnnotations,
} from "../../resources/services/link_parser";
import { AnchorBadge, AnchorRefChip } from "../../../components/badges/AnchorBadge";
import {
  parseAnchorAnnotations,
  hasAnchorAnnotations,
  stripAnchorAnnotations,
  parseAnchorRefAnnotations,
  hasAnchorRefAnnotations,
  stripAnchorRefAnnotations,
} from "../../resources/services/anchor_parser";
import { EvalBadge } from "../../../components/badges/EvalBadge";
import {
  parseEvalAnnotations,
  hasEvalAnnotations,
  stripEvalAnnotations,
} from "../../resources/services/eval_parser";
import type { ResolvedAnchor } from "../model/resolveAnchors";
import type { PlanToken, InlineToken, CommentToken } from "../model/text_editor_plan";
import { CommentBlock } from "./PgnEditorCommentBlock";
import { MoveSpan } from "./PgnEditorMoveSpan";

// ── shouldRenderCommentBlock ───────────────────────────────────────────────────

/**
 * Resolve whether a comment block should be rendered.
 *
 * A focused comment must be rendered even when its display text is empty so a
 * freshly inserted empty comment can enter edit mode immediately.
 *
 * @param hasDisplayText True when stripped comment text is non-empty.
 * @param hasRawCommentText True when the underlying raw comment text is non-empty.
 * @param commentId Current comment id token.
 * @param pendingFocusCommentId Pending focus id from session state.
 * @param consumedFocusCommentId Last focus id already consumed by the editor.
 * @returns True when the comment block should be present in the DOM.
 */
export const shouldRenderCommentBlock = (
  hasDisplayText: boolean,
  hasRawCommentText: boolean,
  commentId: string,
  pendingFocusCommentId: string | null,
  consumedFocusCommentId: string | null,
): boolean => {
  if (hasDisplayText || !hasRawCommentText) return true;
  return commentId === pendingFocusCommentId && pendingFocusCommentId !== consumedFocusCommentId;
};

// ── TokenView ─────────────────────────────────────────────────────────────────

export type TokenViewProps = {
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
  onEditTrain: (commentId: string, rawText: string) => void;
  onDeleteTrain: (commentId: string, rawText: string) => void;
  onEditTodo: (commentId: string, index: number, rawText: string) => void;
  onDeleteTodo: (commentId: string, index: number, rawText: string) => void;
  onEditLink: (commentId: string, index: number, rawText: string) => void;
  onDeleteLink: (commentId: string, index: number, rawText: string) => void;
  onOpenLinkedGame: (recordId: string) => void;
  onFetchLinkMetadata: (recordId: string) => Promise<Record<string, string> | null>;
  onEditAnchorDef: (commentId: string, index: number, rawText: string, moveId: string) => void;
  onDeleteAnchorDef: (commentId: string, index: number, rawText: string) => void;
  onEditAnchorRef: (commentId: string, index: number, rawText: string, currentId: string) => void;
  onDeleteAnchorRef: (commentId: string, index: number, rawText: string) => void;
  resolvedAnchorsMap: ReadonlyMap<string, ResolvedAnchor>;
  /** Whether engine evaluation pills are currently shown. */
  showEvalPills: boolean;
  onDeleteEval: (commentId: string, index: number, rawText: string) => void;
  onDeleteAllEvals: () => void;
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
  onMoveHover?: (moveId: string, rect: DOMRect) => void;
  onMoveHoverEnd?: () => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Dispatches a plan token to the appropriate sub-component.
 *
 * - `comment` tokens → `<CommentBlock>` (with optional annotation badges in text/tree mode)
 * - `move` inline tokens → `<MoveSpan>`
 * - All other inline tokens (move_number, nag, result, space) → plain `<span>`
 */
export const TokenView = ({
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
  onEditTrain,
  onDeleteTrain,
  onEditTodo,
  onDeleteTodo,
  onEditLink,
  onDeleteLink,
  onOpenLinkedGame,
  onFetchLinkMetadata,
  onEditAnchorDef,
  onDeleteAnchorDef,
  onEditAnchorRef,
  onDeleteAnchorRef,
  resolvedAnchorsMap,
  showEvalPills,
  onDeleteEval,
  onDeleteAllEvals,
  onContextMenu,
  onMoveHover,
  onMoveHoverEnd,
  t,
}: TokenViewProps): ReactElement => {
  if (token.kind === "comment") {
    const ct: CommentToken = token;
    const inBadgeMode: boolean = layoutMode !== "plain";
    const showQaBadge: boolean = inBadgeMode && hasQaAnnotations(ct.rawText);
    const showTrainBadge: boolean = inBadgeMode && hasTrainAnnotation(ct.rawText);
    const showTodoBadge: boolean = inBadgeMode && hasTodoAnnotations(ct.rawText);
    const showLinkBadge: boolean = inBadgeMode && hasLinkAnnotations(ct.rawText);
    const showAnchorBadge: boolean = inBadgeMode && hasAnchorAnnotations(ct.rawText);
    const showAnchorRefChips: boolean = inBadgeMode && hasAnchorRefAnnotations(ct.rawText);
    const showEvalBadge: boolean = inBadgeMode && showEvalPills && hasEvalAnnotations(ct.rawText);
    const qaAnnotations = showQaBadge ? parseQaAnnotations(ct.rawText) : [];
    const trainTag = showTrainBadge ? parseTrainTag(ct.rawText) : null;
    const todoAnnotations = showTodoBadge ? parseTodoAnnotations(ct.rawText) : [];
    const linkAnnotations = showLinkBadge ? parseLinkAnnotations(ct.rawText) : [];
    const anchorAnnotations = showAnchorBadge ? parseAnchorAnnotations(ct.rawText) : [];
    const anchorRefAnnotations = showAnchorRefChips ? parseAnchorRefAnnotations(ct.rawText) : [];
    const evalAnnotations = showEvalBadge ? parseEvalAnnotations(ct.rawText) : [];
    // Eval is always stripped from display even when pills are hidden (it's machine data).
    const hasAnyEval: boolean = inBadgeMode && hasEvalAnnotations(ct.rawText);
    const anyBadge: boolean = showQaBadge || showTrainBadge || showTodoBadge || showLinkBadge || showAnchorBadge || showAnchorRefChips || hasAnyEval;
    let displayText: string;
    if (anyBadge) {
      let stripped: string = ct.rawText;
      if (showQaBadge) stripped = stripQaAnnotations(stripped);
      if (showTrainBadge) stripped = stripTrainAnnotation(stripped);
      if (showTodoBadge) stripped = stripTodoAnnotations(stripped);
      if (showLinkBadge) stripped = stripLinkAnnotations(stripped);
      if (showAnchorBadge) stripped = stripAnchorAnnotations(stripped);
      if (showAnchorRefChips) stripped = stripAnchorRefAnnotations(stripped);
      if (hasAnyEval) stripped = stripEvalAnnotations(stripped);
      displayText = stripped;
    } else {
      displayText = ct.text;
    }
    const hasDisplayText: boolean = displayText.trim().length > 0;
    const shouldFocusComment: boolean =
      ct.commentId === pendingFocusCommentId &&
      pendingFocusCommentId !== consumedFocusCommentId;
    const shouldRenderCommentBlockValue: boolean = shouldRenderCommentBlock(
      hasDisplayText,
      ct.rawText.trim().length > 0,
      ct.commentId,
      pendingFocusCommentId,
      consumedFocusCommentId,
    );
    const displayToken: CommentToken = anyBadge ? { ...ct, text: displayText } : ct;
    const moveIdForAnchor: string = ct.commentId;
    return (
      <>
        {showAnchorBadge && (
          <AnchorBadge
            annotations={anchorAnnotations}
            t={t}
            onEdit={(index: number): void => {
              onEditAnchorDef(ct.commentId, index, ct.rawText, moveIdForAnchor);
            }}
            onDelete={(index: number): void => {
              onDeleteAnchorDef(ct.commentId, index, ct.rawText);
            }}
          />
        )}
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
        {showTrainBadge && trainTag !== null && (
          <TrainBadge
            tag={trainTag}
            t={t}
            onEdit={(): void => { onEditTrain(ct.commentId, ct.rawText); }}
            onDelete={(): void => { onDeleteTrain(ct.commentId, ct.rawText); }}
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
        {showAnchorRefChips && anchorRefAnnotations.map((ref, i) => (
          <AnchorRefChip
            key={`${ref.id}_${i}`}
            refAnnotation={ref}
            resolved={resolvedAnchorsMap.get(ref.id) ?? null}
            index={i}
            t={t}
            onEdit={(index: number): void => {
              onEditAnchorRef(ct.commentId, index, ct.rawText, ref.id);
            }}
            onDelete={(index: number): void => {
              onDeleteAnchorRef(ct.commentId, index, ct.rawText);
            }}
          />
        ))}
        {showEvalBadge && (
          <EvalBadge
            annotations={evalAnnotations}
            t={t}
            onDelete={(index: number): void => {
              onDeleteEval(ct.commentId, index, ct.rawText);
            }}
            onDeleteAll={onDeleteAllEvals}
          />
        )}
        {shouldRenderCommentBlockValue && (
          <CommentBlock
            token={displayToken}
            isFocused={shouldFocusComment}
            onFocusHandled={onCommentFocusHandled}
            onEdit={onCommentEdit}
          />
        )}
      </>
    );
  }

  if (token.kind === "inline") {
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
  }

  // Fallback for unknown token kinds.
  const it: InlineToken = token as InlineToken;
  return (
    <span
      className={it.className || undefined}
      data-kind={it.tokenType}
    >
      {it.text}
    </span>
  );
};

// ── TokenRenderDeps ───────────────────────────────────────────────────────────

/** Flat callback bag passed to `LinearModeView` and `TreeModeView`. */
export type TokenRenderDeps = {
  selectedMoveId: string | null;
  pendingFocusCommentId: string | null;
  consumedFocusCommentId: string | null;
  layoutMode: "plain" | "text" | "tree";
  onMoveClick: (moveId: string) => void;
  onCommentEdit: (commentId: string, newText: string) => void;
  onCommentFocusHandled: (commentId: string) => void;
  onEditQa: (commentId: string, index: number, rawText: string) => void;
  onDeleteQa: (commentId: string, index: number, rawText: string) => void;
  onEditTrain: (commentId: string, rawText: string) => void;
  onDeleteTrain: (commentId: string, rawText: string) => void;
  onEditTodo: (commentId: string, index: number, rawText: string) => void;
  onDeleteTodo: (commentId: string, index: number, rawText: string) => void;
  onEditLink: (commentId: string, index: number, rawText: string) => void;
  onDeleteLink: (commentId: string, index: number, rawText: string) => void;
  onOpenLinkedGame: (recordId: string) => void;
  onFetchLinkMetadata: (recordId: string) => Promise<Record<string, string> | null>;
  onEditAnchorDef: (commentId: string, index: number, rawText: string, moveId: string) => void;
  onDeleteAnchorDef: (commentId: string, index: number, rawText: string) => void;
  onEditAnchorRef: (commentId: string, index: number, rawText: string, currentId: string) => void;
  onDeleteAnchorRef: (commentId: string, index: number, rawText: string) => void;
  resolvedAnchorsMap: ReadonlyMap<string, ResolvedAnchor>;
  showEvalPills: boolean;
  onDeleteEval: (commentId: string, index: number, rawText: string) => void;
  onDeleteAllEvals: () => void;
  onContextMenu: (moveId: string, san: string, isInVariation: boolean, rect: DOMRect) => void;
  onMoveHover?: (moveId: string, rect: DOMRect) => void;
  onMoveHoverEnd?: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── renderToken helpers ───────────────────────────────────────────────────────

const tokenStableKey = (token: PlanToken): string => {
  if (token.kind === "comment") {
    return `comment_${(token as CommentToken).commentId}`;
  }
  const nodeId: string = String(token.dataset?.nodeId ?? "");
  return `${token.key}_${token.tokenType}_${token.text}_${nodeId}`;
};

export const renderToken = (token: PlanToken, deps: TokenRenderDeps): ReactElement => (
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
    onEditTrain={deps.onEditTrain}
    onDeleteTrain={deps.onDeleteTrain}
    onEditTodo={deps.onEditTodo}
    onDeleteTodo={deps.onDeleteTodo}
    onEditLink={deps.onEditLink}
    onDeleteLink={deps.onDeleteLink}
    onOpenLinkedGame={deps.onOpenLinkedGame}
    onFetchLinkMetadata={deps.onFetchLinkMetadata}
    onEditAnchorDef={deps.onEditAnchorDef}
    onDeleteAnchorDef={deps.onDeleteAnchorDef}
    onEditAnchorRef={deps.onEditAnchorRef}
    onDeleteAnchorRef={deps.onDeleteAnchorRef}
    resolvedAnchorsMap={deps.resolvedAnchorsMap}
    showEvalPills={deps.showEvalPills}
    onDeleteEval={deps.onDeleteEval}
    onDeleteAllEvals={deps.onDeleteAllEvals}
    onContextMenu={deps.onContextMenu}
    onMoveHover={deps.onMoveHover}
    onMoveHoverEnd={deps.onMoveHoverEnd}
    t={deps.t}
  />
);

// ── Visibility helpers (used by mode views) ───────────────────────────────────

type CommentVisibilityFlags = {
  showQaBadge: boolean;
  showTrainBadge: boolean;
  showTodoBadge: boolean;
  showLinkBadge: boolean;
  showAnchorBadge: boolean;
  showAnchorRefChips: boolean;
  showEvalBadge: boolean;
  hasAnyEval: boolean;
};

const getCommentVisibilityFlags = (token: CommentToken, deps: TokenRenderDeps): CommentVisibilityFlags => {
  const inBadgeMode: boolean = deps.layoutMode !== "plain";
  const hasEval: boolean = inBadgeMode && hasEvalAnnotations(token.rawText);
  return {
    showQaBadge: inBadgeMode && hasQaAnnotations(token.rawText),
    showTrainBadge: inBadgeMode && hasTrainAnnotation(token.rawText),
    showTodoBadge: inBadgeMode && hasTodoAnnotations(token.rawText),
    showLinkBadge: inBadgeMode && hasLinkAnnotations(token.rawText),
    showAnchorBadge: inBadgeMode && hasAnchorAnnotations(token.rawText),
    showAnchorRefChips: inBadgeMode && hasAnchorRefAnnotations(token.rawText),
    showEvalBadge: inBadgeMode && deps.showEvalPills && hasEval,
    hasAnyEval: hasEval,
  };
};

const buildVisibleCommentText = (token: CommentToken, flags: CommentVisibilityFlags): string => {
  if (
    !flags.showQaBadge
    && !flags.showTrainBadge
    && !flags.showTodoBadge
    && !flags.showLinkBadge
    && !flags.showAnchorBadge
    && !flags.showAnchorRefChips
    && !flags.hasAnyEval
  ) {
    return token.text;
  }
  let stripped: string = token.rawText;
  if (flags.showQaBadge) stripped = stripQaAnnotations(stripped);
  if (flags.showTrainBadge) stripped = stripTrainAnnotation(stripped);
  if (flags.showTodoBadge) stripped = stripTodoAnnotations(stripped);
  if (flags.showLinkBadge) stripped = stripLinkAnnotations(stripped);
  if (flags.showAnchorBadge) stripped = stripAnchorAnnotations(stripped);
  if (flags.showAnchorRefChips) stripped = stripAnchorRefAnnotations(stripped);
  if (flags.hasAnyEval) stripped = stripEvalAnnotations(stripped);
  return stripped;
};

const isCommentTokenVisible = (token: CommentToken, deps: TokenRenderDeps): boolean => {
  const flags: CommentVisibilityFlags = getCommentVisibilityFlags(token, deps);
  const hasVisibleBadge: boolean =
    flags.showQaBadge
    || flags.showTrainBadge
    || flags.showTodoBadge
    || flags.showLinkBadge
    || flags.showAnchorBadge
    || flags.showAnchorRefChips
    || flags.showEvalBadge;
  const displayText: string = buildVisibleCommentText(token, flags);
  const hasDisplayText: boolean = displayText.trim().length > 0;
  const shouldRenderComment: boolean = shouldRenderCommentBlock(
    hasDisplayText,
    token.rawText.trim().length > 0,
    token.commentId,
    deps.pendingFocusCommentId,
    deps.consumedFocusCommentId,
  );
  return hasVisibleBadge || shouldRenderComment;
};

export const hasVisibleTokenInBlock = (block: { tokens: readonly PlanToken[] }, deps: TokenRenderDeps): boolean => {
  for (const token of block.tokens) {
    if (token.kind === "comment") {
      if (isCommentTokenVisible(token as CommentToken, deps)) return true;
      continue;
    }
    if (token.tokenType === "space") continue;
    return true;
  }
  return false;
};
