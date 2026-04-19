/**
 * TrainingLauncher — context-aware dialog for configuring and starting a training session.
 *
 * Adapts its available protocols and options to the active game:
 * - Standard / Chess960 games: Replay and Opening protocols only.
 * - Custom-FEN games: adds "Find the Move" protocol.
 * - Custom-FEN games: shows Mirror and Rotation board transforms.
 * - Pawnless custom-FEN games: enables 90°/180°/270° rotation options.
 *
 * Integration API:
 * - `<TrainingLauncher gameTitle={…} pgnText={…} sourceRef={…} gameContext={…}
 *     onStart={…} onCancel={…} t={…} />`
 *
 * Configuration API:
 * - Protocol choice, side, start-ply, hints, and board transforms are configured inline.
 *
 * Communication API:
 * - `onStart(config)` fires with a fully configured `TrainingConfig` (including the
 *   transformed PGN when mirror/rotation is active).
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
import type { TrainingGameContext } from "../domain/training_game_context";
import { plyLabel } from "../domain/training_game_context";
import { mirrorPgn, rotatePgn } from "../domain/pgn_transforms";

// ── Protocol registry ─────────────────────────────────────────────────────────

type ProtocolId = "replay" | "opening" | "find_move";

type ProtocolDef = {
  id: ProtocolId;
  labelKey: string;
  labelFallback: string;
};

const ALL_PROTOCOLS: ProtocolDef[] = [
  { id: "replay",    labelKey: "training.launcher.protocol.replay",    labelFallback: "Game Replay" },
  { id: "opening",   labelKey: "training.launcher.protocol.opening",   labelFallback: "Opening Trainer" },
  { id: "find_move", labelKey: "training.launcher.protocol.find_move", labelFallback: "Find the Move" },
];

/** Return the protocols available for the given game context. */
const availableProtocols = (ctx: TrainingGameContext): ProtocolDef[] =>
  ALL_PROTOCOLS.filter((p) => {
    if (p.id === "find_move") return ctx.hasCustomStartingPosition;
    return true; // replay and opening always available
  });

// ── Board transform types ─────────────────────────────────────────────────────

type BoardTransform =
  | { kind: "none" }
  | { kind: "mirror" }
  | { kind: "rotate"; degrees: 90 | 180 | 270 };

const applyBoardTransform = (pgnText: string, transform: BoardTransform): string => {
  if (transform.kind === "mirror") return mirrorPgn(pgnText);
  if (transform.kind === "rotate") return rotatePgn(pgnText, transform.degrees);
  return pgnText;
};

// ── Props ─────────────────────────────────────────────────────────────────────

