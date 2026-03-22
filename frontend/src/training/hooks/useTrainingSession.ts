/**
 * useTrainingSession — React hook managing the training session state machine.
 *
 * Integration API:
 * - `useTrainingSession(protocol)` — returns session controls and state.
 * - Exposes: `sessionState`, `transcript`, `start`, `submitMove`, `skipMove`,
 *   `requestHint`, `abort`, `confirmResult`.
 *
 * Configuration API:
 * - Protocol is passed at hook creation time. Options are passed to `start()`.
 *
 * Communication API:
 * - Outbound: fires `onComplete(summary, transcript)` when the session ends.
 * - Inbound: board input flows through `submitMove`; the hook validates and
 *   advances the session.
 */

import { useReducer, useCallback, useRef } from "react";
import type { TrainingProtocol, TrainingConfig, TrainingSessionState, UserMoveInput, ResultSummary } from "../domain/training_protocol";
import type { TrainingTranscript } from "../domain/training_transcript";
import {
  createTranscript,
  addPlyRecord,
  addAnnotation,
  completeTranscript,
  abortTranscript,
} from "../domain/training_transcript";
import type { PlyRecord } from "../domain/training_transcript";

// ── State machine types ───────────────────────────────────────────────────────

type HookPhase = "idle" | "in_progress" | "reviewing";

type HookState = {
  phase: HookPhase;
  sessionState: TrainingSessionState | null;
  transcript: TrainingTranscript | null;
  summary: ResultSummary | null;
  lastFeedback: "correct" | "wrong" | "skip" | "legal_variant" | null;
  /** SAN of the correct move when last attempt was wrong. */
  correctMoveSan: string | null;
};

type HookAction =
  | { type: "start"; sessionState: TrainingSessionState; transcript: TrainingTranscript }
  | { type: "advance"; sessionState: TrainingSessionState; transcript: TrainingTranscript; feedback: HookState["lastFeedback"] }
  | { type: "feedback"; feedback: HookState["lastFeedback"]; correctMoveSan: string | null }
  | { type: "review"; summary: ResultSummary; transcript: TrainingTranscript }
  | { type: "idle" };

const reducer = (state: HookState, action: HookAction): HookState => {
  switch (action.type) {
    case "start":
      return {
        phase: "in_progress",
        sessionState: action.sessionState,
        transcript: action.transcript,
        summary: null,
        lastFeedback: null,
        correctMoveSan: null,
      };
    case "advance":
      return {
        ...state,
        sessionState: action.sessionState,
        transcript: action.transcript,
        lastFeedback: action.feedback,
        correctMoveSan: null,
      };
    case "feedback":
      return {
        ...state,
        lastFeedback: action.feedback,
        correctMoveSan: action.correctMoveSan,
      };
    case "review":
      return {
        ...state,
        phase: "reviewing",
        summary: action.summary,
        transcript: action.transcript,
      };
    case "idle":
      return {
        phase: "idle",
        sessionState: null,
        transcript: null,
        summary: null,
        lastFeedback: null,
        correctMoveSan: null,
      };
    default:
      return state;
  }
};

