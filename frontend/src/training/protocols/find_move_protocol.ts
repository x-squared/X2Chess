/**
 * find_move_protocol — "Find the Move" training protocol for custom-position games.
 *
 * Presents the starting position (or any ply of the game) and asks the user to find
 * the correct continuation — without pre-announcing which side they play.
 * Evaluation is identical to the Replay protocol (NAG/RAV/[%train] signals).
 *
 * Intended exclusively for games that start from a non-standard FEN (`hasCustomStartingPosition`
 * in `TrainingGameContext`), where the position itself is the training stimulus.
 *
 * Integration API:
 * - `FIND_MOVE_PROTOCOL` — `TrainingProtocol` singleton; pass to `useTrainingSession`.
 * - `FindMoveProtocolOptions` — protocol-specific config shape.
 *
 * Configuration API:
 * - `FindMoveProtocolOptions` via `TrainingConfig.protocolOptions`.
 *   Defaults: `side: "both"`, `startPly: 0`.
 *
 * Communication API:
 * - Delegates all logic to `REPLAY_PROTOCOL` internally. The distinction is
 *   label/description and the forced defaults for the launcher UI.
 */

import type {
  TrainingProtocol,
  TrainingConfig,
  TrainingSessionState,
  UserMoveInput,
  MoveEvalResult,
  ResultSummary,
} from "../domain/training_protocol";
import type { TrainingTranscript } from "../domain/training_transcript";
import { REPLAY_PROTOCOL } from "./replay_protocol";
import type { ReplayProtocolOptions } from "./replay_protocol";

// ── Options ───────────────────────────────────────────────────────────────────

/**
 * Configuration options for the Find Move protocol.
 * Extends `ReplayProtocolOptions` but defaults `side` to "both" and `startPly` to 0.
 */
export type FindMoveProtocolOptions = ReplayProtocolOptions;

/** Default options emphasise training all moves from the starting position. */
const DEFAULT_FIND_MOVE_OPTIONS: FindMoveProtocolOptions = {
  side: "both",
  startPly: 0,
  allowRetry: true,
  showOpponentMoves: false, // user finds both sides; no auto-play
  opponentMoveDelayMs: 0,
  allowHints: true,
  maxHintsPerGame: 3,
  inferiorMovePolicy: "reject",
  evalAcceptThresholdCp: 30,
  evalInferiorThresholdCp: 80,
};

// ── Protocol ──────────────────────────────────────────────────────────────────

const initialize = (config: TrainingConfig): TrainingSessionState => {
  const merged: TrainingConfig = {
    ...config,
    protocolOptions: {
      ...DEFAULT_FIND_MOVE_OPTIONS,
      ...(config.protocolOptions as Partial<FindMoveProtocolOptions>),
    },
  };
  return REPLAY_PROTOCOL.initialize(merged);
};

const evaluateMove = (
  move: UserMoveInput,
  state: TrainingSessionState,
): MoveEvalResult => REPLAY_PROTOCOL.evaluateMove(move, state);

const advance = (state: TrainingSessionState): TrainingSessionState =>
  REPLAY_PROTOCOL.advance(state);

const isComplete = (state: TrainingSessionState): boolean =>
  REPLAY_PROTOCOL.isComplete(state);

const summarize = (
  state: TrainingSessionState,
  transcript: TrainingTranscript,
): ResultSummary => REPLAY_PROTOCOL.summarize(state, transcript);

export const FIND_MOVE_PROTOCOL: TrainingProtocol = {
  id: "find_move",
  label: "Find the Move",
  description:
    "From the given position, find the correct continuation for both sides.",
  initialize,
  evaluateMove,
  advance,
  isComplete,
  summarize,
};
