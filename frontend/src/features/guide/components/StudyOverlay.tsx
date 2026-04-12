/**
 * StudyOverlay — in-game Q/A prompt overlay for study mode.
 *
 * Integration API:
 * - `<StudyOverlay item={...} itemIndex={...} totalItems={...}
 *     t={...} onNext={...} onStop={...} />`
 *   Mount above the board while a study session is active.
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onNext()` — advance to the next Q/A item (or end if last).
 * - `onStop()` — abort the study session.
 */

import { useState, useCallback, useEffect, type ReactElement } from "react";
import type { StudyItem } from "../../../model/study_items";

type StudyOverlayProps = {
  item: StudyItem;
  /** 0-based index of the current item. */
  itemIndex: number;
  /** Total number of Q/A items in this session. */
  totalItems: number;
  /** 0-based annotation index within the current item. */
  annotationIndex: number;
  t: (key: string, fallback?: string) => string;
  onNext: () => void;
  onStop: () => void;
};

/**
 * Overlay banner showing the current Q/A prompt with hint and answer reveal.
 */
export const StudyOverlay = ({
  item,
  itemIndex,
  totalItems,
  annotationIndex,
  t,
  onNext,
  onStop,
}: StudyOverlayProps): ReactElement => {
  const annotation = item.annotations[annotationIndex];
  const [hintRevealed, setHintRevealed] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Reset reveal state when the item/annotation changes.
  useEffect((): void => {
    setHintRevealed(false);
    setAnswerRevealed(false);
  }, [item.moveId, annotationIndex]);

  const handleRevealHint = useCallback((): void => {
    setHintRevealed(true);
  }, []);

  const handleRevealAnswer = useCallback((): void => {
    setAnswerRevealed(true);
  }, []);

  if (!annotation) return <></>;

  return (
    <div className="study-overlay" role="region" aria-label={t("study.region", "Study prompt")}>
      <div className="study-overlay-header">
        <span className="study-overlay-progress">
          {t("study.progress", "Question")} {itemIndex + 1} / {totalItems}
        </span>
        <button
          type="button"
          className="study-overlay-stop"
          onClick={onStop}
          title={t("study.stop", "Stop study")}
        >
          ✕
        </button>
      </div>

      <p className="study-overlay-question">{annotation.question}</p>

      {annotation.hint && !hintRevealed && !answerRevealed && (
        <button
          type="button"
          className="study-overlay-btn study-overlay-btn--hint"
          onClick={handleRevealHint}
        >
          {t("study.showHint", "Show hint")}
        </button>
      )}

      {hintRevealed && annotation.hint && (
        <p className="study-overlay-hint">
          <span className="study-overlay-hint-label">{t("study.hint", "Hint:")}</span>
          {" "}{annotation.hint}
        </p>
      )}

      {!answerRevealed && (
        <button
          type="button"
          className="study-overlay-btn study-overlay-btn--reveal"
          onClick={handleRevealAnswer}
        >
          {t("study.revealAnswer", "Reveal answer")}
        </button>
      )}

      {answerRevealed && (
        <div className="study-overlay-answer">
          <span className="study-overlay-answer-label">{t("study.answer", "Answer:")}</span>
          <p className="study-overlay-answer-text">{annotation.answer}</p>
          <button
            type="button"
            className="study-overlay-btn study-overlay-btn--next"
            onClick={onNext}
          >
            {itemIndex + 1 < totalItems
              ? t("study.next", "Next question →")
              : t("study.finish", "Finish study ✓")}
          </button>
        </div>
      )}
    </div>
  );
};
