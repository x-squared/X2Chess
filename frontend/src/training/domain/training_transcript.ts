/**
 * training_transcript — TrainingTranscript, PlyRecord, and TrainingAnnotation types.
 *
 * Transcripts are stored separately from game data. They capture user activity
 * during a training session and can optionally be merged back into the source game.
 *
 * Integration API:
 * - `TrainingTranscript`, `PlyRecord`, `TrainingAnnotation`, `MergeSelection`.
 * - `createTranscript(config)` — factory for a new empty transcript.
 * - `addPlyRecord(transcript, record)` — immutable append helper.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure type definitions and helper functions; no side effects.
 */

import type { TrainingConfig } from "./training_protocol";

// ── Transcript types ──────────────────────────────────────────────────────────

export type PlyOutcome =
  | "correct"
  | "correct_better"
  | "correct_dubious"
  | "legal_variant"
  | "inferior"
  | "wrong"
  | "skip"
  | "engine_filled";

export type PlyRecord = {
  /** 0-based ply index in the source game. */
  ply: number;
  /** Expected move from the source game (UCI). */
  sourceMoveUci: string;
  /** Expected move SAN. */
  sourceMoveSan: string;
  /** Move the user played (undefined = skipped). */
  userMoveUci?: string;
  userMoveSan?: string;
  outcome: PlyOutcome;
  /** Number of attempts before correct or skip. */
  attemptsCount: number;
  /** Wall-clock time in ms spent on this move. */
  timeTakenMs: number;
};

export type TrainingAnnotationKind =
  | "comment"
  | "variation"
  | "nag"
  | "clock";

export type TrainingAnnotation = {
  ply: number;
  kind: TrainingAnnotationKind;
  content: string;
  source: "user" | "engine" | "protocol";
};

export type TrainingTranscript = {
  sessionId: string;
  protocol: string;
  sourceGameRef: string;
  startedAt: string;    // ISO 8601
  completedAt?: string;
  aborted: boolean;
  config: Record<string, unknown>;
  plyRecords: PlyRecord[];
  annotations: TrainingAnnotation[];
};

// ── Merge selection ───────────────────────────────────────────────────────────

export type MergeTarget =
  | "source_game"
  | "new_variation"
  | "keep_separate";

export type MergeSelection = {
  annotations: Array<{
    annotation: TrainingAnnotation;
    include: boolean;
  }>;
  mergeTarget: MergeTarget;
};

// ── Factory helpers ───────────────────────────────────────────────────────────

let _sessionCounter = 0;

/** Create a new empty transcript for the given config. */
export const createTranscript = (
  config: TrainingConfig,
): TrainingTranscript => ({
  sessionId: `session_${Date.now()}_${++_sessionCounter}`,
  protocol: config.protocol,
  sourceGameRef: config.sourceGameRef,
  startedAt: new Date().toISOString(),
  aborted: false,
  config: { ...config.protocolOptions },
  plyRecords: [],
  annotations: [],
});

/** Return a new transcript with the given ply record appended. */
export const addPlyRecord = (
  transcript: TrainingTranscript,
  record: PlyRecord,
): TrainingTranscript => ({
  ...transcript,
  plyRecords: [...transcript.plyRecords, record],
});

/** Return a new transcript with the given annotation appended. */
export const addAnnotation = (
  transcript: TrainingTranscript,
  annotation: TrainingAnnotation,
): TrainingTranscript => ({
  ...transcript,
  annotations: [...transcript.annotations, annotation],
});

/** Mark the transcript as completed now. */
export const completeTranscript = (
  transcript: TrainingTranscript,
): TrainingTranscript => ({
  ...transcript,
  completedAt: new Date().toISOString(),
});

/** Mark the transcript as aborted. */
export const abortTranscript = (
  transcript: TrainingTranscript,
): TrainingTranscript => ({
  ...transcript,
  aborted: true,
  completedAt: new Date().toISOString(),
});
