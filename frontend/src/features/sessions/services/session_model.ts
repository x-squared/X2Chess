import { Chess } from "chess.js";
import type { Move } from "chess.js";
import type { GameSessionState } from "./game_session_state";
import type { MovePositionIndex } from "../../../board/move_position";
import {
  getHeaderValue,
  normalizeForChessJs,
  normalizeX2StyleValue,
  X2_STYLE_HEADER_KEY,
  LEGACY_X2_STYLE_HEADER_KEY,
} from "../../../../../parts/pgnparser/src/pgn_headers";
import { log } from "../../../logger";

/** Walk mainline entries from pgnModel.root and return their SANs. */
const extractMainlineSans = (pgnModel: unknown): string[] => {
  const entries = (pgnModel as { root?: { entries?: Array<{ type?: string; san?: string }> } })
    ?.root?.entries ?? [];
  const sans: string[] = [];
  for (const entry of entries) {
    if (entry.type === "move" && entry.san) sans.push(entry.san);
  }
  return sans;
};

/**
 * Apply SANs one-by-one from a FEN start and return the 0-based index of the
 * first move chess.js rejects, or -1 when the FEN itself is the problem.
 */
const findFirstFailingSan = (fenHeader: string, mainlineSans: string[]): number => {
  let probe: Chess;
  try {
    probe = fenHeader === "(none)" ? new Chess() : new Chess(fenHeader);
  } catch {
    return -1;
  }
  for (let i = 0; i < mainlineSans.length; i++) {
    try { probe.move(mainlineSans[i]); } catch { return i; }
  }
  return -1;
};

/** Log a detailed diagnostic when chess.js rejects a PGN both raw and stripped. */
const logChessJsRejection = (pgnModel: unknown, primaryErr: unknown, fallbackErr: unknown): void => {
  const fenHeader = getHeaderValue(pgnModel as Parameters<typeof getHeaderValue>[0], "FEN") || "(none)";
  const mainlineSans = extractMainlineSans(pgnModel);
  const firstFailIndex = findFirstFailingSan(fenHeader, mainlineSans);
  const failDetail = firstFailIndex >= 0
    ? `move index ${firstFailIndex} ("${mainlineSans[firstFailIndex]}")`
    : "FEN itself rejected";
  log.warn(
    "session_model",
    `createSessionFromPgnText: chess.js rejected the PGN (both attempts failed). ` +
    `FEN="${fenHeader}" primaryErr="${String(primaryErr)}" fallbackErr="${String(fallbackErr)}" ` +
    `mainlineSans=[${mainlineSans.join(", ")}] firstFail=${failDetail}.`,
  );
};

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
  bivarianceHack(...args: TArgs): TResult;
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
      parser.loadPgn(normalizeForChessJs(normalizedPgnText));
      moves = parser.history();
      verboseMoves = parser.history({ verbose: true });
      const mainlineCount = Object.values(movePositionById).filter(r => r.mainlinePly !== null).length;
      if (moves.length !== mainlineCount) {
        log.warn(
          "session_model",
          `createSessionFromPgnText (primary): chess.js mainline move count (${moves.length}) differs from ` +
          `movePositionById mainline entry count (${mainlineCount}). ` +
          `Likely cause: [FEN] game where chess.js and the custom parser disagree on moves. ` +
          `gotoPly() will clamp clicks to chess.js move count — some mainline moves will not navigate.`,
        );
      }
    } catch (primaryErr) {
      try {
        const parser: Chess = new Chess();
        parser.loadPgn(normalizeForChessJs(stripAnnotationsForBoardParserFn(normalizedPgnText)));
        moves = parser.history();
        verboseMoves = parser.history({ verbose: true });
        const mainlineCountFallback = Object.values(movePositionById).filter(r => r.mainlinePly !== null).length;
        if (moves.length !== mainlineCountFallback) {
          log.warn(
            "session_model",
            `createSessionFromPgnText (fallback): chess.js mainline move count (${moves.length}) differs from ` +
            `movePositionById mainline entry count (${mainlineCountFallback}). ` +
            `Likely cause: [FEN] game where chess.js and the custom parser disagree on moves. ` +
            `gotoPly() will clamp clicks to chess.js move count — some mainline moves will not navigate.`,
          );
        }
      } catch (fallbackErr) {
        errorMessage = t("pgn.error", "Unable to parse PGN.");
        logChessJsRejection(pgnModel, primaryErr, fallbackErr);
      }
    }
    return {
      pgnModel: pgnModel as GameSessionState["pgnModel"],
      pgnText: normalizedPgnText,
      moves,
      verboseMoves,
      movePositionById,
      pgnLayoutMode: normalizeX2StyleValue(
        getHeaderValueFn(pgnModel, X2_STYLE_HEADER_KEY, "")
        || getHeaderValueFn(pgnModel, LEGACY_X2_STYLE_HEADER_KEY, ""),
      ),
      currentPly: 0,
      selectedMoveId: null,
      boardPreview: null,
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
