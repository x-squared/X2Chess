/**
 * TrainingResult — end-of-session score summary and annotation merge dialog.
 *
 * Integration API:
 * - `<TrainingResult summary={...} transcript={...} onMerge={...} onDiscard={...} t={...} />`
 *   Mount when training phase transitions to "reviewing".
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onMerge(selection)` fires with the user's merge target and annotation choices.
 * - `onDiscard()` fires when the user discards the transcript.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";
import type { ResultSummary } from "../domain/training_protocol";
import type {
  TrainingTranscript,
  TrainingAnnotation,
  MergeSelection,
  MergeTarget,
} from "../domain/training_transcript";

type TrainingResultProps = {
  summary: ResultSummary;
  transcript: TrainingTranscript;
  t: (key: string, fallback?: string) => string;
  onMerge: (selection: MergeSelection) => void;
  onDiscard: () => void;
};

const GRADE_COLORS: Record<string, string> = {
  "Excellent": "#22c55e",
  "Good": "#84cc16",
  "Fair": "#f59e0b",
  "Needs work": "#ef4444",
};

const OUTCOME_ICONS: Record<string, string> = {
  correct: "✓",
  legal_variant: "✓",
  wrong: "✗",
  skip: "→",
  engine_filled: "⚡",
};

/**
 * Modal dialog showing training session results.
 * Includes: score bar, grade, per-move breakdown, annotation merge options.
 */