type TrainingLauncherProps = {
  /** Human-readable game title shown in the dialog. */
  gameTitle: string;
  /** Full PGN text of the source game (before any transform). */
  pgnText: string;
  /** Opaque string key identifying the source game. */
  sourceRef: string;
  /** Context derived from the active PGN model; drives available protocols and transforms. */
  gameContext: TrainingGameContext;
  t: (key: string, fallback?: string) => string;
  onStart: (config: TrainingConfig) => void;
  onCancel: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Modal dialog for configuring and launching a training session.
 *
 * @param gameTitle Display name shown as the "Game:" field.
 * @param pgnText Raw PGN for the source game; may be transformed before `onStart`.
 * @param sourceRef Opaque game reference key forwarded in `TrainingConfig`.
 * @param gameContext Training-relevant facts about the game (protocol availability,
 *   custom FEN, pawnless status, mainline move list).
 * @param t Translator function.
 * @param onStart Called with a ready `TrainingConfig` when the user clicks "Start".
 * @param onCancel Called when the user dismisses the dialog.
 */
export const TrainingLauncher = ({
  gameTitle,
  pgnText,
  sourceRef,
  gameContext,
  t,
  onStart,
  onCancel,
}: TrainingLauncherProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const protocols = availableProtocols(gameContext);
  const defaultProtocol: ProtocolId = protocols[0]?.id ?? "replay";

  const [protocol, setProtocol] = useState<ProtocolId>(defaultProtocol);
  const [side, setSide] = useState<ReplayProtocolOptions["side"]>("white");
  const [startPly, setStartPly] = useState<number>(0);
  const [allowRetry, setAllowRetry] = useState<boolean>(true);
  const [showOpponentMoves, setShowOpponentMoves] = useState<boolean>(true);
  const [opponentDelayMs, setOpponentDelayMs] = useState<number>(800);
  const [allowHints, setAllowHints] = useState<boolean>(true);
  const [maxHints, setMaxHints] = useState<number>(3);
  const [boardTransform, setBoardTransform] = useState<BoardTransform>({ kind: "none" });
  const [rotationDegrees, setRotationDegrees] = useState<90 | 180 | 270>(180);

  // Reset to defaults whenever the available protocol list changes (new game loaded).
  useEffect((): void => {
    setProtocol(protocols[0]?.id ?? "replay");
    setStartPly(0);
    setBoardTransform({ kind: "none" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameContext.startingFen]);

  // Reset start ply when game changes or protocol changes to find_move (always from 0).
  useEffect((): void => {
    if (protocol === "find_move") setStartPly(0);
  }, [protocol]);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  // Derived values
  const showReplayOptions = protocol === "replay";
  const showOpeningOptions = protocol === "opening";
  const showFindMoveOptions = protocol === "find_move";
  const showPlyPicker = protocol === "replay";
  const showBoardTransforms = gameContext.hasCustomStartingPosition;
  const showRotation =
    showBoardTransforms && gameContext.isPawnless && boardTransform.kind === "rotate";

  const effectiveTransform: BoardTransform =
    boardTransform.kind === "rotate"
      ? { kind: "rotate", degrees: rotationDegrees }
      : boardTransform;

  const handleStart = useCallback((): void => {
    const transformedPgn = applyBoardTransform(pgnText, effectiveTransform);

    let protocolOptions: Record<string, unknown>;
    if (protocol === "opening") {
      protocolOptions = { side, maxMoves: 0 };
    } else if (protocol === "find_move") {
      protocolOptions = {
        side: "both",
        startPly: 0,
        allowRetry,
        showOpponentMoves: false,
        opponentMoveDelayMs: 0,
        allowHints,
        maxHintsPerGame: maxHints,
        inferiorMovePolicy: "reject",
        evalAcceptThresholdCp: 30,
        evalInferiorThresholdCp: 80,
      } satisfies ReplayProtocolOptions;
    } else {
      protocolOptions = {
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
      } satisfies ReplayProtocolOptions;
    }

    const config: TrainingConfig = {
      sourceGameRef: sourceRef,
      pgnText: transformedPgn,
      protocol,
      protocolOptions,
    };
    dialogRef.current?.close();
    onStart(config);
  }, [
    protocol, side, startPly, allowRetry, showOpponentMoves, opponentDelayMs,
    allowHints, maxHints, sourceRef, pgnText, effectiveTransform, onStart,
  ]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  // Constrain start ply to valid range
  const handleStartPlyChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const raw = Number.parseInt(e.target.value, 10);
    const clamped = Math.max(0, Math.min(Number.isNaN(raw) ? 0 : raw, gameContext.moveCount));
    setStartPly(clamped);
  }, [gameContext.moveCount]);

  return (
    <dialog ref={dialogRef} className="training-launcher-dialog" onClose={onCancel}>
      <div className="training-launcher-content">
        <h2 className="training-launcher-title">
          {t("training.launcher.title", "Start Training")}
        </h2>

        <div className="training-launcher-form">

          {/* ── Protocol selector ── */}
          <div className="training-launcher-field">
            <span className="training-launcher-label">
              {t("training.launcher.protocol", "Protocol:")}
            </span>
            <div className="training-launcher-protocol-list">
              {protocols.map((p) => (
                <label key={p.id} className="training-launcher-radio">
                  <input
                    type="radio"
                    name="training-protocol"
                    value={p.id}
                    checked={protocol === p.id}
                    onChange={(): void => { setProtocol(p.id); }}
                  />
                  {t(p.labelKey, p.labelFallback)}
                </label>
              ))}
            </div>
          </div>

          {/* ── Game ── */}
          <div className="training-launcher-field">
            <span className="training-launcher-label">
              {t("training.launcher.game", "Game:")}
            </span>
            <span className="training-launcher-game-title">{gameTitle}</span>
          </div>

          {/* ── Board transform (custom FEN games only) ── */}
          {showBoardTransforms && (
            <fieldset className="training-launcher-fieldset">
              <legend className="training-launcher-legend">
                {t("training.launcher.boardTransform", "Board transform:")}
              </legend>
              <label className="training-launcher-radio">
                <input
                  type="radio"
                  name="board-transform"
                  checked={boardTransform.kind === "none"}
                  onChange={(): void => { setBoardTransform({ kind: "none" }); }}
                />
                {t("training.launcher.transform.none", "None")}
              </label>
              <label className="training-launcher-radio">
                <input
                  type="radio"
                  name="board-transform"
                  checked={boardTransform.kind === "mirror"}
                  onChange={(): void => { setBoardTransform({ kind: "mirror" }); }}
                />
                {t("training.launcher.transform.mirror", "Mirror colors")}
                <span className="training-launcher-hint">
                  {" "}
                  {t(
                    "training.launcher.transform.mirrorHint",
                    "(swap White\u2044Black and reverse ranks)",
                  )}
                </span>
              </label>
              {gameContext.isPawnless && (
                <label className="training-launcher-radio">
                  <input
                    type="radio"
                    name="board-transform"
                    checked={boardTransform.kind === "rotate"}
                    onChange={(): void => {
                      setBoardTransform({ kind: "rotate", degrees: rotationDegrees });
                    }}
                  />
                  {t("training.launcher.transform.rotate", "Rotate board")}
                  <span className="training-launcher-hint">
                    {" "}
                    {t("training.launcher.transform.rotateHint", "(pawnless positions only)")}
                  </span>
                </label>
              )}

              {/* Rotation degree picker */}
              {showRotation && (
                <div className="training-launcher-rotation-picker">
                  {([90, 180, 270] as const).map((deg) => (
                    <label key={deg} className="training-launcher-radio training-launcher-radio--sub">
                      <input
                        type="radio"
                        name="rotation-degrees"
                        value={deg}
                        checked={rotationDegrees === deg}
                        onChange={(): void => { setRotationDegrees(deg); }}
                      />
                      {deg}°
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {/* ── Replay-specific options ── */}
          {showReplayOptions && (
            <>
              <fieldset className="training-launcher-fieldset">
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
                    {t(
                      `training.launcher.side.${s}`,
                      s.charAt(0).toUpperCase() + s.slice(1),
                    )}
                  </label>
                ))}
              </fieldset>

              {/* Start ply picker */}
              {showPlyPicker && gameContext.moveCount > 0 && (
                <div className="training-launcher-field">
                  <span className="training-launcher-label">
                    {t("training.launcher.startPly", "Start from:")}
                  </span>
                  <div className="training-launcher-ply-picker">
                    <input
                      type="range"
                      className="training-launcher-ply-slider"
                      min={0}
                      max={gameContext.moveCount}
                      value={startPly}
                      onChange={handleStartPlyChange}
                    />
                    <input
                      type="number"
                      className="training-launcher-input training-launcher-input--small"
                      min={0}
                      max={gameContext.moveCount}
                      value={startPly}
                      onChange={handleStartPlyChange}
                    />
                    <span className="training-launcher-ply-label">
                      {plyLabel(startPly, gameContext)}
                    </span>
                  </div>
                </div>
              )}

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
                    setMaxHints(Math.max(0, Number.parseInt(e.target.value, 10) || 0));
                  }}
                />
              </label>

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
                      setOpponentDelayMs(Math.max(0, Number.parseInt(e.target.value, 10) || 0));
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
            </>
          )}

          {/* ── Opening Trainer options ── */}
          {showOpeningOptions && (
            <fieldset className="training-launcher-fieldset">
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
                  {t(
                    `training.launcher.side.${s}`,
                    s.charAt(0).toUpperCase() + s.slice(1),
                  )}
                </label>
              ))}
            </fieldset>
          )}

          {/* ── Find Move options ── */}
          {showFindMoveOptions && (
            <>
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
                    setMaxHints(Math.max(0, Number.parseInt(e.target.value, 10) || 0));
                  }}
                />
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
            </>
          )}
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
