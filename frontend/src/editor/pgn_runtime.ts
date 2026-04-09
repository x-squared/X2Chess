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

type BoardPreviewValue = { fen: string; lastMove?: [string, string] | null } | null;

type PgnRuntimeDeps = {
  sessionRef: ActiveSessionRef;
  pgnInput: Element | null;
  t: (key: string, fallback?: string) => string;
  defaultPgn: string;
  parsePgnToModelFn: (source: string) => unknown;
  serializeModelToPgnFn: (model: unknown) => string;
  buildMovePositionByIdFn: (model: unknown) => Record<string, unknown>;
  stripAnnotationsForBoardParserFn: (source: string) => string;
  /** Called after pgnText, pgnModel, or moves change. */
  onPgnChange: (pgnText: string, pgnModel: unknown, moves: string[]) => void;
  /** Called after currentPly, selectedMoveId, or boardPreview change. */
  onNavigationChange: (currentPly: number, selectedMoveId: string | null, boardPreview: BoardPreviewValue) => void;
  /** Called to set the status bar message (success/informational). */
  onStatusChange: (message: string) => void;
  /** Called to set the error bar message (parse errors). */
  onErrorChange: (message: string) => void;
  /** Called after pendingFocusCommentId changes. */
  onPendingFocusChange: (commentId: string | null) => void;
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
  onNavigationChange,
  onStatusChange,
  onErrorChange,
  onPendingFocusChange,
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

  /** Parse chess moves from PGN source into session state. Returns whether parsing succeeded. */
  const syncChessParseState = (source: string, { clearOnFailure = false }: SyncChessOptions = {}): boolean => {
    const g = sessionRef.current;
    if (!source) {
      g.moves = [];
      g.verboseMoves = [];
      g.currentPly = 0;
      g.movePositionById = {};
      g.boardPreview = null;
      g.selectedMoveId = null;
      onErrorChange("");
      return true;
    }
    try {
      const parser: Chess = new Chess();
      parser.loadPgn(normalizeForChessJs(source));
      g.moves = parser.history();
      g.verboseMoves = parser.history({ verbose: true });
      g.currentPly = Math.min(g.currentPly, g.moves.length);
      g.movePositionById = buildMovePositionByIdFn(g.pgnModel) as MovePositionIndex;
      if (g.selectedMoveId && !g.movePositionById[g.selectedMoveId]) g.selectedMoveId = null;
      g.boardPreview = null;
      onErrorChange("");
      return true;
    } catch {
      try {
        const fallbackParser: Chess = new Chess();
        fallbackParser.loadPgn(normalizeForChessJs(stripAnnotationsForBoardParserFn(source)));
        g.moves = fallbackParser.history();
        g.verboseMoves = fallbackParser.history({ verbose: true });
        g.currentPly = Math.min(g.currentPly, g.moves.length);
        g.movePositionById = buildMovePositionByIdFn(g.pgnModel) as MovePositionIndex;
        if (g.selectedMoveId && !g.movePositionById[g.selectedMoveId]) g.selectedMoveId = null;
        g.boardPreview = null;
        onErrorChange("");
        return true;
      } catch {
        if (clearOnFailure) {
          onErrorChange("");
        } else {
          onErrorChange(t("pgn.error", "Unable to parse PGN."));
          g.moves = [];
          g.verboseMoves = [];
          g.currentPly = 0;
          g.movePositionById = {};
          g.boardPreview = null;
          g.selectedMoveId = null;
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
      onPendingFocusChange(focusCommentId);
    }
    const parseOk = syncChessParseState(g.pgnText);
    const movetextSnippet = g.pgnText.split("\n\n").slice(1).join("\n\n").trim().slice(0, 80);
    log.debug("pgn_runtime", `applyPgnModelUpdate: parseOk=${String(parseOk)} moves.length=${g.moves.length} movetext="${movetextSnippet}"`);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
    onNavigationChange(g.currentPly, g.selectedMoveId, g.boardPreview as BoardPreviewValue);
    onScheduleAutosave();
  };

  const loadPgn = (): void => {
    const g = sessionRef.current;
    const source: string = getInputValue().trim();
    g.pgnText = source;
    g.pgnModel = parsePgnToModelFn(source) as typeof g.pgnModel;
    const ok = syncChessParseState(source);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
    onNavigationChange(g.currentPly, g.selectedMoveId, g.boardPreview as BoardPreviewValue);
    if (ok) onStatusChange(t("pgn.loaded", "PGN loaded."));
  };

  const initializeWithDefaultPgn = (): void => {
    const g = sessionRef.current;
    setInputValue(defaultPgn);
    g.pgnText = defaultPgn;
    g.pgnModel = parsePgnToModelFn(defaultPgn) as typeof g.pgnModel;
    syncChessParseState(defaultPgn);
    onPgnChange(g.pgnText, g.pgnModel, g.moves);
    onNavigationChange(g.currentPly, g.selectedMoveId, g.boardPreview as BoardPreviewValue);
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
