/**
 * useMoveEntry — React hook for board-driven move entry with fork detection.
 *
 * Handles the full move entry flow: promotion picker and disambiguation
 * (fork) dialog. Wires the pure-logic `resolveMoveEntry` and `pgn_move_ops`
 * operations into a React-friendly interface.
 *
 * Integration API:
 * - `const me = useMoveEntry()` — call in `AppShell` or a board wrapper.
 * - Pass `me.onMovePlayed` to `ChessBoard`.
 * - Render `<DisambiguationDialog>` when `me.pendingFork !== null`.
 * - Render `<PromotionPicker>` when `me.pendingPromotion !== null`.
 *
 * Communication API:
 * - `onMovePlayed(from, to)` — called by the board when a piece is dropped.
 * - `handleForkDecide(choice)` — called when the user picks a fork resolution.
 * - `handlePromotionPick(piece)` — called when the user picks a promotion piece.
 * - `handleCancel()` — cancel a pending fork or promotion.
 */

import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import type { AppStartupServices } from "../../../core/contracts/app_services";
import {
  selectBoardPreview,
  selectCurrentPly,
  selectMoves,
  selectSelectedMoveId,
  selectPgnModel,
  selectStartingFen,
} from "../../../core/state/selectors";
import { resolveMoveEntry } from "../../../model/move_entry_controller";
import {
  findCursorForMoveId,
  appendMove,
  insertVariation,
  replaceMove,
  promoteToMainline,
} from "../../../../../parts/pgnparser/src/pgn_move_ops";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import type { PgnCursor } from "../../../../../parts/pgnparser/src/pgn_move_ops";
import type { ForkChoice } from "../../../components/board/DisambiguationDialog";
import type { PromotionPiece } from "../../../components/board/PromotionPicker";
import type { ChessSoundType } from "../../../board/move_sound";
import { resolveMovePositionById } from "../../../board/move_position";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PendingFork = {
  san: string;
  existingNextSan: string;
  existingNextMoveId: string;
  model: PgnModel;
  cursor: PgnCursor;
};

export type PendingPromotion = {
  from: string;
  to: string;
  color: "w" | "b";
};

