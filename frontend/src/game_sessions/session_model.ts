import { Chess } from "chess.js";
import type { Move } from "chess.js";
import type { GameSessionState } from "./game_session_state";
import type { MovePositionIndex } from "../board/move_position";

/**
 * Session Model module.
 *
 * Integration API:
 * - Primary exports from this module: `createGameSessionModel`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - Pure factory functions; no shared state. Each function receives its inputs
 *   explicitly and returns a new value.
 */

type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult;
}["bivarianceHack"];

type SessionModelDeps = {
  parsePgnToModelFn: (source: string) => unknown;
  serializeModelToPgnFn: BivariantCallback<[model: unknown], string>;
  ensureRequiredPgnHeadersFn: BivariantCallback<[model: unknown], unknown>;
  buildMovePositionByIdFn: BivariantCallback<[model: unknown], Record<string, unknown>>;
  stripAnnotationsForBoardParserFn: (source: string) => string;
  getHeaderValueFn: BivariantCallback<[model: unknown, key: string, fallback: string], string>;
  t: (key: string, fallback?: string) => string;
};

const isRealName = (name: string): boolean =>
  name !== "" && name !== "?" && name !== "White" && name !== "Black";

/**
 * Create game session model helpers.
 *
 * @param {object} deps - Dependencies.
 * @param {Function} deps.parsePgnToModelFn - `(source: string) => object`.
 * @param {Function} deps.serializeModelToPgnFn - `(model: object) => string`.
 * @param {Function} deps.ensureRequiredPgnHeadersFn - `(model: object) => object`.
 * @param {Function} deps.buildMovePositionByIdFn - `(model: object) => Record<string, object>`.
 * @param {Function} deps.stripAnnotationsForBoardParserFn - `(source: string) => string`.
 * @param {Function} deps.getHeaderValueFn - `(model, key, fallback) => string`.
 * @param {Function} deps.t - Translation callback.
 * @returns {{createSessionFromPgnText: Function, deriveSessionTitle: Function}} Helpers.
 */
export const createGameSessionModel = ({
  parsePgnToModelFn,
  serializeModelToPgnFn,
  ensureRequiredPgnHeadersFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  getHeaderValueFn,
  t,
}: SessionModelDeps) => {
  /**
   * Derive session title from PGN headers.
   *
   * @param {object} pgnModel - PGN model.
   * @param {string} fallbackTitle - Fallback title.
   * @returns {string} Human-friendly title.
   */
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
   * Build a new live GameSessionState from PGN text.
   *
   * @param {string} pgnText - Raw PGN source.
   * @returns {GameSessionState} Fully populated session state for the given PGN.
   */
  const createSessionFromPgnText = (pgnText: string): GameSessionState => {
    const pgnModel: unknown = ensureRequiredPgnHeadersFn(parsePgnToModelFn(pgnText));
    const normalizedPgnText: string = serializeModelToPgnFn(pgnModel);
    const movePositionById: MovePositionIndex = buildMovePositionByIdFn(pgnModel) as MovePositionIndex;
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
      pgnModel: pgnModel as GameSessionState["pgnModel"],
      pgnText: normalizedPgnText,
      moves,
      verboseMoves,
      movePositionById,
      pgnLayoutMode: "plain",
      currentPly: 0,
      selectedMoveId: null,
      boardPreview: null,
      animationRunId: 0,
      isAnimating: false,
      errorMessage,
      statusMessage: "",
      pendingFocusCommentId: null,
      undoStack: [],
      redoStack: [],
    };
  };

  return {
    createSessionFromPgnText,
    deriveSessionTitle,
  };
};
