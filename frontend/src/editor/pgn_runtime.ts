import { Chess } from "chess.js";

/**
 * Pgn Runtime module.
 *
 * Integration API:
 * - Primary exports from this module: `createPgnRuntimeCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type PgnRuntimeState = {
  pgnModel: unknown;
  pgnText: string;
  moves: string[];
  verboseMoves: unknown[];
  currentPly: number;
  movePositionById: Record<string, unknown>;
  boardPreview: { fen?: string; lastMove?: unknown } | null;
  selectedMoveId: string | null;
  errorMessage: string;
  statusMessage: string;
  pendingFocusCommentId: string | null;
  animationRunId: number;
  isAnimating: boolean;
};

type SyncChessOptions = {
  clearOnFailure?: boolean;
};

type ApplyPgnModelUpdateOptions = {
  recordHistory?: boolean;
};

type PgnRuntimeDeps = {
  state: Record<string, unknown>;
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
}: PgnRuntimeDeps) => {
  const runtimeState: PgnRuntimeState = state as PgnRuntimeState;
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
    if (!source) {
      runtimeState.moves = [];
      runtimeState.verboseMoves = [];
      runtimeState.currentPly = 0;
      runtimeState.movePositionById = {};
      runtimeState.boardPreview = null;
      runtimeState.selectedMoveId = null;
      runtimeState.errorMessage = "";
      return;
    }
    try {
      const parser: Chess = new Chess();
      parser.loadPgn(source);
      runtimeState.moves = parser.history();
      runtimeState.verboseMoves = parser.history({ verbose: true });
      runtimeState.currentPly = Math.min(runtimeState.currentPly, runtimeState.moves.length);
      runtimeState.movePositionById = buildMovePositionByIdFn(runtimeState.pgnModel);
      if (runtimeState.selectedMoveId && !runtimeState.movePositionById[runtimeState.selectedMoveId]) runtimeState.selectedMoveId = null;
      runtimeState.boardPreview = null;
      runtimeState.errorMessage = "";
    } catch {
      try {
        const fallbackParser: Chess = new Chess();
        fallbackParser.loadPgn(stripAnnotationsForBoardParserFn(source));
        runtimeState.moves = fallbackParser.history();
        runtimeState.verboseMoves = fallbackParser.history({ verbose: true });
        runtimeState.currentPly = Math.min(runtimeState.currentPly, runtimeState.moves.length);
        runtimeState.movePositionById = buildMovePositionByIdFn(runtimeState.pgnModel);
        if (runtimeState.selectedMoveId && !runtimeState.movePositionById[runtimeState.selectedMoveId]) runtimeState.selectedMoveId = null;
        runtimeState.boardPreview = null;
        runtimeState.errorMessage = "";
      } catch {
        if (clearOnFailure) {
          runtimeState.errorMessage = "";
        } else {
          runtimeState.errorMessage = t("pgn.error", "Unable to parse PGN.");
          runtimeState.moves = [];
          runtimeState.verboseMoves = [];
          runtimeState.currentPly = 0;
          runtimeState.movePositionById = {};
          runtimeState.boardPreview = null;
          runtimeState.selectedMoveId = null;
        }
      }
    }
  };

  const applyPgnModelUpdate = (
    nextModel: unknown,
    focusCommentId: string | null = null,
    { recordHistory = true }: ApplyPgnModelUpdateOptions = {},
  ): void => {
    const nextPgnText: string = serializeModelToPgnFn(nextModel);
    if (recordHistory && nextPgnText !== runtimeState.pgnText) {
      onRecordHistory();
    }
    runtimeState.pgnModel = nextModel;
    runtimeState.pgnText = nextPgnText;
    setInputValue(runtimeState.pgnText);
    if (focusCommentId) runtimeState.pendingFocusCommentId = focusCommentId;
    syncChessParseState(runtimeState.pgnText);
    onScheduleAutosave();
    onRender();
  };

  const loadPgn = (): void => {
    runtimeState.animationRunId += 1;
    runtimeState.isAnimating = false;
    const source: string = getInputValue().trim();
    runtimeState.pgnText = source;
    runtimeState.pgnModel = parsePgnToModelFn(source);
    syncChessParseState(source);
    runtimeState.statusMessage = runtimeState.errorMessage ? "" : t("pgn.loaded", "PGN loaded.");
    onRender();
  };

  const initializeWithDefaultPgn = (): void => {
    setInputValue(defaultPgn);
    runtimeState.animationRunId += 1;
    runtimeState.isAnimating = false;
    runtimeState.pgnText = defaultPgn;
    runtimeState.pgnModel = parsePgnToModelFn(defaultPgn);
    syncChessParseState(defaultPgn);
    runtimeState.errorMessage = "";
    runtimeState.statusMessage = "";
    onRender();
  };

  return {
    applyPgnModelUpdate,
    initializeWithDefaultPgn,
    loadPgn,
    syncChessParseState,
  };
};
