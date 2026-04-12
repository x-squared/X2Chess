import { Chess } from "chess.js";
import type { ActiveSessionRef } from "../game_sessions/game_session_state";
import type { MovePositionIndex } from "../board/move_position";
import { normalizeForChessJs } from "../../../parts/pgnparser/src/pgn_headers";
import { log } from "../logger";

/**
 * Pgn Runtime module.
 *
 * Integration API:
 * - Primary exports from this module: `createPgnRuntimeCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `sessionRef`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - State changes are reported via typed callbacks rather than a generic `onRender`.
 *   The host wires these to the appropriate dispatch calls.
 */

type SyncChessOptions = {
  clearOnFailure?: boolean;
};

type ApplyPgnModelUpdateOptions = {
  recordHistory?: boolean;
};

type PgnRuntimeDeps = {
  sessionRef: ActiveSessionRef;
  pgnInput: Element | null;
  t: (key: string, fallback?: string) => string;
  defaultPgn: string;
  parsePgnToModelFn: (source: string) => unknown;
  serializeModelToPgnFn: (model: unknown) => string;
  buildMovePositionByIdFn: (model: unknown) => Record<string, unknown>;
  stripAnnotationsForBoardParserFn: (source: string) => string;
  /** Called after PGN/session state changes and should be mirrored to React state. */
  onPgnChange: (pgnText: string, pgnModel: unknown, moves: string[]) => void;
  /** Called to set the status bar message (success/informational). */
  onStatusChange: (message: string) => void;
  /** Called to set the error bar message (parse errors). */
  onErrorChange: (message: string) => void;
  onRecordHistory: () => void;
  onScheduleAutosave: () => void;
};

export const createPgnRuntimeCapabilities = ({
  sessionRef,
  pgnInput,
  t,
  defaultPgn,
  parsePgnToModelFn,
  serializeModelToPgnFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  onPgnChange,
  onStatusChange,
  onErrorChange,
  onRecordHistory,
  onScheduleAutosave,
}: PgnRuntimeDeps) => {
  const hasValueCarrier = (value: unknown): value is { value: string } => {
    return Boolean(value) && typeof value === "object" && "value" in (value as { value?: unknown });
  };
  const getInputValue = (): string => (hasValueCarrier(pgnInput) ? String(pgnInput.value ?? "") : "");
  const setInputValue = (value: string): void => {
    if (hasValueCarrier(pgnInput)) {
      pgnInput.value = value;
    }
  };

  /** Reset derived chess-parse state to an empty game position. */
  const clearParsedState = (): void => {
    const g = sessionRef.current;
    g.moves = [];
    g.verboseMoves = [];
    g.currentPly = 0;
    g.movePositionById = {};
    g.boardPreview = null;
    g.selectedMoveId = null;
  };

  /**
   * Parse PGN into chess.js and update all derived board/navigation state.
   *
   * @param source - PGN source string consumed by chess.js.
   * @param modeLabel - Log label (`"primary"` or `"fallback"`).
   * @returns True when parse succeeded.
   */
  const applyParsedState = (source: string, modeLabel: "primary" | "fallback"): boolean => {
    const g = sessionRef.current;
    const parser: Chess = new Chess();
    parser.loadPgn(normalizeForChessJs(source));
    g.moves = parser.history();
    g.verboseMoves = parser.history({ verbose: true });
    g.currentPly = Math.min(g.currentPly, g.moves.length);
    g.movePositionById = buildMovePositionByIdFn(g.pgnModel) as MovePositionIndex;
    const mainlineCount = Object.values(g.movePositionById).filter(r => r.mainlinePly !== null).length;
    if (g.moves.length !== mainlineCount) {
      log.warn(
        "pgn_runtime",
        `syncChessParseState (${modeLabel}): chess.js mainline move count (${g.moves.length}) differs from ` +
        `movePositionById mainline entry count (${mainlineCount}). ` +
        `Likely cause: [FEN] game where chess.js and the custom parser disagree on moves. ` +
        `gotoPly() will clamp clicks to chess.js move count — some mainline moves will not navigate.`,
      );
    }
    if (g.selectedMoveId && !g.movePositionById[g.selectedMoveId]) g.selectedMoveId = null;
    g.boardPreview = null;
    onErrorChange("");
    return true;
  };

  /** Parse chess moves from PGN source into session state. Returns whether parsing succeeded. */
  const syncChessParseState = (source: string, { clearOnFailure = false }: SyncChessOptions = {}): boolean => {
    if (!source) {
      clearParsedState();
      onErrorChange("");
      return true;
    }
    try {
      return applyParsedState(source, "primary");
    } catch {
      try {
        const strippedSource: string = stripAnnotationsForBoardParserFn(source);
        return applyParsedState(strippedSource, "fallback");
      } catch {
        if (clearOnFailure) {
          onErrorChange("");
        } else {
          onErrorChange(t("pgn.error", "Unable to parse PGN."));
          clearParsedState();
        }
        return false;
      }
    }
  };

  const applyPgnModelUpdate = (
    nextModel: unknown,
    focusCommentId: string | null = null,
    { recordHistory = true }: ApplyPgnModelUpdateOptions = {},
  ): void => {
    const g = sessionRef.current;
    const nextPgnText: string = serializeModelToPgnFn(nextModel);
    if (recordHistory && nextPgnText !== g.pgnText) {
      onRecordHistory();
    }
    g.pgnModel = nextModel as typeof g.pgnModel;
    g.pgnText = nextPgnText;
    setInputValue(g.pgnText);
    if (focusCommentId) {
      g.pendingFocusCommentId = focusCommentId;
    }
    const parseOk = syncChessParseState(g.pgnText);
    const movetextSnippet = g.pgnText.split("\n\n").slice(1).join("\n\n").trim().slice(0, 80);
    log.debug("pgn_runtime", `applyPgnModelUpdate: parseOk=${String(parseOk)} moves.length=${g.moves.length} movetext="${movetextSnippet}"`);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
    onScheduleAutosave();
  };

  const loadPgn = (): void => {
    const g = sessionRef.current;
    const source: string = getInputValue().trim();
    g.pgnText = source;
    g.pgnModel = parsePgnToModelFn(source) as typeof g.pgnModel;
    const ok = syncChessParseState(source);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
    if (ok) onStatusChange(t("pgn.loaded", "PGN loaded."));
  };

  const initializeWithDefaultPgn = (): void => {
    const g = sessionRef.current;
    setInputValue(defaultPgn);
    g.pgnText = defaultPgn;
    g.pgnModel = parsePgnToModelFn(defaultPgn) as typeof g.pgnModel;
    syncChessParseState(defaultPgn);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
    onStatusChange("");
    onErrorChange("");
  };

  return {
    applyPgnModelUpdate,
    initializeWithDefaultPgn,
    loadPgn,
    syncChessParseState,
  };
};
