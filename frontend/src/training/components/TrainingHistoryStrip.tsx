/**
 * TrainingHistoryStrip — compact strip shown below PGN headers when the active
 * game has training history (T15).
 *
 * Integration API:
 * - `<TrainingHistoryStrip sourceGameRef={...} onTrainAgain={...} t={...} />`
 *   Renders nothing when `sourceGameRef` is empty or no badge exists.
 *
 * Configuration API:
 * - Reads from localStorage via `loadBadgesForRefs`; no network calls.
 *
 * Communication API:
 * - `onTrainAgain()` — fires when the user clicks "Train again".
 */

import { type ReactElement } from "react";
import { loadBadgesForRefs } from "../transcript_storage";

// ── Props ─────────────────────────────────────────────────────────────────────

type TrainingHistoryStripProps = {
  /** Composite `"kind:locator:recordId"` key; empty for unsaved games. */
  sourceGameRef: string;
  /** Fired when the user clicks "Train again". */
  onTrainAgain: () => void;
  /** Fired when the user clicks "View history". */
  onViewHistory: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const TrainingHistoryStrip = ({
  sourceGameRef,
  onTrainAgain,
  onViewHistory,
  t,
}: TrainingHistoryStripProps): ReactElement | null => {
  if (!sourceGameRef) return null;

  const badges = loadBadgesForRefs([sourceGameRef]);
  const badge = badges.get(sourceGameRef);
  if (!badge) return null;

  const dateLabel = (() => {
    try {
      return new Date(badge.lastSessionAt).toLocaleDateString();
    } catch {
      return badge.lastSessionAt;
    }
  })();

  const sessionsLabel =
    badge.sessionCount === 1
      ? t("training.strip.oneSession", "1 session")
      : t("training.strip.nSessions", `${badge.sessionCount} sessions`).replace(
          "%n",
          String(badge.sessionCount),
        );

  return (
    <div className="training-history-strip">
      <span className="training-history-strip__icon" aria-hidden>🎯</span>
      <span className="training-history-strip__summary">
        {sessionsLabel}
        {" · "}
        {t("training.strip.best", "Best:")} {badge.bestScore}%
        {" · "}
        {dateLabel}
      </span>
      <button
        type="button"
        className="training-history-strip__btn"
        onClick={onViewHistory}
      >
        {t("training.strip.viewHistory", "View")}
      </button>
      <button
        type="button"
        className="training-history-strip__btn"
        onClick={onTrainAgain}
      >
        {t("training.strip.trainAgain", "Train again")}
      </button>
    </div>
  );
};
