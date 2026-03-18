import { Chess } from "chess.js";

/**
 * Editor PGN runtime component.
 *
 * Integration API:
 * - `createPgnRuntimeCapabilities(deps)` returns PGN parse/load/update methods.
 *
 * Configuration API:
 * - Uses caller-provided parser/serializer and default PGN text.
 *
 * Communication API:
 * - Mutates shared state and invokes callbacks for render/history/autosave.
 */

/**
 * Create PGN runtime capabilities for parsing, loading, and model updates.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {HTMLTextAreaElement|null} deps.pgnInput - PGN textarea element.
 * @param {Function} deps.t - Translation function `(key, fallback) => string`.
 * @param {string} deps.defaultPgn - Default PGN text used for initialization.
 * @param {Function} deps.parsePgnToModelFn - Callback `(source: string) => object`.
 * @param {Function} deps.serializeModelToPgnFn - Callback `(model: object) => string`.
 * @param {Function} deps.buildMovePositionByIdFn - Callback `(model: object) => Record<string, object>`.
 * @param {Function} deps.stripAnnotationsForBoardParserFn - Callback `(source: string) => string`.
 * @param {Function} deps.onRender - Callback to re-render UI.
 * @param {Function} deps.onRecordHistory - Callback invoked before mutating text/model when history should be recorded.
 * @param {Function} deps.onScheduleAutosave - Callback invoked after model updates.
 * @returns {{applyPgnModelUpdate: Function, initializeWithDefaultPgn: Function, loadPgn: Function, syncChessParseState: Function}} Runtime capabilities.
 */
export const createPgnRuntimeCapabilities = ({
  state,
  pgnInput,
  t,
  defaultPgn,
  parsePgnToModelFn,
  serializeModelToPgnFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  onRender,
  onRecordHistory,
  onScheduleAutosave,
}) => {
  /**
   * Synchronize chess-derived runtime fields from PGN source text.
   *
   * @param {string} source - PGN source text.
   * @param {{clearOnFailure?: boolean}} options - Sync options.
   */
  const syncChessParseState = (source, { clearOnFailure = false } = {}) => {
    if (!source) {
      state.moves = [];
      state.verboseMoves = [];
      state.currentPly = 0;
      state.movePositionById = {};
      state.boardPreview = null;
      state.selectedMoveId = null;
      state.errorMessage = "";
      return;
    }
    try {
      const parser = new Chess();
      parser.loadPgn(source);
      state.moves = parser.history();
      state.verboseMoves = parser.history({ verbose: true });
      state.currentPly = Math.min(state.currentPly, state.moves.length);
      state.movePositionById = buildMovePositionByIdFn(state.pgnModel);
      if (state.selectedMoveId && !state.movePositionById[state.selectedMoveId]) state.selectedMoveId = null;
      state.boardPreview = null;
      state.errorMessage = "";
    } catch {
      try {
        const fallbackParser = new Chess();
        fallbackParser.loadPgn(stripAnnotationsForBoardParserFn(source));
        state.moves = fallbackParser.history();
        state.verboseMoves = fallbackParser.history({ verbose: true });
        state.currentPly = Math.min(state.currentPly, state.moves.length);
        state.movePositionById = buildMovePositionByIdFn(state.pgnModel);
        if (state.selectedMoveId && !state.movePositionById[state.selectedMoveId]) state.selectedMoveId = null;
        state.boardPreview = null;
        state.errorMessage = "";
      } catch {
        if (clearOnFailure) {
          state.errorMessage = "";
        } else {
          state.errorMessage = t("pgn.error", "Unable to parse PGN.");
          state.moves = [];
          state.verboseMoves = [];
          state.currentPly = 0;
          state.movePositionById = {};
          state.boardPreview = null;
          state.selectedMoveId = null;
        }
      }
    }
  };

  /**
   * Apply PGN model update, serialize text, sync parse state, autosave, and render.
   *
   * @param {object} nextModel - Next PGN model.
   * @param {string|null} focusCommentId - Optional comment id to focus after render.
   * @param {{recordHistory?: boolean}} options - Update options.
   */
  const applyPgnModelUpdate = (nextModel, focusCommentId = null, { recordHistory = true } = {}) => {
    const nextPgnText = serializeModelToPgnFn(nextModel);
    if (recordHistory && nextPgnText !== state.pgnText) {
      onRecordHistory();
    }
    state.pgnModel = nextModel;
    state.pgnText = nextPgnText;
    if (pgnInput) pgnInput.value = state.pgnText;
    if (focusCommentId) state.pendingFocusCommentId = focusCommentId;
    syncChessParseState(state.pgnText);
    onScheduleAutosave();
    onRender();
  };

  /**
   * Parse current PGN input into model and refresh runtime state.
   */
  const loadPgn = () => {
    state.animationRunId += 1;
    state.isAnimating = false;
    const source = pgnInput ? pgnInput.value.trim() : "";
    state.pgnText = source;
    state.pgnModel = parsePgnToModelFn(source);
    syncChessParseState(source);
    state.statusMessage = state.errorMessage ? "" : t("pgn.loaded", "PGN loaded.");
    onRender();
  };

  /**
   * Initialize textarea and model from default PGN.
   */
  const initializeWithDefaultPgn = () => {
    if (pgnInput) pgnInput.value = defaultPgn;
    loadPgn();
  };

  return {
    applyPgnModelUpdate,
    initializeWithDefaultPgn,
    loadPgn,
    syncChessParseState,
  };
};
