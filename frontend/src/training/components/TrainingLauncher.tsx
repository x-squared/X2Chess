/**
 * TrainingLauncher — configuration dialog for starting a training session.
 *
 * Integration API:
 * - `<TrainingLauncher gameTitle={...} pgnText={...} sourceRef={...}
 *     onStart={...} onCancel={...} t={...} />`
 *
 * Configuration API:
 * - Protocol choice and options are configured inline.
 *
 * Communication API:
 * - `onStart(config)` fires with a fully configured `TrainingConfig`.
 * - `onCancel()` fires on dismiss.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";
import type { TrainingConfig } from "../domain/training_protocol";
import type { ReplayProtocolOptions } from "../protocols/replay_protocol";

type TrainingLauncherProps = {
  /** Human-readable game title shown in the dialog. */
  gameTitle: string;
  /** Full PGN text of the source game. */
  pgnText: string;
  /** Opaque string key identifying the source game. */
  sourceRef: string;
  t: (key: string, fallback?: string) => string;
  onStart: (config: TrainingConfig) => void;
  onCancel: () => void;
};

const PROTOCOLS = [
  { id: "replay", label: "Game Replay" },
  { id: "opening", label: "Opening Trainer" },
] as const;

type ProtocolId = typeof PROTOCOLS[number]["id"];

/**
 * Modal dialog for configuring and launching a training session.
 */
export const TrainingLauncher = ({
  gameTitle,
  pgnText,
  sourceRef,
  t,
  onStart,
  onCancel,
}: TrainingLauncherProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [protocol, setProtocol] = useState<ProtocolId>("replay");
  const [side, setSide] = useState<ReplayProtocolOptions["side"]>("white");
  const [startPly, setStartPly] = useState<number>(0);
  const [allowRetry, setAllowRetry] = useState<boolean>(true);
  const [showOpponentMoves, setShowOpponentMoves] = useState<boolean>(true);
  const [opponentDelayMs, setOpponentDelayMs] = useState<number>(800);
  const [allowHints, setAllowHints] = useState<boolean>(true);
  const [maxHints, setMaxHints] = useState<number>(3);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleStart = useCallback((): void => {
    const protocolOptions: Record<string, unknown> =
      protocol === "opening"
        ? { shuffle: true, maxPositions: 0 }
        : ({
            side,
            startPly,
            allowRetry,
            showOpponentMoves,
            opponentMoveDelayMs: opponentDelayMs,
            allowHints,
            maxHintsPerGame: maxHints,
            inferiorMovePolicy: "reject",
            evalAcceptThresholdCp: 30,
            evalInferiorThresholdCp: 80,
          } satisfies ReplayProtocolOptions);
    const config: TrainingConfig = {
      sourceGameRef: sourceRef,
      pgnText,
      protocol,
      protocolOptions,
    };
    dialogRef.current?.close();
    onStart(config);
  }, [
    protocol, side, startPly, allowRetry, showOpponentMoves,
    opponentDelayMs, allowHints, maxHints, sourceRef, pgnText, onStart,
  ]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  return (
    <dialog ref={dialogRef} className="training-launcher-dialog" onClose={onCancel}>
      <div className="training-launcher-content">
        <h2 className="training-launcher-title">
          {t("training.launcher.title", "Start Training")}
        </h2>

        <div className="training-launcher-form">
          {/* Protocol */}
          <label className="training-launcher-field">
            <span className="training-launcher-label">
              {t("training.launcher.protocol", "Protocol:")}
            </span>
            <select
              className="training-launcher-select"
              value={protocol}
              onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                setProtocol(e.target.value as ProtocolId);
              }}
            >
              {PROTOCOLS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>

          {/* Game */}
          <div className="training-launcher-field">
            <span className="training-launcher-label">
              {t("training.launcher.game", "Game:")}
            </span>
            <span className="training-launcher-game-title">{gameTitle}</span>
          </div>

          {/* Replay-only options */}
          {protocol === "replay" && <><fieldset className="training-launcher-fieldset">
            <legend className="training-launcher-legend">
              {t("training.launcher.side", "Side:")}
            </legend>
            {(["white", "black", "both"] as const).map((s) => (
              <label key={s} className="training-launcher-radio">
                <input
                  type="radio"
                  name="training-side"
                  value={s}
                  checked={side === s}
                  onChange={(): void => { setSide(s); }}
                />
                {t(`training.launcher.side.${s}`, s.charAt(0).toUpperCase() + s.slice(1))}
              </label>
            ))}
          </fieldset>

          {/* Start ply */}
          <label className="training-launcher-field">
            <span className="training-launcher-label">
              {t("training.launcher.startPly", "Start ply:")}
            </span>
            <input
              type="number"
              className="training-launcher-input"
              min={0}
              value={startPly}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setStartPly(Math.max(0, parseInt(e.target.value, 10) || 0));
              }}
            />
          </label>

          {/* Hints */}
          <label className="training-launcher-field">
            <span className="training-launcher-label">
              {t("training.launcher.maxHints", "Hints per game:")}
            </span>
            <input
              type="number"
              className="training-launcher-input"
              min={0}
              value={maxHints}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setMaxHints(Math.max(0, parseInt(e.target.value, 10) || 0));
              }}
            />
          </label>

          {/* Checkboxes */}
          <label className="training-launcher-checkbox">
            <input
              type="checkbox"
              checked={showOpponentMoves}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setShowOpponentMoves(e.target.checked);
              }}
            />
            {t("training.launcher.showOpponent", "Show opponent moves")}
            <span className="training-launcher-sub">
              {t("training.launcher.delayLabel", "Delay:")}{" "}
              <input
                type="number"
                className="training-launcher-input training-launcher-input--small"
                min={0}
                max={5000}
                step={100}
                value={opponentDelayMs}
                disabled={!showOpponentMoves}
                onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                  setOpponentDelayMs(
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  );
                }}
              />{" "}
              ms
            </span>
          </label>

          <label className="training-launcher-checkbox">
            <input
              type="checkbox"
              checked={allowRetry}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setAllowRetry(e.target.checked);
              }}
            />
            {t("training.launcher.allowRetry", "Allow retry on wrong move")}
          </label>

          <label className="training-launcher-checkbox">
            <input
              type="checkbox"
              checked={allowHints}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setAllowHints(e.target.checked);
              }}
            />
            {t("training.launcher.allowHints", "Allow hints")}
          </label>
          </>}
        </div>

        <div className="training-launcher-actions">
          <button
            type="button"
            className="training-launcher-btn-cancel"
            onClick={handleCancel}
          >
            {t("training.launcher.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="training-launcher-btn-start"
            onClick={handleStart}
          >
            {t("training.launcher.start", "Start Training")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
