/**
 * AnnotateGameDialog — configure, run, and apply batch engine annotation.
 *
 * Integration API:
 * - `<AnnotateGameDialog phase={...} progress={...} annotatedModel={...}
 *     engineName={...} t={...} onStart={...} onApply={...}
 *     onCancel={...} onClose={...} />`
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onStart(opts)` fires when the user clicks Annotate.
 * - `onApply(model)` fires when the user accepts the annotated result.
 * - `onCancel()` fires to abort a running annotation.
 * - `onClose()` fires to dismiss after done/cancelled.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
} from "react";
import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import type { AnnotateOptions, AnnotatePhase, AnnotationProgress } from "../../hooks/useGameAnnotation";

type AnnotateGameDialogProps = {
  phase: AnnotatePhase;
  progress: AnnotationProgress;
  annotatedModel: PgnModel | null;
  engineName: string | null;
  t: (key: string, fallback?: string) => string;
  onStart: (opts: Partial<AnnotateOptions>) => void;
  onApply: (model: PgnModel) => void;
  onCancel: () => void;
  onClose: () => void;
};

const MOVETIME_OPTIONS = [
  { label: "0.5s", value: 500 },
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
];

export const AnnotateGameDialog = ({
  phase,
  progress,
  annotatedModel,
  engineName,
  t,
  onStart,
  onApply,
  onCancel,
  onClose,
}: AnnotateGameDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [movetime, setMovetime] = useState(1000);
  const [addEvalComments, setAddEvalComments] = useState(true);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleStart = useCallback((): void => {
    onStart({ movetime, addEvalComments });
  }, [movetime, addEvalComments, onStart]);

  const handleApply = useCallback((): void => {
    if (annotatedModel) {
      dialogRef.current?.close();
      onApply(annotatedModel);
    }
  }, [annotatedModel, onApply]);

  const handleClose = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <dialog ref={dialogRef} className="annotate-dialog" onClose={onClose}>
      <div className="annotate-content">
        <h2 className="annotate-title">
          {t("annotate.title", "Annotate Game")}
        </h2>

        {!engineName && (
          <p className="annotate-no-engine">
            {t("annotate.noEngine", "No engine configured.")}
          </p>
        )}

        {phase === "idle" && (
          <>
            <fieldset className="annotate-fieldset">
              <legend className="annotate-legend">
                {t("annotate.movetime", "Time per move")}
              </legend>
              <div className="annotate-movetime-buttons">
                {MOVETIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`annotate-movetime-btn${movetime === opt.value ? " annotate-movetime-btn--active" : ""}`}
                    onClick={(): void => { setMovetime(opt.value); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="annotate-checkbox-row">
              <input
                type="checkbox"
                checked={addEvalComments}
                onChange={(e): void => { setAddEvalComments(e.target.checked); }}
              />
              {t("annotate.addEval", "Add suggested move comments")}
            </label>

            <div className="annotate-actions">
              <button type="button" className="annotate-btn-cancel" onClick={handleClose}>
                {t("annotate.cancel", "Cancel")}
              </button>
              <button
                type="button"
                className="annotate-btn-start"
                disabled={!engineName}
                onClick={handleStart}
              >
                {t("annotate.start", "Annotate")}
              </button>
            </div>
          </>
        )}

        {phase === "running" && (
          <>
            <p className="annotate-progress-label">
              {t("annotate.analyzing", "Analyzing…")} {progress.current}/{progress.total}
            </p>
            <div className="annotate-progress-bar">
              <div className="annotate-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="annotate-actions">
              <button type="button" className="annotate-btn-cancel" onClick={onCancel}>
                {t("annotate.stop", "Stop")}
              </button>
            </div>
          </>
        )}

        {(phase === "done" || phase === "cancelled") && (
          <>
            <p className="annotate-done-label">
              {phase === "done"
                ? t("annotate.done", "Annotation complete.")
                : t("annotate.cancelled", "Annotation stopped.")}
            </p>
            <div className="annotate-actions">
              <button type="button" className="annotate-btn-cancel" onClick={handleClose}>
                {t("annotate.discard", "Discard")}
              </button>
              {annotatedModel && (
                <button type="button" className="annotate-btn-start" onClick={handleApply}>
                  {t("annotate.apply", "Apply to game")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
};