const INITIAL_STATE: HookState = {
  phase: "idle",
  sessionState: null,
  transcript: null,
  summary: null,
  lastFeedback: null,
  correctMoveSan: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export type TrainingSessionControls = {
  phase: HookPhase;
  sessionState: TrainingSessionState | null;
  transcript: TrainingTranscript | null;
  summary: ResultSummary | null;
  lastFeedback: HookState["lastFeedback"];
  correctMoveSan: string | null;

  /** Start a new training session with the given config. */
  start(config: TrainingConfig): void;
  /** Submit a move played on the board. Returns the evaluation feedback. */
  submitMove(move: UserMoveInput): void;
  /** Skip the current move (counts as skipped in transcript). */
  skipMove(): void;
  /** Mark hint used for this move. */
  requestHint(): void;
  /** Abort the session mid-way. */
  abort(): void;
  /** Dismiss the result summary and return to idle. */
  confirmResult(): void;
};

export const useTrainingSession = (
  protocol: TrainingProtocol,
): TrainingSessionControls => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const movePlyStartTimeRef = useRef<number>(Date.now());

  const start = useCallback(
    (config: TrainingConfig): void => {
      const sessionState = protocol.initialize(config);
      const transcript = createTranscript(config);
      movePlyStartTimeRef.current = Date.now();
      dispatch({ type: "start", sessionState, transcript });
    },
    [protocol],
  );

  const submitMove = useCallback(
    (move: UserMoveInput): void => {
      if (!state.sessionState || !state.transcript) return;

      const result = protocol.evaluateMove(move, state.sessionState);
      const timeTaken = Date.now() - movePlyStartTimeRef.current;
      movePlyStartTimeRef.current = Date.now();

      const plyRecord: PlyRecord = {
        ply: state.sessionState.currentSourcePly,
        sourceMoveUci:
          (state.sessionState.protocolState as Record<string, unknown[]>)
            ?.mainlineMoves?.[state.sessionState.currentSourcePly] as string ?? "",
        sourceMoveSan:
          (state.sessionState.protocolState as Record<string, unknown[]>)
            ?.mainlineSans?.[state.sessionState.currentSourcePly] as string ?? "",
        userMoveUci: move.uci,
        userMoveSan: move.san,
        outcome: result.feedback === "correct" || result.feedback === "legal_variant"
          ? result.feedback
          : result.accepted ? "correct" : "wrong",
        attemptsCount: 1,
        timeTakenMs: timeTaken,
      };

      let newTranscript = addPlyRecord(state.transcript, plyRecord);
      if (result.annotation) {
        newTranscript = addAnnotation(newTranscript, {
          ply: state.sessionState.currentSourcePly,
          kind: "variation",
          content: result.annotation,
          source: "protocol",
        });
      }

      if (!result.accepted) {
        dispatch({
          type: "feedback",
          feedback: result.feedback,
          correctMoveSan: result.correctMove?.san ?? null,
        });
        return;
      }

      let newSession: TrainingSessionState = {
        ...state.sessionState,
        correctCount:
          result.feedback === "correct" || result.feedback === "legal_variant"
            ? state.sessionState.correctCount + 1
            : state.sessionState.correctCount,
        wrongCount:
          result.feedback === "wrong"
            ? state.sessionState.wrongCount + 1
            : state.sessionState.wrongCount,
      };
      newSession = protocol.advance(newSession);

      if (protocol.isComplete(newSession)) {
        const finalTranscript = completeTranscript(newTranscript);
        const summary = protocol.summarize(newSession, finalTranscript);
        dispatch({ type: "review", summary, transcript: finalTranscript });
        return;
      }

      dispatch({ type: "advance", sessionState: newSession, transcript: newTranscript, feedback: result.feedback });
    },
    [state.sessionState, state.transcript, protocol],
  );

  const skipMove = useCallback((): void => {
    if (!state.sessionState || !state.transcript) return;

    const timeTaken = Date.now() - movePlyStartTimeRef.current;
    movePlyStartTimeRef.current = Date.now();

    const sourceSan =
      (state.sessionState.protocolState as Record<string, unknown[]>)
        ?.mainlineSans?.[state.sessionState.currentSourcePly] as string ?? "";

    const plyRecord: PlyRecord = {
      ply: state.sessionState.currentSourcePly,
      sourceMoveUci:
        (state.sessionState.protocolState as Record<string, unknown[]>)
          ?.mainlineMoves?.[state.sessionState.currentSourcePly] as string ?? "",
      sourceMoveSan: sourceSan,
      outcome: "skip",
      attemptsCount: 0,
      timeTakenMs: timeTaken,
    };

    const newTranscript = addPlyRecord(state.transcript, plyRecord);
    let newSession: TrainingSessionState = {
      ...state.sessionState,
      skippedCount: state.sessionState.skippedCount + 1,
    };
    newSession = protocol.advance(newSession);

    if (protocol.isComplete(newSession)) {
      const finalTranscript = completeTranscript(newTranscript);
      const summary = protocol.summarize(newSession, finalTranscript);
      dispatch({ type: "review", summary, transcript: finalTranscript });
      return;
    }

    dispatch({ type: "advance", sessionState: newSession, transcript: newTranscript, feedback: "skip" });
  }, [state.sessionState, state.transcript, protocol]);

  const requestHint = useCallback((): void => {
    if (!state.sessionState) return;
    dispatch({
      type: "advance",
      sessionState: {
        ...state.sessionState,
        hintUsedThisMove: true,
        hintsUsed: state.sessionState.hintsUsed + 1,
      },
      transcript: state.transcript!,
      feedback: state.lastFeedback,
    });
  }, [state.sessionState, state.transcript, state.lastFeedback]);

  const abort = useCallback((): void => {
    if (!state.transcript) { dispatch({ type: "idle" }); return; }
    const aborted = abortTranscript(state.transcript);
    if (state.sessionState) {
      const summary = protocol.summarize(state.sessionState, aborted);
      dispatch({ type: "review", summary, transcript: aborted });
    } else {
      dispatch({ type: "idle" });
    }
  }, [state.transcript, state.sessionState, protocol]);

  const confirmResult = useCallback((): void => {
    dispatch({ type: "idle" });
  }, []);

  return {
    phase: state.phase,
    sessionState: state.sessionState,
    transcript: state.transcript,
    summary: state.summary,
    lastFeedback: state.lastFeedback,
    correctMoveSan: state.correctMoveSan,
    start,
    submitMove,
    skipMove,
    requestHint,
    abort,
    confirmResult,
  };
};
