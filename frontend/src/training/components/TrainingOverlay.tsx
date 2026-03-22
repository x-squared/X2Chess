/**
 * TrainingOverlay — in-session banner showing protocol label, progress, and controls.
 *
 * Integration API:
 * - `<TrainingOverlay sessionState={...} onSkip={...} onHint={...} onAbort={...} t={...} />`
 *   Mount above the board when training phase is "in_progress".
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - Action callbacks: `onSkip`, `onHint`, `onAbort`.
 */

import type { ReactElement } from "react";
import type { TrainingSessionState } from "../domain/training_protocol";

type TrainingOverlayProps = {
  sessionState: TrainingSessionState;
  /** True when no hints remain. */
  hintsExhausted: boolean;
  t: (key: string, fallback?: string) => string;
  onSkip: () => void;
  onHint: () => void;
  onAbort: () => void;
};

/**
 * Sticky banner displayed during an active training session.
 * Shows: protocol label, side, current move / total, score, and action buttons.
 */
export const TrainingOverlay = ({
  sessionState,
  hintsExhausted,
  t,
  onSkip,
  onHint,
  onAbort,
}: TrainingOverlayProps): ReactElement => {
  const opts = sessionState.config.protocolOptions as {
    side?: string;
    allowHints?: boolean;
    maxHintsPerGame?: number;
  };

  const scored =
    sessionState.correctCount + sessionState.wrongCount;
  const total = sessionState.position.totalUserPlies;
  const hintsLeft =
    (opts.maxHintsPerGame ?? 3) - sessionState.hintsUsed;
  const showHintBtn = opts.allowHints !== false && !hintsExhausted;

  return (
    <div className="training-overlay" role="status" aria-live="polite">
      <div className="training-overlay-info">
        <span className="training-overlay-protocol">
          {t("training.overlay.protocol", "Replay")}
          {opts.side ? ` — ${opts.side}` : ""}
        </span>
        <span className="training-overlay-progress">
          {t("training.overlay.move", "Move")}{" "}
          {sessionState.currentSourcePly + 1}{" "}
          /{" "}
          {total > 0 ? total : "?"}
        </span>
        <span className="training-overlay-score">
          {t("training.overlay.score", "Score:")} {sessionState.correctCount}/{scored}
        </span>
      </div>

      <div className="training-overlay-actions">
        {showHintBtn && (
          <button
            type="button"
            className="training-overlay-btn training-overlay-btn--hint"
            disabled={sessionState.hintUsedThisMove || hintsLeft <= 0}
            onClick={onHint}
          >
            {t("training.overlay.hint", "Hint")}
            {opts.maxHintsPerGame !== 0 && ` (${hintsLeft})`}
          </button>
        )}

        <button
          type="button"
          className="training-overlay-btn training-overlay-btn--skip"
          onClick={onSkip}
        >
          {t("training.overlay.skip", "Skip")}
        </button>

        <button
          type="button"
          className="training-overlay-btn training-overlay-btn--abort"
          onClick={onAbort}
        >
          {t("training.overlay.abort", "Abort")}
        </button>
      </div>
    </div>
  );
};
