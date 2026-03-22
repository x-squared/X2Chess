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
import { useAppContext } from "../state/app_context";
import { useServiceContext } from "../state/ServiceContext";
import {
  selectCurrentPly,
  selectMoves,
  selectSelectedMoveId,
  selectPgnModel,
} from "../state/selectors";
import { resolveMoveEntry } from "../model/move_entry_controller";
import {
  findCursorForMoveId,
  appendMove,
  insertVariation,
  replaceMove,
  promoteToMainline,
} from "../model/pgn_move_ops";
import type { PgnModel } from "../model/pgn_model";
import type { PgnCursor } from "../model/pgn_move_ops";
import type { ForkChoice } from "../components/DisambiguationDialog";
import type { PromotionPiece } from "../components/PromotionPicker";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PendingFork = {
  san: string;
  existingNextSan: string;
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
  if (!piece || piece.type !== "p") return false;
  const toRank = to[1];
  return (piece.color === "w" && toRank === "8") ||
    (piece.color === "b" && toRank === "1");
};

/** Extract side-to-move from a FEN string. */
const fenSideToMove = (fen: string): "w" | "b" =>
  fen.split(" ")[1] === "b" ? "b" : "w";

/** Build a FEN by replaying `ply` mainline SAN moves from the initial position. */
const buildFen = (sanMoves: string[], ply: number): string => {
  const game = new Chess();
  const limit = Math.min(ply, sanMoves.length);
  for (let i = 0; i < limit; i++) game.move(sanMoves[i]);
  return game.fen();
};

/** Build a cursor from the current selected move ID (or root). */
const buildCursor = (model: PgnModel, selectedMoveId: string | null): PgnCursor =>
  selectedMoveId
    ? (findCursorForMoveId(model, selectedMoveId) ?? {
        moveId: null,
        variationId: model.root.id,
      })
    : { moveId: null, variationId: model.root.id };

// ── Hook ───────────────────────────────────────────────────────────────────────

/** Board move entry hook: manages fork and promotion dialog state. */
export const useMoveEntry = (): MoveEntryState => {
  const { state } = useAppContext();
  const services = useServiceContext();

  const currentPly = selectCurrentPly(state);
  const moves = selectMoves(state);
  const selectedMoveId = selectSelectedMoveId(state);
  const pgnModel = selectPgnModel(state);

  const [pendingFork, setPendingFork] = useState<PendingFork | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  /** Apply an op result to the model and navigate to the new cursor. */
  const commitOp = useCallback(
    (opResult: [PgnModel, PgnCursor | null]): void => {
      const [newModel, newCursor] = opResult;
      services.applyPgnModelEdit(newModel, newCursor?.moveId ?? null);
    },
    [services],
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
          services.gotoMoveById(resolution.nextMoveId);
          break;
        case "enter_variation":
          services.gotoMoveById(resolution.firstMoveId);
          break;
        case "append":
          commitMove(resolution.san, model, cursor, "append");
          break;
        case "fork":
          setPendingFork({
            san: resolution.san,
            existingNextSan: resolution.existingNextSan,
            model,
            cursor,
          });
          break;
      }
    },
    [services, commitMove],
  );

  const onMovePlayed = useCallback(
    (from: string, to: string): void => {
      const model = pgnModel;
      if (!model) return;

      const fen = buildFen(moves, currentPly);
      const color = fenSideToMove(fen);
      const cursor = buildCursor(model, selectedMoveId);

      if (isPromotionMove(fen, from, to)) {
        setPendingPromotion({ from, to, color });
        return;
      }

      resolveAndCommit(from, to, undefined, model, cursor, fen);
    },
    [pgnModel, moves, currentPly, selectedMoveId, resolveAndCommit],
  );

  const handleForkDecide = useCallback(
    (choice: ForkChoice): void => {
      const fork = pendingFork;
      if (!fork) return;
      setPendingFork(null);
      commitMove(fork.san, fork.model, fork.cursor, choice);
    },
    [pendingFork, commitMove],
  );

  const handlePromotionPick = useCallback(
    (piece: PromotionPiece): void => {
      const promo = pendingPromotion;
      if (!promo || !pgnModel) { setPendingPromotion(null); return; }
      setPendingPromotion(null);

      const fen = buildFen(moves, currentPly);
      const cursor = buildCursor(pgnModel, selectedMoveId);
      resolveAndCommit(promo.from, promo.to, piece, pgnModel, cursor, fen);
    },
    [pendingPromotion, pgnModel, moves, currentPly, selectedMoveId, resolveAndCommit],
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
