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
import { saveTranscriptBadge } from "../transcript_storage";
import {
  createTranscript,
  addPlyRecord,
  addAnnotation,
  completeTranscript,
  abortTranscript,
} from "../domain/training_transcript";
import type { PlyRecord } from "../domain/training_transcript";

// ── State machine types ───────────────────────────────────────────────────────

type HookPhase = "idle" | "in_progress" | "paused" | "reviewing";

type HookState = {
  phase: HookPhase;
  sessionState: TrainingSessionState | null;
  transcript: TrainingTranscript | null;
  summary: ResultSummary | null;
  lastFeedback: import("../domain/training_protocol").MoveEvalFeedback | null;
  /** SAN of the correct move when last attempt was wrong. */
  correctMoveSan: string | null;
  /** True when the user has already made at least one wrong attempt on the
   *  current ply. A successful retry must still be scored as a failure. */
  failedCurrentMove: boolean;
};

type HookAction =
  | { type: "start"; sessionState: TrainingSessionState; transcript: TrainingTranscript }
  | { type: "advance"; sessionState: TrainingSessionState; transcript: TrainingTranscript; feedback: HookState["lastFeedback"] }
  | { type: "feedback"; feedback: HookState["lastFeedback"]; correctMoveSan: string | null; sessionState?: TrainingSessionState }
  | { type: "hint_used"; sessionState: TrainingSessionState }
  | { type: "review"; summary: ResultSummary; transcript: TrainingTranscript }
  | { type: "pause" }
  | { type: "resume" }
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
        failedCurrentMove: false,
      };
    case "advance":
      return {
        ...state,
        sessionState: action.sessionState,
        transcript: action.transcript,
        lastFeedback: action.feedback,
        correctMoveSan: null,
        failedCurrentMove: false,   // reset for the next ply
      };
    case "feedback":
      return {
        ...state,
        sessionState: action.sessionState ?? state.sessionState,
        lastFeedback: action.feedback,
        correctMoveSan: action.correctMoveSan,
        failedCurrentMove: true,    // mark ply as having at least one failed attempt
      };
    case "hint_used":
      return {
        ...state,
        sessionState: action.sessionState,
        // preserve failedCurrentMove, lastFeedback, correctMoveSan
      };
    case "review":
      return {
        ...state,
        phase: "reviewing",
        summary: action.summary,
        transcript: action.transcript,
      };
    case "pause":
      return { ...state, phase: "paused" };
    case "resume":
      return { ...state, phase: "in_progress" };
    case "idle":
      return {
        phase: "idle",
        sessionState: null,
        transcript: null,
        summary: null,
        lastFeedback: null,
        correctMoveSan: null,
        failedCurrentMove: false,
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
  failedCurrentMove: false,
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
  /** Pause the session (returns to app, pill shown in sessions bar). */
  pause(): void;
  /** Resume a paused session. */
  resume(): void;
  /** Dismiss the result summary and return to idle. */
  confirmResult(): void;
  /** Discard the result — return to idle without saving the badge. */
  discard(): void;
  /**
   * Clear the last-move feedback toast without advancing (used by the retry
   * path so the board can reset to the position before the wrong move).
   */
  clearFeedback(): void;
};

/** Return updated session state with hintsUsed incremented, or undefined if no hint should be charged. */
const chargeHintForWrongMove = (
  sessionState: TrainingSessionState,
): TrainingSessionState | undefined => {
  const opts = sessionState.config.protocolOptions as {
    allowHints?: boolean;
    maxHintsPerGame?: number;
  };
  const maxHints = opts.maxHintsPerGame ?? 3;
  if (opts.allowHints === false || sessionState.hintsUsed >= maxHints) return undefined;
  return { ...sessionState, hintsUsed: sessionState.hintsUsed + 1 };
};

