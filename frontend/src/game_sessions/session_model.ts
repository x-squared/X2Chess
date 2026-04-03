import { Chess } from "chess.js";
import type { Move } from "chess.js";

/**
 * Session Model module.
 *
 * Integration API:
 * - Primary exports from this module: `createGameSessionModel`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type SessionHistorySnapshot = {
  pgnModel: unknown;
  pgnText: string;
  currentPly: number;
  selectedMoveId: unknown | null;
};

type SessionSnapshot = {
  pgnModel: unknown;
  pgnText: string;
  moves: string[];
  verboseMoves: Move[];
  currentPly: number;
  movePositionById: Record<string, unknown>;
  boardPreview: Record<string, unknown> | null;
  selectedMoveId: unknown | null;
  errorMessage: string;
  statusMessage: string;
  undoStack: SessionHistorySnapshot[];
  redoStack: SessionHistorySnapshot[];
};

type SessionModelState = {
  pgnModel: unknown;
  pgnText: string;
  moves: string[];
  verboseMoves: Move[];
  currentPly: number;
  movePositionById: Record<string, unknown>;
  boardPreview: Record<string, unknown> | null;
  selectedMoveId: unknown | null;
  errorMessage: string;
  statusMessage: string;
  undoStack: SessionHistorySnapshot[];
  redoStack: SessionHistorySnapshot[];
};

type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult;
}["bivarianceHack"];

type SessionModelDeps = {
  state: Record<string, unknown>;
  pgnInput: Element | null;
  parsePgnToModelFn: (source: string) => unknown;
  serializeModelToPgnFn: BivariantCallback<[model: unknown], string>;
  ensureRequiredPgnHeadersFn: BivariantCallback<[model: unknown], unknown>;
  buildMovePositionByIdFn: BivariantCallback<[model: unknown], Record<string, unknown>>;
  stripAnnotationsForBoardParserFn: (source: string) => string;
  getHeaderValueFn: BivariantCallback<[model: unknown, key: string, fallback: string], string>;
  t: (key: string, fallback?: string) => string;
};

const cloneModelState = <TValue>(model: TValue): TValue => JSON.parse(JSON.stringify(model)) as TValue;

const isRecordLike = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";

const toSessionHistorySnapshot = (value: unknown): SessionHistorySnapshot => {
  if (!isRecordLike(value)) {
    return {
      pgnModel: null,
      pgnText: "",
      currentPly: 0,
      selectedMoveId: null,
    };
  }
  const pgnText: string = typeof value.pgnText === "string" ? value.pgnText : "";
  const currentPly: number = typeof value.currentPly === "number" ? value.currentPly : 0;
  const selectedMoveId: unknown | null = "selectedMoveId" in value ? (value.selectedMoveId ?? null) : null;
  return {
    pgnModel: cloneModelState(value.pgnModel),
    pgnText,
    currentPly,
    selectedMoveId,
  };
};

const toSessionSnapshot = (value: unknown): SessionSnapshot => {
  if (!isRecordLike(value)) {
    return {
      pgnModel: null,
      pgnText: "",
      moves: [],
      verboseMoves: [],
      currentPly: 0,
      movePositionById: {},
      boardPreview: null,
      selectedMoveId: null,
      errorMessage: "",
      statusMessage: "",
      undoStack: [],
      redoStack: [],
    };
  }
  const movePositionById: Record<string, unknown> = isRecordLike(value.movePositionById) ? { ...value.movePositionById } : {};
  const boardPreview: Record<string, unknown> | null = isRecordLike(value.boardPreview) ? { ...value.boardPreview } : null;
  const moves: string[] = Array.isArray(value.moves) ? value.moves.filter((entry: unknown): entry is string => typeof entry === "string") : [];
  const verboseMoves: Move[] = Array.isArray(value.verboseMoves) ? (value.verboseMoves as Move[]) : [];
  const undoStack: SessionHistorySnapshot[] = Array.isArray(value.undoStack)
    ? value.undoStack.map((entry: unknown): SessionHistorySnapshot => toSessionHistorySnapshot(entry))
    : [];
  const redoStack: SessionHistorySnapshot[] = Array.isArray(value.redoStack)
    ? value.redoStack.map((entry: unknown): SessionHistorySnapshot => toSessionHistorySnapshot(entry))
    : [];
  return {
    pgnModel: cloneModelState(value.pgnModel),
    pgnText: typeof value.pgnText === "string" ? value.pgnText : "",
    moves: [...moves],
    verboseMoves: [...verboseMoves],
    currentPly: typeof value.currentPly === "number" ? value.currentPly : 0,
    movePositionById,
    boardPreview,
    selectedMoveId: "selectedMoveId" in value ? (value.selectedMoveId ?? null) : null,
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : "",
    statusMessage: typeof value.statusMessage === "string" ? value.statusMessage : "",
    undoStack,
    redoStack,
  };
};

/**
 * Create game session model helpers.
 *
 * @param {object} deps - Dependencies.
 * @param {object} deps.state - Shared runtime state.
 * @param {HTMLTextAreaElement|null} deps.pgnInput - PGN textarea.
 * @param {Function} deps.parsePgnToModelFn - `(source: string) => object`.
 * @param {Function} deps.serializeModelToPgnFn - `(model: object) => string`.
 * @param {Function} deps.ensureRequiredPgnHeadersFn - `(model: object) => object`.
 * @param {Function} deps.buildMovePositionByIdFn - `(model: object) => Record<string, object>`.
 * @param {Function} deps.stripAnnotationsForBoardParserFn - `(source: string) => string`.
 * @param {Function} deps.getHeaderValueFn - `(model, key, fallback) => string`.
 * @param {Function} deps.t - Translation callback.
 * @returns {{applySessionSnapshotToState: Function, captureActiveSessionSnapshot: Function, createSessionFromPgnText: Function, disposeSessionSnapshot: Function, deriveSessionTitle: Function}} Helpers.
 */
