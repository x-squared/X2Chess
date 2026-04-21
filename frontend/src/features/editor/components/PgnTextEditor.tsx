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
 *
 * Configuration API:
 * - No props required.  All data flows through `AppStoreState` context.
 *
 * Communication API:
 * - Outbound: calls `services.gotoMoveById(id)` on move click.
 * - Inbound: re-renders when `pgnModel`, `pgnLayoutMode`, or `selectedMoveId` change.
 * - Comment saves and insert-comment actions are wired to `useServiceContext()`
 *   callbacks (`insertComment`, `saveCommentText`, `gotoMoveById`).
 * - Game-link chips (`[%link ...]`) rendered via `LinkBadge`; insertion via
 *   `GamePickerDialog`; navigation via `services.openGameFromRecordId`.
 */

import { useMemo, useEffect, useCallback, useState } from "react";
import type { ReactElement, CSSProperties } from "react";
import { buildTextEditorPlan } from "../model/text_editor_plan";
import type { PlanBlock, InlineToken, CommentToken } from "../model/text_editor_plan";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import {
  selectPgnModel,
  selectLayoutMode,
  selectSelectedMoveId,
  selectPendingFocusCommentId,
  selectPositionPreviewOnHover,
  selectShowEvalPills,
  selectEditorStylePrefs,
} from "../../../core/state/selectors";
import { editorStyleToCssVars } from "../../../runtime/editor_style_prefs";
import { useHoverPreview } from "../../../components/board/HoverPreviewContext";
import { resolveMovePositionById } from "../../../board/move_position";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import { useTranslator } from "../../../app/hooks/useTranslator";
import { findExistingCommentIdAroundMove } from "../../../model";
import {
  appendMove,
  truncateAfter,
  deleteSingleMove,
  truncateBefore,
  deleteVariation,
  deleteVariationsAfter,
  promoteToMainline,
  findCursorForMoveId,
  findMoveNode,
  findMoveSideById,
} from "../../../../../parts/pgnparser/src/pgn_move_ops";
import { TruncationMenu } from "./TruncationMenu";
import type { TruncationAction } from "./TruncationMenu";
import { QaInsertDialog } from "../../../components/badges/QaBadge";
import { useQaDialog } from "../hooks/useQaDialog";
import { TrainInsertDialog } from "../../../components/badges/TrainBadge";
import { useTrainDialog } from "../hooks/useTrainDialog";
import { TodoInsertDialog, TodoPanel } from "../../../components/badges/TodoBadge";
import type { TodoPanelItem } from "../../../components/badges/TodoBadge";
import { parseTodoAnnotations, hasTodoAnnotations } from "../../resources/services/todo_parser";
import { useTodoDialog } from "../hooks/useTodoDialog";
import { useLinkDialog } from "../hooks/useLinkDialog";
import { GamePickerDialog } from "../../../components/dialogs/GamePickerDialog";
import { useAnchorDefDialog } from "../hooks/useAnchorDefDialog";
import { useAnchorRefDialog } from "../hooks/useAnchorRefDialog";
import { resolveAnchors } from "../model/resolveAnchors";
import { hasEvalAnnotations, stripEvalAnnotations, replaceEvalAnnotation } from "../../resources/services/eval_parser";
import type { ResolvedAnchor } from "../model/resolveAnchors";
import { AnchorDefDialog } from "../../../components/anchors/AnchorDefDialog";
import { AnchorPickerDialog } from "../../../components/anchors/AnchorPickerDialog";
import { UI_IDS } from "../../../core/model/ui_ids";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import { log } from "../../../logger";
import { LinearModeView, TreeModeView, buildLastSiblingByParent } from "./PgnEditorModeViews";
import { TRAILING_VARIATION_BREAK_SENTINEL } from "../model/plan/text_mode";

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
  const showEvalPills: boolean = selectShowEvalPills(state);
  const editorStylePrefs = selectEditorStylePrefs(state);
  const editorStyleVars = editorStyleToCssVars(editorStylePrefs);
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
    currentNags: readonly string[];
    moveSide: "white" | "black";
  };
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleMoveContextMenu = useCallback(
    (moveId: string, san: string, isInVariation: boolean, rect: DOMRect): void => {
      window.getSelection()?.removeAllRanges();
      const nags = pgnModel ? (findMoveNode(pgnModel as PgnModel, moveId)?.nags ?? []) : [];
      const side = pgnModel ? (findMoveSideById(pgnModel as PgnModel, moveId) ?? "white") : "white";
      setContextMenu({ moveId, san, isInVariation, anchorRect: rect, currentNags: nags, moveSide: side });
    },
    [pgnModel],
  );

  // ── Q/A dialog state (UV10/UV11) ─────────────────────────────────────────────
  const { qaDialog, handleEditQa, handleInsertQa, handleQaDialogSave, handleQaDialogClose, handleDeleteQa } = useQaDialog(services);

  // ── Train tag dialog state ────────────────────────────────────────────────────
  const { trainDialog, handleEditTrain, handleInsertTrain, handleTrainDialogSave, handleTrainDialogClose, handleDeleteTrain } = useTrainDialog(services);

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

  // ── Anchor definition dialog state ───────────────────────────────────────────
  const {
    anchorDefDialog,
    handleOpenAnchorDefDialog,
    handleEditAnchorDef,
    handleConfirmAnchorDef,
    handleDeleteAnchorDef,
    handleCloseAnchorDefDialog,
  } = useAnchorDefDialog(services);

  // ── Anchor reference picker dialog state ─────────────────────────────────────
  const {
    anchorRefDialog,
    handleOpenAnchorRefDialog,
    handleEditAnchorRef,
    handleConfirmAnchorRef,
    handleDeleteAnchorRef,
    handleCloseAnchorRefDialog,
  } = useAnchorRefDialog(services);

  const handleOpenLinkedGame = useCallback(
    (recordId: string): void => {
      void services.openGameFromRecordId(recordId);
    },
    [services],
  );

  /** Recompute the token plan when model, layout mode, or break policy changes. */
  const blocks: PlanBlock[] = useMemo(
    (): PlanBlock[] => buildTextEditorPlan(pgnModel, {
      layoutMode,
      commentLineBreakPolicy: editorStylePrefs.commentLineBreakPolicy,
    }),
    [pgnModel, layoutMode, editorStylePrefs.commentLineBreakPolicy],
  );

  // ── Eval annotation handlers ──────────────────────────────────────────────────

  const handleDeleteEval = useCallback(
    (commentId: string, index: number, rawText: string): void => {
      const updated: string = replaceEvalAnnotation(rawText, index, null);
      services.saveCommentText(commentId, updated);
    },
    [services],
  );

  const handleDeleteAllEvals = useCallback((): void => {
    if (!blocks) return;
    for (const block of blocks) {
      for (const token of block.tokens) {
        if (token.kind !== "comment") continue;
        const ct: CommentToken = token as CommentToken;
        if (!hasEvalAnnotations(ct.rawText)) continue;
        const stripped: string = stripEvalAnnotations(ct.rawText);
        services.saveCommentText(ct.commentId, stripped);
      }
    }
  }, [blocks, services]);

  const handleToggle = useCallback((key: string): void => {
    setCollapsedPaths((prev: ReadonlySet<string>): ReadonlySet<string> => {
      const next: Set<string> = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** Collect all anchor definitions from the current model for use in dialogs and chips. */
  const resolvedAnchors: ResolvedAnchor[] = useMemo(
    (): ResolvedAnchor[] => (pgnModel ? resolveAnchors(pgnModel) : []),
    [pgnModel],
  );
  const resolvedAnchorsMap: ReadonlyMap<string, ResolvedAnchor> = useMemo(
    (): ReadonlyMap<string, ResolvedAnchor> =>
      new Map(resolvedAnchors.map((a) => [a.id, a])),
    [resolvedAnchors],
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
      try {
        services.gotoMoveById(moveId);
        // If an after-comment exists for this move, focus it for editing.
        services.focusCommentAroundMove(moveId, "after");
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        log.error("PgnTextEditor", `handleMoveClick failed: moveId=${moveId} err="${message}"`);
      }
    },
    [services],
  );

  const handleMoveHover = useCallback(
    (moveId: string, rect: DOMRect): void => {
      if (!positionPreviewOnHover || !pgnModel) return;
      const resolved = resolveMovePositionById(pgnModel, moveId);
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
      const existingBeforeInsert: string | null = pgnModel
        ? findExistingCommentIdAroundMove(pgnModel, moveId, position)
        : null;
      const comment = services.insertComment(moveId, position);
      if (!comment) return;
      // Re-arm autofocus only for the exact repeated-target case:
      // the comment already existed and this same id was already consumed.
      if (
        existingBeforeInsert === comment.id &&
        consumedFocusCommentId === comment.id
      ) {
        setConsumedFocusCommentId(null);
      }
    },
    [services, pgnModel, consumedFocusCommentId],
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
        case "insert_null_move_after":
          break;
        case "insert_qa":
          handleInsertQa(action.moveId);
          return;
        case "insert_train":
          handleInsertTrain(action.moveId);
          return;
        case "insert_todo":
          handleInsertTodo(action.moveId);
          return;
        case "insert_link":
          handleInsertLink(action.moveId);
          return;
        case "insert_anchor":
          handleOpenAnchorDefDialog(action.moveId, action.san);
          return;
        case "toggle_nag":
          services.toggleMoveNag(action.moveId, action.nag);
          return;
        default:
          break;
      }
      if (!pgnModel) return;
      const cursor = findCursorForMoveId(pgnModel, action.moveId);
      if (!cursor) return;
      let newModel: import("../../../../../parts/pgnparser/src/pgn_model").PgnModel;
      let newCursor: import("../../../../../parts/pgnparser/src/pgn_move_ops").PgnCursor | null;
      switch (action.type) {
        case "insert_null_move_after":
          [newModel, newCursor] = appendMove(pgnModel, cursor, "--");
          break;
        case "delete_from_here":
          [newModel, newCursor] = truncateAfter(pgnModel, cursor);
          break;
        case "delete_null_move":
          [newModel, newCursor] = deleteSingleMove(pgnModel, action.moveId);
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
    [pgnModel, services, handleInsertComment, handleInsertQa, handleInsertTodo, handleInsertLink, handleOpenAnchorDefDialog],
  );

  const handleCommentEditStart = useCallback(
    (_commentId: string): void => {
      services.recordHistorySnapshot();
    },
    [services],
  );

  const handleCommentEdit = useCallback(
    (commentId: string, newText: string): void => {
      // Normalize any raw newlines (from Enter, paste, etc.) to [[br]] markers
      // so the canonical PGN comment always uses the [[br]] convention.
      const withCanonicalTrailingVariationBreak: string = newText.replaceAll(
        TRAILING_VARIATION_BREAK_SENTINEL,
        "[[br]]",
      );
      services.saveCommentText(commentId, withCanonicalTrailingVariationBreak.replaceAll("\n", "[[br]]"));
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
      <div className="text-editor text-editor-empty" style={editorStyleVars as CSSProperties}>
        <p className="text-editor-hint">
          {t("editor.hint", "Open a PGN game to start annotating.")}
        </p>
      </div>
    );
  }

  return (
      <div
        className="text-editor"
        data-ui-id={UI_IDS.EDITOR_PGN_TEXT}
        data-layout-mode={layoutMode}
        data-comment-linebreak-policy={editorStylePrefs.commentLineBreakPolicy}
        style={editorStyleVars as CSSProperties}
      >
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
            onCommentEditStart: handleCommentEditStart,
            onCommentFocusHandled: handleCommentFocusHandled,
            onEditQa: handleEditQa,
            onDeleteQa: handleDeleteQa,
            onEditTrain: handleEditTrain,
            onDeleteTrain: handleDeleteTrain,
            onEditTodo: handleEditTodo,
            onDeleteTodo: handleDeleteTodo,
            onEditLink: handleEditLink,
            onDeleteLink: handleDeleteLink,
            onOpenLinkedGame: handleOpenLinkedGame,
            onFetchLinkMetadata: services.fetchGameMetadataByRecordId,
            onEditAnchorDef: handleEditAnchorDef,
            onDeleteAnchorDef: handleDeleteAnchorDef,
            onEditAnchorRef: handleEditAnchorRef,
            onDeleteAnchorRef: handleDeleteAnchorRef,
            resolvedAnchorsMap,
            showEvalPills,
            onDeleteEval: handleDeleteEval,
            onDeleteAllEvals: handleDeleteAllEvals,
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
            onCommentEditStart: handleCommentEditStart,
            onCommentFocusHandled: handleCommentFocusHandled,
            onEditQa: handleEditQa,
            onDeleteQa: handleDeleteQa,
            onEditTrain: handleEditTrain,
            onDeleteTrain: handleDeleteTrain,
            onEditTodo: handleEditTodo,
            onDeleteTodo: handleDeleteTodo,
            onEditLink: handleEditLink,
            onDeleteLink: handleDeleteLink,
            onOpenLinkedGame: handleOpenLinkedGame,
            onFetchLinkMetadata: services.fetchGameMetadataByRecordId,
            onEditAnchorDef: handleEditAnchorDef,
            onDeleteAnchorDef: handleDeleteAnchorDef,
            onEditAnchorRef: handleEditAnchorRef,
            onDeleteAnchorRef: handleDeleteAnchorRef,
            resolvedAnchorsMap,
            showEvalPills,
            onDeleteEval: handleDeleteEval,
            onDeleteAllEvals: handleDeleteAllEvals,
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
      {trainDialog !== null && (
        <TrainInsertDialog
          initial={trainDialog.initial}
          t={t}
          onSave={handleTrainDialogSave}
          onClose={handleTrainDialogClose}
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
      {anchorDefDialog !== null && (
        <AnchorDefDialog
          state={anchorDefDialog}
          allAnchors={resolvedAnchors}
          onConfirm={handleConfirmAnchorDef}
          onCancel={handleCloseAnchorDefDialog}
          t={t}
        />
      )}
      {anchorRefDialog !== null && (
        <AnchorPickerDialog
          allAnchors={resolvedAnchors}
          currentId={anchorRefDialog.currentId}
          onSelect={handleConfirmAnchorRef}
          onCancel={handleCloseAnchorRefDialog}
          t={t}
        />
      )}
      {contextMenu !== null && (
        <TruncationMenu
          moveId={contextMenu.moveId}
          san={contextMenu.san}
          isInVariation={contextMenu.isInVariation}
          anchorRect={contextMenu.anchorRect}
          currentNags={contextMenu.currentNags}
          moveSide={contextMenu.moveSide}
          t={t}
          onAction={handleTruncationAction}
          onClose={(): void => { setContextMenu(null); }}
        />
      )}
      </div>
  );
};