export type MoveEntryState = {
  pendingFork: PendingFork | null;
  pendingPromotion: PendingPromotion | null;
  onMovePlayed: (from: string, to: string) => void;
  handleForkDecide: (choice: ForkChoice) => void;
  handlePromotionPick: (piece: PromotionPiece) => void;
  handleCancel: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect if a pawn-to-back-rank move is a promotion. */
const isPromotionMove = (fen: string, from: string, to: string): boolean => {
  const chess = new Chess();
  try { chess.load(fen); } catch { return false; }
  const piece = chess.get(from as Parameters<typeof chess.get>[0]);
  if (piece?.type !== "p") return false;
  const toRank = to[1];
  return (piece.color === "w" && toRank === "8") ||
    (piece.color === "b" && toRank === "1");
};

/** Extract side-to-move from a FEN string. */
const fenSideToMove = (fen: string): "w" | "b" =>
  fen.split(" ")[1] === "b" ? "b" : "w";

/** Build a FEN by replaying `ply` mainline SAN moves from the starting position. */
const buildFen = (sanMoves: string[], ply: number, startFen?: string): string => {
  const game = startFen ? new Chess(startFen) : new Chess();
  const limit = Math.min(ply, sanMoves.length);
  for (let i = 0; i < limit; i++) game.move(sanMoves[i]);
  return game.fen();
};

/**
 * Resolve the canonical board FEN for move entry.
 *
 * Priority:
 * 1) `boardPreview.fen` (explicit variation/preview position).
 * 2) Position resolved from selected move ID in the PGN model.
 * 3) Mainline replay fallback from `moves/currentPly`.
 */
export const resolveMoveEntryFen = (
  model: PgnModel,
  selectedMoveId: string | null,
  boardPreviewFen: string | null,
  sanMoves: string[],
  currentPly: number,
  startFen?: string,
): string => {
  if (boardPreviewFen) return boardPreviewFen;
  if (selectedMoveId) {
    const resolved = resolveMovePositionById(model, selectedMoveId);
    if (resolved?.fen) return resolved.fen;
  }
  return buildFen(sanMoves, currentPly, startFen);
};

/** Resolve move sound kind for a concrete board move in `fen`. */
export const resolveMoveSoundTypeForBoardMove = (
  fen: string,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): ChessSoundType | null => {
  const game: Chess = new Chess();
  try {
    game.load(fen);
  } catch {
    return null;
  }
  const move = game.move({
    from,
    to,
    promotion: promotion ?? "q",
  });
  if (!move) return null;
  if (game.isCheckmate()) return "checkmate";
  if (game.isStalemate()) return "stalemate";
  if (game.isCheck()) return "check";
  if (/^O-O(?:-O)?/.test(move.san)) {
    return "castling";
  }
  if (move.san.includes("x")) {
    return "capture";
  }
  return "move";
};

/** Build a cursor from the current selected move ID (or root). */
const resolveMainlineMoveIdAtPly = (
  model: PgnModel,
  currentPly: number,
): string | null => {
  if (currentPly <= 0) return null;
  let moveCount: number = 0;
  for (const entry of model.root.entries) {
    if (entry.type !== "move") continue;
    moveCount += 1;
    if (moveCount === currentPly) return entry.id;
  }
  return null;
};

/** Build a cursor from selected move ID, with mainline-ply fallback. */
export const resolveMoveEntryCursor = (
  model: PgnModel,
  selectedMoveId: string | null,
  currentPly: number,
): PgnCursor => {
  const anchorMoveId: string | null = selectedMoveId ?? resolveMainlineMoveIdAtPly(model, currentPly);
  return anchorMoveId
    ? (findCursorForMoveId(model, anchorMoveId) ?? {
        moveId: null,
        variationId: model.root.id,
      })
    : { moveId: null, variationId: model.root.id };
};

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Board move entry hook: manages fork and promotion dialog state.
 *
 * @param servicesRef - Ref to the service callbacks.  Must be populated from `useAppStartup`
 *   in the host render before any user interaction; avoids a context read that would return
 *   the default noop services because `useMoveEntry` is called outside `ServiceContextProvider`.
 * @returns `MoveEntryState` with move callbacks, `pendingFork`, and `pendingPromotion`.
 */
export const useMoveEntry = (servicesRef: { current: AppStartupServices | null }): MoveEntryState => {
  const { state } = useAppContext();

  const currentPly = selectCurrentPly(state);
  const moves = selectMoves(state);
  const selectedMoveId = selectSelectedMoveId(state);
  const pgnModel = selectPgnModel(state);
  const startingFen = selectStartingFen(state);
  const boardPreview = selectBoardPreview(state);

  const [pendingFork, setPendingFork] = useState<PendingFork | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  /** Apply an op result to the model and navigate to the new cursor. */
  const commitOp = useCallback(
    (opResult: [PgnModel, PgnCursor | null]): void => {
      const [newModel, newCursor] = opResult;
      servicesRef.current?.applyPgnModelEdit(newModel, newCursor?.moveId ?? null);
    },
    [servicesRef],
  );

  /** Commit a move by choosing the right model op based on `choice`. */
  const commitMove = useCallback(
    (san: string, model: PgnModel, cursor: PgnCursor, choice: ForkChoice | "append"): void => {
      if (choice === "append") {
        commitOp(appendMove(model, cursor, san));
      } else if (choice === "replace") {
        commitOp(replaceMove(model, cursor, san));
      } else if (choice === "variation") {
        commitOp(insertVariation(model, cursor, san));
      } else {
        // promote: insert as variation then promote to mainline
        const [m2, c2] = insertVariation(model, cursor, san);
        commitOp(promoteToMainline(m2, c2));
      }
    },
    [commitOp],
  );

  /** Resolve a board move (after promotion is known) and commit or set fork. */
  const resolveAndCommit = useCallback(
    (
      from: string,
      to: string,
      promotion: PromotionPiece | undefined,
      model: PgnModel,
      cursor: PgnCursor,
      fen: string,
    ): void => {
      const resolution = resolveMoveEntry({
        boardMove: { from, to, promotion },
        currentFen: fen,
        model,
        cursor,
      });
      if (!resolution || resolution.kind === "illegal") return;

      switch (resolution.kind) {
        case "advance":
          {
            const soundType: ChessSoundType | null = resolveMoveSoundTypeForBoardMove(
              fen,
              from,
              to,
              promotion,
            );
            if (soundType) {
              servicesRef.current?.playMoveSound(soundType);
            }
          }
          servicesRef.current?.gotoMoveById(resolution.nextMoveId);
          break;
        case "enter_variation":
          {
            const soundType: ChessSoundType | null = resolveMoveSoundTypeForBoardMove(
              fen,
              from,
              to,
              promotion,
            );
            if (soundType) {
              servicesRef.current?.playMoveSound(soundType);
            }
          }
          servicesRef.current?.gotoMoveById(resolution.firstMoveId);
          break;
        case "append":
          {
            const soundType: ChessSoundType | null = resolveMoveSoundTypeForBoardMove(
              fen,
              from,
              to,
              promotion,
            );
            if (soundType) {
              servicesRef.current?.playMoveSound(soundType);
            }
          }
          commitMove(resolution.san, model, cursor, "append");
          break;
        case "fork":
          setPendingFork({
            san: resolution.san,
            existingNextSan: resolution.existingNextSan,
            existingNextMoveId: resolution.existingNextMoveId,
            model,
            cursor,
          });
          break;
      }
    },
    [servicesRef, commitMove],
  );

  const onMovePlayed = useCallback(
    (from: string, to: string): void => {
      const model = pgnModel;
      if (!model) return;

      const fen = resolveMoveEntryFen(
        model,
        selectedMoveId,
        boardPreview?.fen ?? null,
        moves,
        currentPly,
        startingFen || undefined,
      );
      const color = fenSideToMove(fen);
      const cursor = resolveMoveEntryCursor(model, selectedMoveId, currentPly);

      if (isPromotionMove(fen, from, to)) {
        setPendingPromotion({ from, to, color });
        return;
      }

      resolveAndCommit(from, to, undefined, model, cursor, fen);
    },
    [pgnModel, moves, currentPly, selectedMoveId, startingFen, boardPreview, resolveAndCommit],
  );

  const handleForkDecide = useCallback(
    (choice: ForkChoice): void => {
      const fork = pendingFork;
      if (!fork) return;
      setPendingFork(null);
      if (choice === "variation") {
        // Attach the RAV to the existing next move so it appears after it in PGN,
        // not to the preceding move which would mis-label it as the wrong side.
        const nextCursor = findCursorForMoveId(fork.model, fork.existingNextMoveId) ?? fork.cursor;
        commitMove(fork.san, fork.model, nextCursor, choice);
      } else {
        commitMove(fork.san, fork.model, fork.cursor, choice);
      }
    },
    [pendingFork, commitMove],
  );

  const handlePromotionPick = useCallback(
    (piece: PromotionPiece): void => {
      const promo = pendingPromotion;
      if (!promo || !pgnModel) { setPendingPromotion(null); return; }
      setPendingPromotion(null);

      const fen = resolveMoveEntryFen(
        pgnModel,
        selectedMoveId,
        boardPreview?.fen ?? null,
        moves,
        currentPly,
        startingFen || undefined,
      );
      const cursor = resolveMoveEntryCursor(pgnModel, selectedMoveId, currentPly);
      resolveAndCommit(promo.from, promo.to, piece, pgnModel, cursor, fen);
    },
    [pendingPromotion, pgnModel, moves, currentPly, selectedMoveId, startingFen, boardPreview, resolveAndCommit],
  );

  const handleCancel = useCallback((): void => {
    setPendingFork(null);
    setPendingPromotion(null);
  }, []);

  return {
    pendingFork,
    pendingPromotion,
    onMovePlayed,
    handleForkDecide,
    handlePromotionPick,
    handleCancel,
  };
};
