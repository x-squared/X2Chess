/**
 * TrainingHistoryPanel — slide-in panel showing per-session training history
 * for the active game (T16).
 *
 * Integration API:
 * - `<TrainingHistoryPanel sourceGameRef={...} onClose={...} onTrainAgain={...} t={...} />`
 *
 * Configuration API:
 * - Reads session history from localStorage via `loadSessionHistory`.
 *
 * Communication API:
 * - `onClose()` — closes the panel.
 * - `onTrainAgain()` — opens the training launcher.
 */

import { type ReactElement } from "react";
import { loadSessionHistory } from "../transcript_storage";
import type { SessionRecord } from "../transcript_storage";

// ── Props ─────────────────────────────────────────────────────────────────────

type TrainingHistoryPanelProps = {
  sourceGameRef: string;
  onClose: () => void;
  onTrainAgain: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const outcomeBar = (session: SessionRecord): ReactElement => {
  const { correct, wrong, skipped, total } = session;
  if (total === 0) return <span className="th-panel__bar" />;
  const pct = (n: number): string => `${Math.round((n / total) * 100)}%`;
  return (
    <span className="th-panel__bar" title={`${correct}✓ ${wrong}✗ ${skipped}→`}>
      <span className="th-panel__bar-correct" style={{ width: pct(correct) }} />
      <span className="th-panel__bar-wrong" style={{ width: pct(wrong) }} />
      <span className="th-panel__bar-skipped" style={{ width: pct(skipped) }} />
    </span>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export const TrainingHistoryPanel = ({
  sourceGameRef,
  onClose,
  onTrainAgain,
  t,
}: TrainingHistoryPanelProps): ReactElement => {
  const sessions = loadSessionHistory(sourceGameRef);

  return (
    <div className="th-panel" role="dialog" aria-modal="true" aria-label={t("training.history.title", "Training history")}>
      <div className="th-panel__header">
        <span className="th-panel__title">{t("training.history.title", "Training history")}</span>
        <button
          type="button"
          className="th-panel__close"
          aria-label={t("common.close", "Close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="th-panel__empty">{t("training.history.empty", "No sessions yet.")}</p>
      ) : (
        <table className="th-panel__table">
          <thead>
            <tr>
              <th>{t("training.history.col.date", "Date")}</th>
              <th>{t("training.history.col.protocol", "Protocol")}</th>
              <th>{t("training.history.col.score", "Score")}</th>
              <th>{t("training.history.col.grade", "Grade")}</th>
              <th>{t("training.history.col.breakdown", "Breakdown")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s: SessionRecord, i: number) => (
              <tr key={i} className="th-panel__row">
                <td className="th-panel__cell th-panel__cell--date">
                  {new Date(s.date).toLocaleDateString()}
                </td>
                <td className="th-panel__cell">{s.protocol || "—"}</td>
                <td className="th-panel__cell th-panel__cell--score">{s.scorePercent}%</td>
                <td className="th-panel__cell">{s.gradeLabel || "—"}</td>
                <td className="th-panel__cell th-panel__cell--bar">
                  {outcomeBar(s)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="th-panel__footer">
        <button
          type="button"
          className="th-panel__train-btn"
          onClick={(): void => { onClose(); onTrainAgain(); }}
        >
          {t("training.strip.trainAgain", "Train again")}
        </button>
      </div>
    </div>
  );
};
