/**
 * training — public API for the training mode module.
 *
 * Integration API:
 * - Re-exports all public domain types, protocol implementations, hooks,
 *   and React components for training sessions.
 */

// Domain types
export type {
  TrainingProtocol,
  TrainingConfig,
  TrainingSessionState,
  UserMoveInput,
  MoveEvalResult,
  ResultSummary,
  ResultHighlight,
  TrainingPhase,
  TrainingPosition,
} from "./domain/training_protocol";

export type {
  TrainingTranscript,
  PlyRecord,
  PlyOutcome,
  TrainingAnnotation,
  MergeSelection,
  MergeTarget,
} from "./domain/training_transcript";

export {
  createTranscript,
  addPlyRecord,
  addAnnotation,
  completeTranscript,
  abortTranscript,
} from "./domain/training_transcript";

// Protocols
export { REPLAY_PROTOCOL } from "./protocols/replay_protocol";
export type { ReplayProtocolOptions } from "./protocols/replay_protocol";

// Hooks
export { useTrainingSession } from "./hooks/useTrainingSession";
export type { TrainingSessionControls } from "./hooks/useTrainingSession";

// Components
export { TrainingLauncher } from "./components/TrainingLauncher";
export { TrainingOverlay } from "./components/TrainingOverlay";
export { MoveOutcomeHint } from "./components/MoveOutcomeHint";
export { TrainingResult } from "./components/TrainingResult";
