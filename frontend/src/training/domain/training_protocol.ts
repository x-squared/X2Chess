/**
 * training_protocol — TrainingProtocol interface and related lifecycle types.
 *
 * Integration API:
 * - `TrainingProtocol` interface to implement for custom protocols.
 * - `TrainingConfig`, `UserMoveInput`, `MoveEvalResult`, `TrainingSessionState`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure type definitions; no side effects.
 */

// ── User input ─────────────────────────────────────────────────────────────────

export type UserMoveInput = {
  /** UCI format, e.g. "e2e4" or "e7e8q" for promotion. */
  uci: string;
  /** SAN format, e.g. "e4" or "e8=Q". */
  san: string;
  /** Wall-clock timestamp in milliseconds (Date.now()). */
  timestamp: number;
};

// ── Move evaluation ───────────────────────────────────────────────────────────

export type MoveEvalFeedback =
  | "correct"          // user played the canonical best move
  | "correct_better"   // user played a move better than the (flawed) game move
  | "correct_dubious"  // user played the game move but a better option exists
  | "legal_variant"    // accepted equivalent alternative
  | "inferior"         // dubious but real — matched a ?! RAV
  | "wrong"            // not accepted; canonical move is shown
  | "skip";

export type MoveEvalResult = {
  accepted: boolean;
  feedback: MoveEvalFeedback;
  /** The canonical best move — provided whenever the user did not play it. */
  correctMove?: { uci: string; san: string };
  /**
   * A strictly better move exists even though the user's move was accepted.
   * Set when the user plays the game move but it is annotated ?! or worse.
   */
  betterMoveExists?: { uci: string; san: string; annotation?: string };
  /** Explanatory text for the feedback overlay. */
  annotation?: string;
};

// ── Session state ─────────────────────────────────────────────────────────────

export type TrainingConfig = {
  /** PGN game reference as a string key. */
  sourceGameRef: string;
  /** Resolved PGN text at launch time. */
  pgnText: string;
  /** Protocol identifier, e.g. "replay". */
  protocol: string;
  /** Protocol-specific options. */
  protocolOptions: Record<string, unknown>;
};

/** The current FEN and move list for the training board (read-only shadow). */
export type TrainingPosition = {
  fen: string;
  /** UCI move list from the source game's starting position. */
  moveHistory: string[];
  /** Current ply index within the game. */
  ply: number;
  /** Total number of user-side plies. */
  totalUserPlies: number;
};

export type TrainingPhase = "idle" | "in_progress" | "reviewing";

export type TrainingSessionState = {
  phase: TrainingPhase;
  config: TrainingConfig;
  position: TrainingPosition;
  /** Number of moves the user got correct so far. */
  correctCount: number;
  /** Number of moves the user got wrong so far. */
  wrongCount: number;
  /** Number of moves skipped. */
  skippedCount: number;
  /** Index of the source-game ply that is the current user target. */
  currentSourcePly: number;
  /** Whether the engine hint was used for the current move. */
  hintUsedThisMove: boolean;
  /** Total hints used. */
  hintsUsed: number;
  /** Timestamp when training started. */
  startedAt: number;
  /** Protocol-specific mutable data. */
  protocolState: Record<string, unknown>;
};

// ── Result summary ─────────────────────────────────────────────────────────────

export type ResultHighlight = {
  ply: number;
  kind: "best_move" | "blunder" | "comeback" | "flawless_streak";
  description: string;
};

export type ResultSummary = {
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  /** correct / (total - skipped) × 100, or 0 if no scored moves. */
  scorePercent: number;
  avgTimeMsPerMove?: number;
  gradeLabel: string;
  highlights: ResultHighlight[];
};

// ── Protocol interface ─────────────────────────────────────────────────────────

export interface TrainingProtocol {
  readonly id: string;
  readonly label: string;
  readonly description: string;

  /** Called once when the session starts. Returns the initial session state. */
  initialize(config: TrainingConfig): TrainingSessionState;

  /**
   * Called for each move the user attempts.
   * Returns an accept/reject decision and feedback to display.
   */
  evaluateMove(
    move: UserMoveInput,
    state: TrainingSessionState,
  ): MoveEvalResult;

  /**
   * Called after `evaluateMove` accepted a move.
   * Returns the updated state with the position advanced.
   */
  advance(state: TrainingSessionState): TrainingSessionState;

  /** True when the session is over. */
  isComplete(state: TrainingSessionState): boolean;

  /** Compute the final result summary. */
  summarize(
    state: TrainingSessionState,
    transcript: import("./training_transcript").TrainingTranscript,
  ): ResultSummary;
}