export const useTrainingSession = (
  protocols: TrainingProtocol | TrainingProtocol[],
): TrainingSessionControls => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const movePlyStartTimeRef = useRef<number>(Date.now());
  const protocolsArr = Array.isArray(protocols) ? protocols : [protocols];
  const firstProtocol = protocolsArr[0];
  if (!firstProtocol) throw new Error("useTrainingSession: protocols must not be empty");
  const activeProtocolRef = useRef<TrainingProtocol>(firstProtocol);
  const activeSourceGameRefRef = useRef<string>("");

  // Convenience accessor — always use ref so callbacks don't need to re-create.
  const getProtocol = (): TrainingProtocol => activeProtocolRef.current;

  const start = useCallback(
    (config: TrainingConfig): void => {
      const found = protocolsArr.find((p) => p.id === config.protocol) ?? protocolsArr[0];
      if (found) activeProtocolRef.current = found;
      activeSourceGameRefRef.current = config.sourceGameRef;
      const sessionState = activeProtocolRef.current.initialize(config);
      const transcript = createTranscript(config);
      movePlyStartTimeRef.current = Date.now();
      dispatch({ type: "start", sessionState, transcript });
    },
    // protocolsArr is derived from stable prop — eslint-disable is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const submitMove = useCallback(
    (move: UserMoveInput): void => {
      if (!state.sessionState || !state.transcript) return;

      const result = getProtocol().evaluateMove(move, state.sessionState);

      if (!result.accepted) {
        // Don't advance the timer — time is measured from when the position
        // was first shown until the move is finally accepted.
        //
        // First wrong attempt at this ply costs one hint from the budget.
        const feedbackSessionState = state.failedCurrentMove
          ? undefined
          : chargeHintForWrongMove(state.sessionState);
        dispatch({
          type: "feedback",
          feedback: result.feedback,
          correctMoveSan: result.correctMove?.san ?? null,
          sessionState: feedbackSessionState,
        });
        return;
      }

      // Move accepted — measure elapsed time and reset clock for next ply.
      const timeTaken = Date.now() - movePlyStartTimeRef.current;
      movePlyStartTimeRef.current = Date.now();

      // A prior failed attempt on this ply forces the outcome to "wrong"
      // regardless of how good the eventual move was.
      const hadFailure = state.failedCurrentMove;
      const acceptedFeedbacks = new Set(["correct", "correct_better", "correct_dubious", "legal_variant", "inferior"]);
      const baseFeedback = acceptedFeedbacks.has(result.feedback) ? result.feedback : "correct";
      const effectiveOutcome: PlyRecord["outcome"] = hadFailure ? "wrong" : baseFeedback;

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
        outcome: effectiveOutcome,
        attemptsCount: hadFailure ? 2 : 1,
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

      let newSession: TrainingSessionState = {
        ...state.sessionState,
        correctCount: (!hadFailure && effectiveOutcome !== "wrong")
          ? state.sessionState.correctCount + 1
          : state.sessionState.correctCount,
        wrongCount: (hadFailure || effectiveOutcome === "wrong")
          ? state.sessionState.wrongCount + 1
          : state.sessionState.wrongCount,
      };
      newSession = getProtocol().advance(newSession);

      if (getProtocol().isComplete(newSession)) {
        const finalTranscript = completeTranscript(newTranscript);
        const summary = getProtocol().summarize(newSession, finalTranscript);
        dispatch({ type: "review", summary, transcript: finalTranscript });
        return;
      }

      dispatch({ type: "advance", sessionState: newSession, transcript: newTranscript, feedback: result.feedback });
    },
    [state.sessionState, state.transcript, state.failedCurrentMove],
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
    newSession = getProtocol().advance(newSession);

    if (getProtocol().isComplete(newSession)) {
      const finalTranscript = completeTranscript(newTranscript);
      const summary = getProtocol().summarize(newSession, finalTranscript);
      dispatch({ type: "review", summary, transcript: finalTranscript });
      return;
    }

    dispatch({ type: "advance", sessionState: newSession, transcript: newTranscript, feedback: "skip" });
  }, [state.sessionState, state.transcript]);

  const requestHint = useCallback((): void => {
    if (!state.sessionState) return;
    dispatch({
      type: "hint_used",
      sessionState: {
        ...state.sessionState,
        hintUsedThisMove: true,
        hintsUsed: state.sessionState.hintsUsed + 1,
      },
    });
  }, [state.sessionState]);

  const pause = useCallback((): void => {
    dispatch({ type: "pause" });
  }, []);

  const resume = useCallback((): void => {
    dispatch({ type: "resume" });
  }, []);

  const abort = useCallback((): void => {
    if (!state.transcript) { dispatch({ type: "idle" }); return; }
    const aborted = abortTranscript(state.transcript);
    if (state.sessionState) {
      const summary = getProtocol().summarize(state.sessionState, aborted);
      dispatch({ type: "review", summary, transcript: aborted });
    } else {
      dispatch({ type: "idle" });
    }
  }, [state.transcript, state.sessionState]);

  const clearFeedback = useCallback((): void => {
    dispatch({ type: "feedback", feedback: null, correctMoveSan: null });
  }, []);

  const confirmResult = useCallback((): void => {
    if (state.summary && activeSourceGameRefRef.current) {
      const s = state.summary;
      saveTranscriptBadge(
        activeSourceGameRefRef.current,
        s.scorePercent,
        activeProtocolRef.current.id,
        { correct: s.correct, wrong: s.wrong, skipped: s.skipped, total: s.total, gradeLabel: s.gradeLabel },
      );
    }
    dispatch({ type: "idle" });
  }, [state.summary]);

  const discard = useCallback((): void => {
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
    pause,
    resume,
    confirmResult,
    discard,
    clearFeedback,
  };
};
