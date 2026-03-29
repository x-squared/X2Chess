/**
 * MoveOutcomeHint — brief overlay shown after a wrong move attempt.
 *
 * Integration API:
 * - `<MoveOutcomeHint feedback={...} correctMoveSan={...} allowRetry={...}
 *     onRetry={...} onSkip={...} t={...} />`
 *   Mount when `feedback === "wrong"`; unmount after retry or skip.
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onRetry()` — user wants to try again (board resets to before the move).
 * - `onSkip()` — user gives up on this move.
 */

import { useEffect, type ReactElement } from "react";
import type { MoveEvalFeedback } from "../domain/training_protocol";

type MoveOutcomeHintProps = {
  feedback: MoveEvalFeedback | null;
  /** SAN of the correct move (shown when feedback = "wrong"). */
  correctMoveSan: string | null;
  allowRetry: boolean;
  t: (key: string, fallback?: string) => string;
  onRetry: () => void;
  onSkip: () => void;
  /** Called after `autoAdvanceMs` when not retrying (optional auto-skip). */
  onAutoAdvance?: () => void;
  autoAdvanceMs?: number;
};

/**
 * Small overlay shown after a wrong move. Displays the correct move and
 * offers "Try again" / "Skip" buttons. Optionally auto-advances after a delay.
 */
export const MoveOutcomeHint = ({
  feedback,
  correctMoveSan,
  allowRetry,
  t,
  onRetry,
  onSkip,
  onAutoAdvance,
  autoAdvanceMs,
}: MoveOutcomeHintProps): ReactElement | null => {
  useEffect((): (() => void) => {
    if (feedback !== "wrong" || allowRetry || !onAutoAdvance || !autoAdvanceMs) {
      return (): void => undefined;
    }
    const id = window.setTimeout(onAutoAdvance, autoAdvanceMs);
    return (): void => { window.clearTimeout(id); };
  }, [feedback, allowRetry, onAutoAdvance, autoAdvanceMs]);

  if (feedback === "correct" || feedback === "legal_variant") {
    return (
      <div className="move-outcome-hint move-outcome-hint--correct" role="status">
        <span className="move-outcome-hint-icon">✓</span>
        <span className="move-outcome-hint-text">
          {t("training.outcome.correct", "Correct!")}
        </span>
      </div>
    );
  }

  if (feedback === "wrong") {
    return (
      <div className="move-outcome-hint move-outcome-hint--wrong" role="status">
        <span className="move-outcome-hint-icon">✗</span>
        <span className="move-outcome-hint-text">
          {correctMoveSan
            ? `${t("training.outcome.missed", "Missed:")} ${correctMoveSan} ${t("training.outcome.wasBest", "was best")}`
            : t("training.outcome.wrong", "Not the best move")}
        </span>
        <div className="move-outcome-hint-actions">
          {allowRetry && (
            <button
              type="button"
              className="move-outcome-hint-btn"
              onClick={onRetry}
            >
              {t("training.outcome.retry", "Try again")}
            </button>
          )}
          <button
            type="button"
            className="move-outcome-hint-btn"
            onClick={onSkip}
          >
            {t("training.outcome.skip", "Skip")}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