export const createGameSessionModel = ({
  state,
  pgnInput,
  parsePgnToModelFn,
  serializeModelToPgnFn,
  ensureRequiredPgnHeadersFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  getHeaderValueFn,
  t,
}: SessionModelDeps) => {
  const runtimeState: SessionModelState = state as SessionModelState;
  /**
   * Capture active editor runtime as session snapshot.
   *
   * @returns {object} Captured snapshot.
   */
  const captureActiveSessionSnapshot = (): SessionSnapshot => ({
    pgnModel: cloneModelState(runtimeState.pgnModel),
    pgnText: runtimeState.pgnText,
    moves: [...runtimeState.moves],
    verboseMoves: [...runtimeState.verboseMoves],
    currentPly: runtimeState.currentPly,
    movePositionById: { ...runtimeState.movePositionById },
    boardPreview: runtimeState.boardPreview ? { ...runtimeState.boardPreview } : null,
    selectedMoveId: runtimeState.selectedMoveId,
    errorMessage: runtimeState.errorMessage,
    statusMessage: runtimeState.statusMessage,
    undoStack: runtimeState.undoStack.map((snapshot: SessionHistorySnapshot): SessionHistorySnapshot => ({
      pgnModel: cloneModelState(snapshot.pgnModel),
      pgnText: snapshot.pgnText,
      currentPly: snapshot.currentPly,
      selectedMoveId: snapshot.selectedMoveId,
    })),
    redoStack: runtimeState.redoStack.map((snapshot: SessionHistorySnapshot): SessionHistorySnapshot => ({
      pgnModel: cloneModelState(snapshot.pgnModel),
      pgnText: snapshot.pgnText,
      currentPly: snapshot.currentPly,
      selectedMoveId: snapshot.selectedMoveId,
    })),
  });

  /**
   * Apply session snapshot to active runtime state.
   *
   * @param {object} snapshot - Session snapshot.
   */
  const applySessionSnapshotToState = (snapshot: unknown): void => {
    const normalizedSnapshot: SessionSnapshot = toSessionSnapshot(snapshot);
    runtimeState.pgnModel = cloneModelState(normalizedSnapshot.pgnModel);
    runtimeState.pgnText = normalizedSnapshot.pgnText;
    runtimeState.moves = [...normalizedSnapshot.moves];
    runtimeState.verboseMoves = [...normalizedSnapshot.verboseMoves];
    runtimeState.currentPly = normalizedSnapshot.currentPly;
    runtimeState.movePositionById = { ...normalizedSnapshot.movePositionById };
    runtimeState.boardPreview = normalizedSnapshot.boardPreview ? { ...normalizedSnapshot.boardPreview } : null;
    runtimeState.selectedMoveId = normalizedSnapshot.selectedMoveId ?? null;
    runtimeState.errorMessage = normalizedSnapshot.errorMessage;
    runtimeState.statusMessage = normalizedSnapshot.statusMessage;
    runtimeState.undoStack = normalizedSnapshot.undoStack.map((entry: SessionHistorySnapshot): SessionHistorySnapshot => ({
      pgnModel: cloneModelState(entry.pgnModel),
      pgnText: entry.pgnText,
      currentPly: entry.currentPly,
      selectedMoveId: entry.selectedMoveId,
    }));
    runtimeState.redoStack = normalizedSnapshot.redoStack.map((entry: SessionHistorySnapshot): SessionHistorySnapshot => ({
      pgnModel: cloneModelState(entry.pgnModel),
      pgnText: entry.pgnText,
      currentPly: entry.currentPly,
      selectedMoveId: entry.selectedMoveId,
    }));
    if (pgnInput instanceof HTMLTextAreaElement) pgnInput.value = runtimeState.pgnText;
  };

  /**
   * Derive session title from PGN headers.
   *
   * @param {object} pgnModel - PGN model.
   * @param {string} fallbackTitle - Fallback title.
   * @returns {string} Human-friendly title.
   */
  const isRealName = (name: string): boolean =>
    name !== "" && name !== "?" && name !== "White" && name !== "Black";

  const deriveSessionTitle = (pgnModel: unknown, fallbackTitle: string): string => {
    const white: string = getHeaderValueFn(pgnModel, "White", "").trim();
    const black: string = getHeaderValueFn(pgnModel, "Black", "").trim();
    if (isRealName(white) && isRealName(black)) return `${white} - ${black}`;
    if (isRealName(white)) return white;
    if (isRealName(black)) return black;
    const eventName: string = getHeaderValueFn(pgnModel, "Event", "").trim();
    if (eventName && eventName !== "?" && eventName !== "Sample") return eventName;
    return fallbackTitle;
  };

  /**
   * Build new session snapshot from PGN text.
   *
   * @param {string} pgnText - Raw PGN source.
   * @returns {object} Session snapshot.
   */
  const createSessionFromPgnText = (pgnText: string): SessionSnapshot => {
    const pgnModel: unknown = ensureRequiredPgnHeadersFn(parsePgnToModelFn(pgnText));
    const normalizedPgnText: string = serializeModelToPgnFn(pgnModel);
    const movePositionById: Record<string, unknown> = buildMovePositionByIdFn(pgnModel);
    let moves: string[] = [];
    let verboseMoves: Move[] = [];
    let errorMessage: string = "";
    try {
      const parser: Chess = new Chess();
      parser.loadPgn(normalizedPgnText);
      moves = parser.history();
      verboseMoves = parser.history({ verbose: true });
    } catch {
      try {
        const parser: Chess = new Chess();
        parser.loadPgn(stripAnnotationsForBoardParserFn(normalizedPgnText));
        moves = parser.history();
        verboseMoves = parser.history({ verbose: true });
      } catch {
        errorMessage = t("pgn.error", "Unable to parse PGN.");
      }
    }
    return {
      pgnModel,
      pgnText: normalizedPgnText,
      moves,
      verboseMoves,
      currentPly: 0,
      movePositionById,
      boardPreview: null,
      selectedMoveId: null,
      errorMessage,
      statusMessage: "",
      undoStack: [],
      redoStack: [],
    };
  };

  /**
   * Dispose session snapshot internals.
   *
   * @param {object} snapshot - Session snapshot.
   */
  const disposeSessionSnapshot = (snapshot: unknown): void => {
    if (!isRecordLike(snapshot)) return;
    snapshot.pgnModel = null;
    snapshot.pgnText = "";
    snapshot.moves = [];
    snapshot.verboseMoves = [];
    snapshot.movePositionById = {};
    snapshot.undoStack = [];
    snapshot.redoStack = [];
  };

  return {
    applySessionSnapshotToState,
    captureActiveSessionSnapshot,
    createSessionFromPgnText,
    deriveSessionTitle,
    disposeSessionSnapshot,
  };
};
