import { Chess } from "chess.js";

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
}: any): any => {
  const cloneModelState = (model: any): any => JSON.parse(JSON.stringify(model));

  /**
   * Capture active editor runtime as session snapshot.
   *
   * @returns {object} Captured snapshot.
   */
  const captureActiveSessionSnapshot = (): any => ({
    pgnModel: cloneModelState(state.pgnModel),
    pgnText: state.pgnText,
    moves: [...state.moves],
    verboseMoves: [...state.verboseMoves],
    currentPly: state.currentPly,
    movePositionById: { ...state.movePositionById },
    boardPreview: state.boardPreview ? { ...state.boardPreview } : null,
    selectedMoveId: state.selectedMoveId,
    errorMessage: state.errorMessage,
    statusMessage: state.statusMessage,
    undoStack: state.undoStack.map((snapshot: any): any => ({
      pgnModel: cloneModelState(snapshot.pgnModel),
      pgnText: snapshot.pgnText,
      currentPly: snapshot.currentPly,
      selectedMoveId: snapshot.selectedMoveId,
    })),
    redoStack: state.redoStack.map((snapshot: any): any => ({
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
  const applySessionSnapshotToState = (snapshot: any): any => {
    state.pgnModel = cloneModelState(snapshot.pgnModel);
    state.pgnText = snapshot.pgnText;
    state.moves = [...snapshot.moves];
    state.verboseMoves = [...snapshot.verboseMoves];
    state.currentPly = snapshot.currentPly;
    state.movePositionById = { ...snapshot.movePositionById };
    state.boardPreview = snapshot.boardPreview ? { ...snapshot.boardPreview } : null;
    state.selectedMoveId = snapshot.selectedMoveId ?? null;
    state.errorMessage = snapshot.errorMessage || "";
    state.statusMessage = snapshot.statusMessage || "";
    state.undoStack = snapshot.undoStack.map((entry: any): any => ({
      pgnModel: cloneModelState(entry.pgnModel),
      pgnText: entry.pgnText,
      currentPly: entry.currentPly,
      selectedMoveId: entry.selectedMoveId,
    }));
    state.redoStack = snapshot.redoStack.map((entry: any): any => ({
      pgnModel: cloneModelState(entry.pgnModel),
      pgnText: entry.pgnText,
      currentPly: entry.currentPly,
      selectedMoveId: entry.selectedMoveId,
    }));
    if (pgnInput) pgnInput.value = state.pgnText;
  };

  /**
   * Derive session title from PGN headers.
   *
   * @param {object} pgnModel - PGN model.
   * @param {string} fallbackTitle - Fallback title.
   * @returns {string} Human-friendly title.
   */
  const deriveSessionTitle = (pgnModel: any, fallbackTitle: any): any => {
    const white = getHeaderValueFn(pgnModel, "White", "").trim();
    const black = getHeaderValueFn(pgnModel, "Black", "").trim();
    if (white && black) return `${white} - ${black}`;
    const eventName = getHeaderValueFn(pgnModel, "Event", "").trim();
    if (eventName) return eventName;
    return fallbackTitle;
  };

  /**
   * Build new session snapshot from PGN text.
   *
   * @param {string} pgnText - Raw PGN source.
   * @returns {object} Session snapshot.
   */
  const createSessionFromPgnText = (pgnText: any): any => {
    const pgnModel = ensureRequiredPgnHeadersFn(parsePgnToModelFn(pgnText));
    const normalizedPgnText = serializeModelToPgnFn(pgnModel);
    const movePositionById = buildMovePositionByIdFn(pgnModel);
    let moves: string[] = [];
    let verboseMoves: import("chess.js").Move[] = [];
    let errorMessage = "";
    try {
      const parser = new Chess();
      parser.loadPgn(normalizedPgnText);
      moves = parser.history();
      verboseMoves = parser.history({ verbose: true });
    } catch {
      try {
        const parser = new Chess();
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
  const disposeSessionSnapshot = (snapshot: any): any => {
    if (!snapshot) return;
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

