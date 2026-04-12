import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import type { TrainingSessionControls } from "../../../training/hooks/useTrainingSession";
import type { MergeSelection } from "../../../training/domain/training_transcript";
import type { Task } from "../../../training/curriculum/curriculum_plan";
import type { PromotionPiece } from "../../../components/board/PromotionPicker";
import type { AppStartupServices } from "../../../core/contracts/app_services";
import type { AppStoreState } from "../../../core/state/app_reducer";
import { selectPgnModel } from "../../../core/state/selectors";
import { applyMergeToModel, mergeToNewPgn } from "../../../training/merge_transcript";

export type TrainingDialogControls = {
  showTrainingLauncher: boolean;
  showTrainingHistory: boolean;
  showCurriculumPanel: boolean;
  setShowTrainingLauncher: (v: boolean) => void;
  setShowTrainingHistory: (v: boolean) => void;
  setShowCurriculumPanel: (v: boolean) => void;
  pendingTrainingPromotion: { from: string; to: string } | null;
  setPendingTrainingPromotion: (v: { from: string; to: string } | null) => void;
  handleTrainingMovePlayed: (from: string, to: string) => void;
  handleTrainingPromotionPick: (piece: PromotionPiece) => void;
  handleMergeResult: (selection: MergeSelection) => void;
  handleLaunchTaskFromCurriculum: (task: Task) => void;
};

/**
 * Manages visibility state and callbacks for training-related dialogs:
 * TrainingLauncher, TrainingHistoryPanel, CurriculumPanel, and the training
 * promotion picker.
 *
 * Board-preview syncing and hint handling remain in AppShell because they
 * touch `dispatch` and engine state.
 *
 * @param trainingControls Live training session controls from `useTrainingSession`.
 * @param rawServices App services used to apply merge results to the active session.
 * @param getState Synchronous accessor for the latest `AppStoreState`.
 * @returns Dialog visibility flags, event handlers, and pending-promotion state.
 */
export const useTrainingDialogState = (
  trainingControls: TrainingSessionControls,
  rawServices: AppStartupServices,
  getState: () => AppStoreState,
): TrainingDialogControls => {
  const [showTrainingLauncher, setShowTrainingLauncher] = useState(false);
  const [showTrainingHistory, setShowTrainingHistory] = useState(false);
  const [showCurriculumPanel, setShowCurriculumPanel] = useState(false);
  const [pendingTrainingPromotion, setPendingTrainingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const handleTrainingMovePlayed = useCallback(
    (from: string, to: string): void => {
      const fen = trainingControls.sessionState?.position.fen;
      if (!fen) return;
      const chess = new Chess();
      try { chess.load(fen); } catch { return; }
      const piece = chess.get(from as Parameters<typeof chess.get>[0]);
      const toRank = to[1];
      const isPromotion =
        piece?.type === "p" &&
        ((piece.color === "w" && toRank === "8") ||
          (piece.color === "b" && toRank === "1"));
      if (isPromotion) {
        setPendingTrainingPromotion({ from, to });
        return;
      }
      const result = chess.move({ from, to });
      if (!result) return;
      trainingControls.submitMove({ uci: from + to, san: result.san, timestamp: Date.now() });
    },
    [trainingControls],
  );

  const handleTrainingPromotionPick = useCallback(
    (piece: PromotionPiece): void => {
      const promo = pendingTrainingPromotion;
      if (!promo) { setPendingTrainingPromotion(null); return; }
      const fen = trainingControls.sessionState?.position.fen;
      if (!fen) { setPendingTrainingPromotion(null); return; }
      setPendingTrainingPromotion(null);
      const chess = new Chess();
      try { chess.load(fen); } catch { return; }
      const result = chess.move({ from: promo.from, to: promo.to, promotion: piece });
      if (!result) return;
      trainingControls.submitMove({
        uci: promo.from + promo.to + piece,
        san: result.san,
        timestamp: Date.now(),
      });
    },
    [pendingTrainingPromotion, trainingControls],
  );

  const handleMergeResult = useCallback(
    (selection: MergeSelection): void => {
      const model = selectPgnModel(getState());
      if (selection.mergeTarget === "source_game" && model) {
        const updated = applyMergeToModel(model, selection);
        rawServices.applyPgnModelEdit(updated, null);
      } else if (selection.mergeTarget === "new_variation" && model) {
        const pgn = mergeToNewPgn(model, selection);
        rawServices.openPgnText(pgn);
      }
      trainingControls.confirmResult();
    },
    [trainingControls, getState, rawServices],
  );

  const handleLaunchTaskFromCurriculum = useCallback(
    (task: Task): void => {
      if (task.ref) {
        rawServices.openGameFromRef(task.ref);
      }
      setShowCurriculumPanel(false);
      setShowTrainingLauncher(true);
    },
    [rawServices],
  );

  return {
    showTrainingLauncher,
    showTrainingHistory,
    showCurriculumPanel,
    setShowTrainingLauncher,
    setShowTrainingHistory,
    setShowCurriculumPanel,
    pendingTrainingPromotion,
    setPendingTrainingPromotion,
    handleTrainingMovePlayed,
    handleTrainingPromotionPick,
    handleMergeResult,
    handleLaunchTaskFromCurriculum,
  };
};
