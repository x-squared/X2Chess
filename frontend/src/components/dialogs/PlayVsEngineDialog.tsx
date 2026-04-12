/**
 * PlayVsEngineDialog — configure and start a "play vs engine" game.
 *
 * Integration API:
 * - `<PlayVsEngineDialog engineName={...} t={...} onStart={...} onCancel={...} />`
 *   Mount when the user triggers "Play vs Engine".
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onStart(config)` fires with the chosen options.
 * - `onCancel()` fires on dismiss.
 */

import { useState, useRef, useEffect, useCallback, type ReactElement } from "react";
import type { VsEngineConfig } from "../../features/analysis/hooks/useVsEngine";

type PlayVsEngineDialogProps = {
  /** Display name of the configured engine, or null if none available. */
  engineName: string | null;
  t: (key: string, fallback?: string) => string;
  onStart: (config: VsEngineConfig) => void;
  onCancel: () => void;
};

const MOVETIME_OPTIONS = [
  { label: "0.5s", value: 500 },
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
];

/**
 * Modal dialog for configuring a game against the engine.
 */
export const PlayVsEngineDialog = ({
  engineName,
  t,
  onStart,
  onCancel,
}: PlayVsEngineDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const [movetime, setMovetime] = useState(2000);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleStart = useCallback((): void => {
    dialogRef.current?.close();
    onStart({ playerSide, movetime });
  }, [playerSide, movetime, onStart]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  return (
    <dialog ref={dialogRef} className="vs-engine-dialog" onClose={onCancel}>
      <div className="vs-engine-content">
        <h2 className="vs-engine-title">
          {t("vsEngine.title", "Play vs Engine")}
        </h2>

        {engineName ? (
          <p className="vs-engine-engine-name">{engineName}</p>
        ) : (
          <p className="vs-engine-no-engine">
            {t("vsEngine.noEngine", "No engine configured. Configure an engine in settings.")}
          </p>
        )}

        {/* Side selection */}
        <fieldset className="vs-engine-fieldset">
          <legend className="vs-engine-legend">
            {t("vsEngine.side", "Play as")}
          </legend>
          <div className="vs-engine-side-buttons">
            <button
              type="button"
              className={`vs-engine-side-btn${playerSide === "white" ? " vs-engine-side-btn--active" : ""}`}
              onClick={(): void => { setPlayerSide("white"); }}
            >
              {t("vsEngine.white", "White")}
            </button>
            <button
              type="button"
              className={`vs-engine-side-btn${playerSide === "black" ? " vs-engine-side-btn--active" : ""}`}
              onClick={(): void => { setPlayerSide("black"); }}
            >
              {t("vsEngine.black", "Black")}
            </button>
          </div>
        </fieldset>

        {/* Time per move */}
        <fieldset className="vs-engine-fieldset">
          <legend className="vs-engine-legend">
            {t("vsEngine.movetime", "Engine time per move")}
          </legend>
          <div className="vs-engine-movetime-buttons">
            {MOVETIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`vs-engine-movetime-btn${movetime === opt.value ? " vs-engine-movetime-btn--active" : ""}`}
                onClick={(): void => { setMovetime(opt.value); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="vs-engine-actions">
          <button
            type="button"
            className="vs-engine-btn-cancel"
            onClick={handleCancel}
          >
            {t("vsEngine.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="vs-engine-btn-start"
            disabled={!engineName}
            onClick={handleStart}
          >
            {t("vsEngine.start", "Start Game")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