export const TrainingResult = ({
  summary,
  transcript,
  t,
  onMerge,
  onDiscard,
}: TrainingResultProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mergeTarget, setMergeTarget] = useState<MergeTarget>("keep_separate");
  const [annotationIncludes, setAnnotationIncludes] = useState<boolean[]>(
    (): boolean[] =>
      transcript.annotations.map(
        (a: TrainingAnnotation) => a.source === "user",
      ),
  );

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleAnnotationToggle = useCallback(
    (index: number): void => {
      setAnnotationIncludes((prev) => {
        const next = [...prev];
        next[index] = !next[index];
        return next;
      });
    },
    [],
  );

  const handleMerge = useCallback((): void => {
    const selection: MergeSelection = {
      annotations: transcript.annotations.map(
        (annotation: TrainingAnnotation, i: number) => ({
          annotation,
          include: annotationIncludes[i] ?? false,
        }),
      ),
      mergeTarget,
    };
    dialogRef.current?.close();
    onMerge(selection);
  }, [transcript.annotations, annotationIncludes, mergeTarget, onMerge]);

  const handleDiscard = useCallback((): void => {
    dialogRef.current?.close();
    onDiscard();
  }, [onDiscard]);

  const gradeColor = GRADE_COLORS[summary.gradeLabel] ?? "#6b7280";

  return (
    <dialog
      ref={dialogRef}
      className="training-result-dialog"
      onClose={onDiscard}
    >
      <div className="training-result-content">
        <h2 className="training-result-title">
          {t("training.result.title", "Training Complete")}
        </h2>

        {/* Score bar */}
        <div className="training-result-score-bar">
          <div
            className="training-result-score-bar-fill training-result-score-bar-fill--correct"
            style={{
              width: `${summary.total > 0 ? (summary.correct / summary.total) * 100 : 0}%`,
            }}
          />
          <div
            className="training-result-score-bar-fill training-result-score-bar-fill--wrong"
            style={{
              width: `${summary.total > 0 ? (summary.wrong / summary.total) * 100 : 0}%`,
            }}
          />
          <div
            className="training-result-score-bar-fill training-result-score-bar-fill--skip"
            style={{
              width: `${summary.total > 0 ? (summary.skipped / summary.total) * 100 : 0}%`,
            }}
          />
        </div>

        {/* Grade and score */}
        <div className="training-result-grade-row">
          <span
            className="training-result-grade"
            style={{ color: gradeColor }}
          >
            {t(`training.result.grade.${summary.gradeLabel.toLowerCase().replace(" ", "_")}`, summary.gradeLabel)}
          </span>
          <span className="training-result-percent">
            {summary.scorePercent}%
          </span>
        </div>

        <div className="training-result-stats">
          <span className="training-result-stat training-result-stat--correct">
            ✓ {summary.correct}
          </span>
          <span className="training-result-stat training-result-stat--wrong">
            ✗ {summary.wrong}
          </span>
          <span className="training-result-stat training-result-stat--skip">
            → {summary.skipped}
          </span>
          {summary.avgTimeMsPerMove !== undefined && (
            <span className="training-result-stat">
              ⏱ {(summary.avgTimeMsPerMove / 1000).toFixed(1)}s{t("training.result.perMove", "/move")}
            </span>
          )}
        </div>

        {/* Per-move breakdown */}
        {transcript.plyRecords.length > 0 && (
          <div className="training-result-breakdown">
            <h3 className="training-result-section-title">
              {t("training.result.breakdown", "Move breakdown")}
            </h3>
            <table className="training-result-table">
              <thead>
                <tr>
                  <th>{t("training.result.col.ply", "#")}</th>
                  <th>{t("training.result.col.source", "Expected")}</th>
                  <th>{t("training.result.col.user", "Played")}</th>
                  <th>{t("training.result.col.outcome", "")}</th>
                  <th>{t("training.result.col.time", "Time")}</th>
                </tr>
              </thead>
              <tbody>
                {transcript.plyRecords.map((rec) => (
                  <tr
                    key={rec.ply}
                    className={`training-result-row training-result-row--${rec.outcome}`}
                  >
                    <td>{Math.floor(rec.ply / 2) + 1}{rec.ply % 2 === 0 ? "." : "…"}</td>
                    <td>{rec.sourceMoveSan}</td>
                    <td>{rec.userMoveSan ?? "—"}</td>
                    <td className="training-result-outcome">
                      {OUTCOME_ICONS[rec.outcome] ?? "?"}
                    </td>
                    <td>{(rec.timeTakenMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Annotations */}
        {transcript.annotations.length > 0 && (
          <div className="training-result-annotations">
            <h3 className="training-result-section-title">
              {t("training.result.annotations", "Captured annotations")}
            </h3>
            {transcript.annotations.map(
              (ann: TrainingAnnotation, i: number) => (
                <label
                  key={i}
                  className="training-result-annotation-row"
                >
                  <input
                    type="checkbox"
                    checked={annotationIncludes[i] ?? false}
                    onChange={(): void => { handleAnnotationToggle(i); }}
                  />
                  <span className="training-result-annotation-content">
                    {ann.content}
                  </span>
                </label>
              ),
            )}
          </div>
        )}

        {/* Merge target */}
        <fieldset className="training-result-merge-fieldset">
          <legend className="training-result-section-title">
            {t("training.result.mergeTarget", "Save annotations to:")}
          </legend>
          {(["source_game", "new_variation", "keep_separate"] as MergeTarget[]).map(
            (target) => (
              <label key={target} className="training-result-merge-option">
                <input
                  type="radio"
                  name="merge-target"
                  value={target}
                  checked={mergeTarget === target}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    setMergeTarget(e.target.value as MergeTarget);
                  }}
                />
                {t(
                  `training.result.merge.${target}`,
                  target === "source_game"
                    ? "Add to source game"
                    : target === "new_variation"
                      ? "Create new variation"
                      : "Keep separate",
                )}
              </label>
            ),
          )}
        </fieldset>

        <div className="training-result-actions">
          <button
            type="button"
            className="training-result-btn-discard"
            onClick={handleDiscard}
          >
            {t("training.result.discard", "Discard")}
          </button>
          <button
            type="button"
            className="training-result-btn-apply"
            onClick={handleMerge}
          >
            {t("training.result.apply", "Apply")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
