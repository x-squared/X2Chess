import { Chess } from "chess.js";
import type { ActiveSessionRef } from "../game_sessions/game_session_state";
import type { MovePositionIndex } from "../board/move_position";

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
 * - This module communicates through `sessionRef.current`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
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
  onRender: () => void;
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
  onRender,
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

  const syncChessParseState = (source: string, { clearOnFailure = false }: SyncChessOptions = {}): void => {
    const g = sessionRef.current;
    if (!source) {
      g.moves = [];
      g.verboseMoves = [];
      g.currentPly = 0;
      g.movePositionById = {};
      g.boardPreview = null;
      g.selectedMoveId = null;
      g.errorMessage = "";
      return;
    }
    try {
      const parser: Chess = new Chess();
      parser.loadPgn(source);
      g.moves = parser.history();
      g.verboseMoves = parser.history({ verbose: true });
      g.currentPly = Math.min(g.currentPly, g.moves.length);
      g.movePositionById = buildMovePositionByIdFn(g.pgnModel) as MovePositionIndex;
      if (g.selectedMoveId && !g.movePositionById[g.selectedMoveId]) g.selectedMoveId = null;
      g.boardPreview = null;
      g.errorMessage = "";
    } catch {
      try {
        const fallbackParser: Chess = new Chess();
        fallbackParser.loadPgn(stripAnnotationsForBoardParserFn(source));
        g.moves = fallbackParser.history();
        g.verboseMoves = fallbackParser.history({ verbose: true });
        g.currentPly = Math.min(g.currentPly, g.moves.length);
        g.movePositionById = buildMovePositionByIdFn(g.pgnModel) as MovePositionIndex;
        if (g.selectedMoveId && !g.movePositionById[g.selectedMoveId]) g.selectedMoveId = null;
        g.boardPreview = null;
        g.errorMessage = "";
      } catch {
        if (clearOnFailure) {
          g.errorMessage = "";
        } else {
          g.errorMessage = t("pgn.error", "Unable to parse PGN.");
          g.moves = [];
          g.verboseMoves = [];
          g.currentPly = 0;
          g.movePositionById = {};
          g.boardPreview = null;
          g.selectedMoveId = null;
        }
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
    if (focusCommentId) g.pendingFocusCommentId = focusCommentId;
    syncChessParseState(g.pgnText);
    onScheduleAutosave();
    onRender();
  };

  const loadPgn = (): void => {
    const g = sessionRef.current;
    g.animationRunId += 1;
    g.isAnimating = false;
    const source: string = getInputValue().trim();
    g.pgnText = source;
    g.pgnModel = parsePgnToModelFn(source) as typeof g.pgnModel;
    syncChessParseState(source);
    g.statusMessage = g.errorMessage ? "" : t("pgn.loaded", "PGN loaded.");
    onRender();
  };

  const initializeWithDefaultPgn = (): void => {
    const g = sessionRef.current;
    setInputValue(defaultPgn);
    g.animationRunId += 1;
    g.isAnimating = false;
    g.pgnText = defaultPgn;
    g.pgnModel = parsePgnToModelFn(defaultPgn) as typeof g.pgnModel;
    syncChessParseState(defaultPgn);
    g.errorMessage = "";
    g.statusMessage = "";
    onRender();
  };

  return {
    applyPgnModelUpdate,
    initializeWithDefaultPgn,
    loadPgn,
    syncChessParseState,
  };
};
