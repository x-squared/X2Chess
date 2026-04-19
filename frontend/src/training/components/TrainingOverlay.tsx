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

import type { ReactElement, ChangeEvent } from "react";
import type { TrainingSessionState } from "../domain/training_protocol";

type TrainingOverlayProps = {
  sessionState: TrainingSessionState;
  /** True when no hints remain. */
  hintsExhausted: boolean;
  /** Whether the board is currently shown from Black's perspective. */
  boardFlipped: boolean;
  /** Current board scale (50–100). */
  boardScale: number;
  t: (key: string, fallback?: string) => string;
  onSkip: () => void;
  onHint: () => void;
  onFlip: () => void;
  onBoardScale: (scale: number) => void;
  onPause: () => void;
  onAbort: () => void;
};

/**
 * Sticky banner displayed during an active training session.
 * Shows: protocol label, side, current move / total, score, and action buttons.
 */
export const TrainingOverlay = ({
  sessionState,
  hintsExhausted,
  boardFlipped,
  boardScale,
  t,
  onSkip,
  onHint,
  onFlip,
  onBoardScale,
  onPause,
  onAbort,
}: TrainingOverlayProps): ReactElement => {
  const opts = sessionState.config.protocolOptions as {
    side?: string;
    allowHints?: boolean;
    maxHintsPerGame?: number;
  };

  const movesPlayed =
    sessionState.correctCount + sessionState.wrongCount + sessionState.skippedCount;
  const scored =
    sessionState.correctCount + sessionState.wrongCount;
  const total = sessionState.position.totalUserPlies;
  const hintsLeft =
    (opts.maxHintsPerGame ?? 3) - sessionState.hintsUsed;
  const showHintBtn = opts.allowHints !== false && !hintsExhausted;

  const protocolLabel: string = (() => {
    switch (sessionState.config.protocol) {
      case "opening": return t("training.overlay.protocol.opening", "Opening");
      case "find_move": return t("training.overlay.protocol.find_move", "Find the Move");
      default: return t("training.overlay.protocol.replay", "Replay");
    }
  })();

  return (
    <div className="training-overlay" role="status" aria-live="polite">
      <div className="training-overlay-info">
        <span className="training-overlay-protocol">
          {protocolLabel}
          {opts.side ? ` — ${opts.side}` : ""}
        </span>
        <span className="training-overlay-progress">
          {t("training.overlay.move", "Move")}{" "}
          {movesPlayed + 1}{" "}
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
          className="training-overlay-btn training-overlay-btn--flip"
          title={t("training.overlay.flipTitle", "Flip board")}
          onClick={onFlip}
        >
          {boardFlipped
            ? t("training.overlay.flipWhite", "⇅ White")
            : t("training.overlay.flipBlack", "⇅ Black")}
        </button>

        <label
          className="training-overlay-scale"
          aria-label={t("training.overlay.scaleTitle", "Board size")}
        >
          <input
            type="range"
            className="training-overlay-scale-slider"
            min={50}
            max={100}
            step={5}
            value={boardScale}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              onBoardScale(Number(e.target.value));
            }}
          />
        </label>

        <button
          type="button"
          className="training-overlay-btn training-overlay-btn--skip"
          onClick={onSkip}
        >
          {t("training.overlay.skip", "Skip")}
        </button>

        <button
          type="button"
          className="training-overlay-btn training-overlay-btn--pause"
          onClick={onPause}
        >
          {t("training.overlay.pause", "Pause")}
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
