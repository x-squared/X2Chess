/**
 * AppShell — root React component for the X2Chess application.
 *
 * Owns the full visible HTML structure of the app, wired entirely through React:
 *  - Calls `useAppStartup()` to initialise all services and obtain stable callbacks.
 *  - Wraps the component tree in `<ServiceContext.Provider>` so every descendant
 *    can consume service callbacks via `useServiceContext()`.
 *  - Connects all toolbar, navigation, and shell buttons to service callbacks via
 *    `onClick`/`onChange` props.
 *  - Renders `<ChessBoard />`, `<PgnTextEditor />`, and `<ResourceViewer />` directly
 *    as visible React components.
 *
 * Integration API:
 * - `<AppShell />` — root component mounted by `main.tsx`; no props required.
 *
 * Configuration API:
 * - No props.  All reactive values flow from `AppStoreState` context and
 *   `ServiceContext`.
 *
 * Communication API:
 * - Outbound: all interactions dispatched through `AppStartupServices` callbacks
 *   obtained via `useAppStartup()`.
 * - Inbound: navigation-button `disabled` state, toolbar `aria-pressed`, and
 *   layout structure re-render on `AppStoreState` changes.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { ReactElement } from "react";
import { Chess } from "chess.js";
import { useGameIngress } from "../hooks/useGameIngress";
import { isLikelyPgnText } from "../runtime/bootstrap_shared";
import { useAppContext } from "../state/app_context";
import {
  selectBoardFlipped,
  selectCurrentPly,
  selectSelectedMoveId,
  selectLayoutMode,
  selectShowEvalPills,
  selectMoveCount,
  selectUndoDepth,
  selectRedoDepth,
  selectMoves,
  selectPgnText,
  selectPgnModel,
  selectSessions,
  selectActiveSessionId,
  selectDevToolsEnabled,
  selectShapePrefs,
} from "../state/selectors";
import { useTranslator } from "../hooks/useTranslator";
import { useAppStartup } from "../hooks/useAppStartup";
import { useEngineAnalysis } from "../hooks/useEngineAnalysis";
import { useOpeningExplorer } from "../hooks/useOpeningExplorer";
import { useExtDatabaseSettings } from "../hooks/useExtDatabaseSettings";
import { ExtDatabaseSettingsDialog } from "./ExtDatabaseSettingsDialog";
import { useTablebaseProbe } from "../hooks/useTablebaseProbe";
import { useVsEngine } from "../hooks/useVsEngine";
import { useGameAnnotation } from "../hooks/useGameAnnotation";
import { useMoveEntry } from "../hooks/useMoveEntry";
import { useWebImport } from "../hooks/useWebImport";
import { WebImportBrowserPanel } from "./WebImportBrowserPanel";
import { collectStudyItems } from "../model/study_items";
import { getHeaderValue } from "../model/pgn_headers";
import { STANDARD_STARTING_FEN } from "../editor/fen_utils";
import { ServiceContextProvider } from "../state/ServiceContext";
import type { AppStartupServices } from "../state/ServiceContext";
import { useHoverPreview } from "./HoverPreviewContext";
import { replayPvToPosition } from "../board/move_position";
import { selectPositionPreviewOnHover } from "../state/selectors";
import { MenuPanel } from "./MenuPanel";
import { DevDock } from "./DevDock";
import { GuideInspector } from "./GuideInspector";
import { GUIDE_IDS } from "../guide/guide_ids";
import { GameInfoEditor } from "./GameInfoEditor";
import { GameSessionsPanel } from "./GameSessionsPanel";
import { ChessBoard } from "./ChessBoard";
import type { BoardShape, BoardKey } from "../board/board_shapes";
import { isBoardKey } from "../board/board_shapes";
import { PgnTextEditor } from "./PgnTextEditor";
import { ToolbarRow } from "./ToolbarRow";
import { TextEditorSidebar } from "./TextEditorSidebar";
import { RightPanelStack } from "./RightPanelStack";
import type { PanelId } from "./RightPanelStack";
import { PlayVsEngineDialog } from "./PlayVsEngineDialog";
import { AnnotateGameDialog } from "./AnnotateGameDialog";
import { DisambiguationDialog } from "./DisambiguationDialog";
import { PromotionPicker } from "./PromotionPicker";
import { ExtractPositionDialog } from "./ExtractPositionDialog";
import { EditStartPositionDialog } from "./EditStartPositionDialog";
import { StudyOverlay } from "./StudyOverlay";
import type { PromotionPiece } from "./PromotionPicker";
import { useTrainingSession } from "../training/hooks/useTrainingSession";
import { REPLAY_PROTOCOL } from "../training/protocols/replay_protocol";
import { OPENING_PROTOCOL } from "../training/protocols/opening_protocol";
import { TrainingHistoryStrip } from "../training/components/TrainingHistoryStrip";
import { TrainingHistoryPanel } from "../training/components/TrainingHistoryPanel";
import { TrainingLauncher } from "../training/components/TrainingLauncher";
import { CurriculumPanel } from "../training/components/CurriculumPanel";
import type { Task } from "../training/curriculum/curriculum_plan";
import { TrainingOverlay } from "../training/components/TrainingOverlay";
import { MoveOutcomeHint } from "../training/components/MoveOutcomeHint";
import { TrainingResult } from "../training/components/TrainingResult";
import type { MergeSelection } from "../training/domain/training_transcript";
import { applyMergeToModel, mergeToNewPgn } from "../training/merge_transcript";

/** Compute the FEN at the given ply by replaying SAN moves. */
const fenAtPly = (sanMoves: string[], ply: number): string => {
  const game = new Chess();
  const limit = Math.min(ply, sanMoves.length);
  for (let i = 0; i < limit; i++) game.move(sanMoves[i]);
  return game.fen();
};

/** Root application shell component. */
export const AppShell = (): ReactElement => {
  const { state, dispatch } = useAppContext();
  const currentPly: number = selectCurrentPly(state);
  const selectedMoveId: string | null = selectSelectedMoveId(state);
  const moveCount: number = selectMoveCount(state);
  const layoutMode: "plain" | "text" | "tree" = selectLayoutMode(state);
  const showEvalPills: boolean = selectShowEvalPills(state);
  const undoDepth: number = selectUndoDepth(state);
  const redoDepth: number = selectRedoDepth(state);
  const moves: string[] = selectMoves(state);
  const pgnText: string = selectPgnText(state);
  const sessions = selectSessions(state);
  const activeSessionId = selectActiveSessionId(state);
  const devToolsEnabled: boolean = selectDevToolsEnabled(state);
  const boardFlipped: boolean = selectBoardFlipped(state);
  const positionPreviewOnHover: boolean = selectPositionPreviewOnHover(state);
  const shapePrefs = selectShapePrefs(state);
  const activeSession = sessions.find((s) => s.sessionId === activeSessionId);
  const t: (key: string, fallback?: string) => string = useTranslator();
  const { showPreview, hidePreview } = useHoverPreview();

  const { variations, isAnalyzing, engineName, startAnalysis, stopAnalysis, findBestMove } =
    useEngineAnalysis();

  const {
    resolveUrl,
    browserPanelState,
    closeBrowserPanel,
    handleCaptureResult,
  } = useWebImport();

  // G8: play vs engine
  const vsEngine = useVsEngine(findBestMove);
  const [showVsEngineDialog, setShowVsEngineDialog] = useState(false);

  // G9: batch game annotation
  const gameAnnotation = useGameAnnotation(findBestMove);
  const [showAnnotateDialog, setShowAnnotateDialog] = useState(false);

  // Sync vs-engine board position to boardPreview.
  useEffect((): void => {
    if (!vsEngine.active) return;
    dispatch({
      type: "set_board_preview",
      preview: {
        fen: vsEngine.fen,
        lastMove: vsEngine.lastMove ? [vsEngine.lastMove.from, vsEngine.lastMove.to] : null,
      },
    });
  }, [vsEngine.active, vsEngine.fen, vsEngine.lastMove, dispatch]);

  // Clear boardPreview when vs-engine game ends.
  useEffect((): void => {
    if (!vsEngine.active) {
      dispatch({ type: "set_board_preview", preview: null });
    }
  }, [vsEngine.active, dispatch]);

  const handleVsEngineMovePlayed = useCallback(
    (from: string, to: string): void => {
      vsEngine.onUserMove(from, to);
    },
    [vsEngine],
  );

  const currentFen = fenAtPly(moves, currentPly);

  const extDbSettings = useExtDatabaseSettings();
  const openingExplorer = useOpeningExplorer(
    currentFen,
    extDbSettings.settings.openingExplorer.speeds,
    extDbSettings.settings.openingExplorer.ratings,
  );
  const tablebase = useTablebaseProbe(currentFen);
  const sideToMove: "w" | "b" = currentFen.split(" ")[1] === "b" ? "b" : "w";

  const handleStartAnalysis = useCallback((): void => {
    startAnalysis({ fen: currentFen, moves: [] });
  }, [startAnalysis, currentFen]);

  // Right panel — active tab controlled here so other UI can navigate to it.
  const [activeRightPanel, setActiveRightPanel] = useState<PanelId>("resources");
  const [boardResetKey, setBoardResetKey] = useState<number>(0);

  // NG7: edit starting position dialog
  const pgnModel = selectPgnModel(state);
  const isSetUpGame = getHeaderValue(pgnModel, "SetUp") === "1";
  const currentStartingFen = isSetUpGame
    ? getHeaderValue(pgnModel, "FEN", STANDARD_STARTING_FEN)
    : STANDARD_STARTING_FEN;
  const [showEditStartPos, setShowEditStartPos] = useState(false);

  // UV5: extract position dialog
  const [showExtractDialog, setShowExtractDialog] = useState(false);

  // UV12: study mode state (callbacks below, after rawServices)
  const studyItems = useMemo(
    () => collectStudyItems(selectPgnModel(state)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pgnModel],
  );
  const [studyActive, setStudyActive] = useState(false);
  const [studyItemIndex, setStudyItemIndex] = useState(0);
  const [studyAnnotIndex, setStudyAnnotIndex] = useState(0);

  // G7: best-move hint — extract first move of top variation, clear when ply changes.
  const [hintShapes, setHintShapes] = useState<BoardShape[]>([]);
  useEffect((): void => { setHintShapes([]); }, [currentPly]);
  const handleShowHint = useCallback((): void => {
    const bestPv = variations[0]?.pv;
    if (!bestPv?.length) {
      startAnalysis({ fen: currentFen, moves: [] });
      return;
    }
    const uciMove: string | undefined = bestPv[0];
    if (uciMove && uciMove.length >= 4) {
      const from: string = uciMove.slice(0, 2);
      const to: string = uciMove.slice(2, 4);
      if (isBoardKey(from) && isBoardKey(to)) {
        setHintShapes([{ kind: "arrow", from, to, color: "green" }]);
      }
    }
  }, [variations, currentFen, startAnalysis]);

  const {
    pendingFork,
    pendingPromotion,
    onMovePlayed,
    handleForkDecide,
    handlePromotionPick,
    handleCancel: handleCancelMove,
  } = useMoveEntry();

  /** Cancel a pending fork / promotion and revert the board to the current position. */
  const handleCancel = useCallback((): void => {
    handleCancelMove();
    setBoardResetKey((k) => k + 1);
  }, [handleCancelMove]);

  /** Convert a UCI string (e.g. "e2e4", "e7e8q") from a panel into a board move. */
  const handlePanelMoveClick = useCallback((uci: string): void => {
    if (uci.length < 4) return;
    onMovePlayed(uci.slice(0, 2), uci.slice(2, 4));
  }, [onMovePlayed]);

  const handlePvMoveHover = useCallback(
    (pvSans: string[], upToIndex: number, rect: DOMRect): void => {
      if (!positionPreviewOnHover) return;
      const result = replayPvToPosition(currentFen, pvSans, upToIndex);
      showPreview(result.fen, result.lastMove, rect);
    },
    [positionPreviewOnHover, currentFen, showPreview],
  );

  const handlePvMoveHoverEnd = useCallback((): void => {
    hidePreview();
  }, [hidePreview]);

  // ── Training session ───────────────────────────────────────────────────────
  const trainingControls = useTrainingSession([REPLAY_PROTOCOL, OPENING_PROTOCOL]);
  const [showTrainingLauncher, setShowTrainingLauncher] = useState(false);
  const [showTrainingHistory, setShowTrainingHistory] = useState(false);
  const [showCurriculumPanel, setShowCurriculumPanel] = useState(false);
  const [showExtDbSettings, setShowExtDbSettings] = useState(false);
  const [pendingTrainingPromotion, setPendingTrainingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const trainingOpts = trainingControls.sessionState?.config.protocolOptions as {
    allowRetry?: boolean;
    maxHintsPerGame?: number;
  } | undefined;
  const trainingAllowRetry = trainingOpts?.allowRetry !== false;
  const hintsExhausted =
    (trainingControls.sessionState?.hintsUsed ?? 0) >=
    (trainingOpts?.maxHintsPerGame ?? 3);

  // Sync training board FEN to boardPreview when in_progress.
  useEffect((): void => {
    if (trainingControls.phase !== "in_progress") return;
    const pos = trainingControls.sessionState?.position;
    if (!pos) return;
    dispatch({ type: "set_board_preview", preview: { fen: pos.fen, lastMove: null } });
  }, [trainingControls.phase, trainingControls.sessionState, dispatch]);

  // Clear boardPreview when training ends.
  useEffect((): void => {
    if (trainingControls.phase === "idle") {
      dispatch({ type: "set_board_preview", preview: null });
    }
  }, [trainingControls.phase, dispatch]);

  const handleTrainingMovePlayed = useCallback(
    (from: string, to: string): void => {
      const fen = trainingControls.sessionState?.position.fen;
      if (!fen) return;
      const chess = new Chess();
      try { chess.load(fen); } catch { return; }
      const piece = chess.get(from as Parameters<typeof chess.get>[0]);
      const toRank = to[1];
      const isPromotion =
        piece?.type === "p" &&
        ((piece.color === "w" && toRank === "8") ||
          (piece.color === "b" && toRank === "1"));
      if (isPromotion) {
        setPendingTrainingPromotion({ from, to });
        return;
      }
      const result = chess.move({ from, to });
      if (!result) return;
      trainingControls.submitMove({ uci: from + to, san: result.san, timestamp: Date.now() });
    },
    [trainingControls],
  );

  const handleTrainingPromotionPick = useCallback(
    (piece: PromotionPiece): void => {
      const promo = pendingTrainingPromotion;
      if (!promo) { setPendingTrainingPromotion(null); return; }
      const fen = trainingControls.sessionState?.position.fen;
      if (!fen) { setPendingTrainingPromotion(null); return; }
      setPendingTrainingPromotion(null);
      const chess = new Chess();
      try { chess.load(fen); } catch { return; }
      const result = chess.move({ from: promo.from, to: promo.to, promotion: piece });
      if (!result) return;
      trainingControls.submitMove({
        uci: promo.from + promo.to + piece,
        san: result.san,
        timestamp: Date.now(),
      });
    },
    [pendingTrainingPromotion, trainingControls],
  );

  const trainingGameTitle = activeSession?.title ?? t("training.launcher.untitled", "Untitled game");
  const trainingSourceRef = activeSession?.sourceGameRef || activeSession?.sessionId || "";

  // T11: engine hint during training — call findBestMove on the training FEN.
  const handleTrainingHint = useCallback((): void => {
    trainingControls.requestHint();
    const fen = trainingControls.sessionState?.position.fen;
    if (!fen) return;
    void findBestMove({ fen, moves: [] }, { movetime: 1500 }).then((best) => {
      if (!best) return;
      const uci: string = best.uci;
      if (uci.length >= 4) {
        const from: string = uci.slice(0, 2);
        const to: string = uci.slice(2, 4);
        if (isBoardKey(from) && isBoardKey(to)) {
          setHintShapes([{ kind: "arrow", from, to, color: "green" }]);
        }
      }
    });
  }, [trainingControls, findBestMove]);

  const isDirty: boolean =
    activeSession?.dirtyState === "dirty" || activeSession?.dirtyState === "error";

  const effectiveOnMovePlayed =
    trainingControls.phase === "in_progress"
      ? handleTrainingMovePlayed
      : vsEngine.active
        ? handleVsEngineMovePlayed
        : onMovePlayed;

  // ── M8: navigate-away guard ───────────────────────────────────────────────
  type PendingNavigate =
    | { kind: "switch"; sessionId: string }
    | { kind: "close"; sessionId: string };
  const [pendingNavigate, setPendingNavigate] = useState<PendingNavigate | null>(null);

  /** Initialise all services; returns stable callbacks for the service context. */
  const rawServices: AppStartupServices = useAppStartup();

  /** Services wired into the context — switchSession/closeSession guarded for dirty state. */
  const services: AppStartupServices = {
    ...rawServices,
    openCurriculumPanel: (): void => { setShowCurriculumPanel(true); },
    switchSession: (sessionId: string): void => {
      if (isDirty && sessionId !== activeSession?.sessionId) {
        setPendingNavigate({ kind: "switch", sessionId });
      } else {
        rawServices.switchSession(sessionId);
      }
    },
    closeSession: (sessionId: string): void => {
      const target = sessions.find((s) => s.sessionId === sessionId);
      if (target?.dirtyState === "dirty" || target?.dirtyState === "error") {
        setPendingNavigate({ kind: "close", sessionId });
      } else {
        rawServices.closeSession(sessionId);
      }
    },
  };

  // Curriculum: open game from a task ref and launch the training launcher.
  const handleLaunchTaskFromCurriculum = useCallback((task: Task): void => {
    if (task.ref) {
      rawServices.openGameFromRef(task.ref);
    }
    setShowCurriculumPanel(false);
    setShowTrainingLauncher(true);
  }, [rawServices]);

  // T10: merge training transcript annotations back into the source game.
  const handleMergeResult = useCallback((selection: MergeSelection): void => {
    const model = selectPgnModel(state);
    if (selection.mergeTarget === "source_game" && model) {
      const updated = applyMergeToModel(model, selection);
      rawServices.applyPgnModelEdit(updated, null);
    } else if (selection.mergeTarget === "new_variation" && model) {
      const pgn = mergeToNewPgn(model, selection);
      rawServices.openPgnText(pgn);
    }
    trainingControls.confirmResult();
  }, [trainingControls, state, rawServices]);

  // UV12: study callbacks (after rawServices so navigation is available)
  const currentStudyItem = studyActive ? studyItems[studyItemIndex] : null;

  const handleStartStudy = useCallback((): void => {
    if (studyItems.length === 0) return;
    setStudyItemIndex(0);
    setStudyAnnotIndex(0);
    setStudyActive(true);
    rawServices.gotoMoveById(studyItems[0].moveId);
  }, [studyItems, rawServices]);

  const handleStudyNext = useCallback((): void => {
    const item = studyItems[studyItemIndex];
    if (!item) return;
    if (studyAnnotIndex + 1 < item.annotations.length) {
      setStudyAnnotIndex((i) => i + 1);
      return;
    }
    const nextIdx = studyItemIndex + 1;
    if (nextIdx < studyItems.length) {
      setStudyItemIndex(nextIdx);
      setStudyAnnotIndex(0);
      rawServices.gotoMoveById(studyItems[nextIdx].moveId);
    } else {
      setStudyActive(false);
    }
  }, [studyItems, studyItemIndex, studyAnnotIndex, rawServices]);

  const isAtStart: boolean = currentPly <= 0;
  const isAtEnd: boolean = currentPly >= moveCount;
  const canUndo: boolean = undoDepth > 0;
  const canRedo: boolean = redoDepth > 0;

  const appPanelRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const boardEditorBoxRef = useRef<HTMLDivElement>(null);
  const boardResizeHandleRef = useRef<HTMLDivElement>(null);
  /** Tracks the board width the user set via horizontal drag, so it can be restored when the resource viewer shrinks. */
  const intendedBoardWidthRef = useRef<number>(520);

  // Wire up board / editor column resize handle.
  useEffect((): (() => void) => {
    const handleEl = boardResizeHandleRef.current;
    const boxEl = boardEditorBoxRef.current;
    if (!handleEl || !boxEl) return (): void => {};

    const clamp = (px: number): number => Math.max(260, Math.min(680, Math.round(px)));
    const setWidth = (px: number): void => {
      const clamped = clamp(px);
      document.documentElement.style.setProperty("--board-column-width", `${clamped}px`);
      intendedBoardWidthRef.current = clamped;
    };

    let state: { leftPx: number; handleHalfPx: number } | null = null;

    const onMove = (e: PointerEvent): void => {
      if (!state) return;
      setWidth(e.clientX - state.leftPx - state.handleHalfPx);
    };
    const onUp = (): void => { state = null; };

    const onDown = (e: PointerEvent): void => {
      const boxRect = boxEl.getBoundingClientRect();
      const hRect = handleEl.getBoundingClientRect();
      state = { leftPx: boxRect.left, handleHalfPx: Math.max(2, Math.round(hRect.width / 2)) };
      handleEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    handleEl.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return (): void => {
      handleEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);


  useGameIngress({
    appPanelRef,
    overlayRef,
    isLikelyPgnText,
    openPgnText: (pgnText: string): void => { services.openPgnText(pgnText); },
    resolveUrl,
  });

  // Ctrl/Cmd+S — save active game.
  // Ctrl/Cmd+Z — undo.  Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y — redo.  (M5)
  useEffect((): (() => void) => {
    const handler = (e: KeyboardEvent): void => {
      const withMeta = e.metaKey || e.ctrlKey;
      if (!withMeta) return;
      if (e.key === "s") {
        e.preventDefault();
        services.saveActiveGameNow();
      } else if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        services.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        services.redo();
      }
    };
    window.addEventListener("keydown", handler);
    return (): void => { window.removeEventListener("keydown", handler); };
  // services ref is stable for the lifetime of the component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ServiceContextProvider value={services}>
      <main className="app">
        {/* ── Menu sidebar (backdrop + aside) ── */}
        <MenuPanel />

        {/* ── Main app panel ── */}
        <section ref={appPanelRef} className="app-panel">
          {/* Game drag-and-drop overlay */}
          <div
            ref={overlayRef}
            id="game-drop-overlay"
            className="game-drop-overlay"
            hidden
            aria-hidden="true"
          >
            <p className="game-drop-overlay-label">
              {t("games.dropOverlay", "Drop PGN file to open game")}
            </p>
          </div>

          {/* Menu open trigger */}
          <button
            id="btn-menu"
            className="menu-trigger"
            type="button"
            aria-label={t("menu.open", "Open menu")}
            aria-expanded="false"
            aria-controls="app-menu-panel"
            onClick={(): void => { services.setMenuOpen(true); }}
          >
            <span className="menu-trigger-icon" aria-hidden="true" />
          </button>

          {/* ── Game tabs card ── */}
          <section className="game-tabs-card" data-guide-id={GUIDE_IDS.SESSIONS_PANEL}>
            <div className="game-tabs-header">
              <p className="game-tabs-title">{t("games.open", "Open games")}</p>
              <p className="game-tabs-hint">
                {t(
                  "games.hint",
                  "Drop .pgn files or paste PGN text onto the app to open games.",
                )}
              </p>
            </div>
            <GameSessionsPanel />
          </section>

          {/* ── Game info card (compact summary + fold-down editor) ── */}
          <GameInfoEditor />

          {/* ── Board / editor split pane ── */}
          <div ref={boardEditorBoxRef} id="board-editor-box" className="board-editor-box" data-guide-id={GUIDE_IDS.BOARD_ROOT}>
            {/* Chessboard */}
            <div data-guide-id={GUIDE_IDS.CHESS_BOARD}>
              <ChessBoard
                  onMovePlayed={effectiveOnMovePlayed}
                  overlayShapes={hintShapes}
                  onShapesChanged={(shapes: BoardShape[]): void => {
                    if (!selectedMoveId) return;
                    services.saveBoardShapes(selectedMoveId, shapes);
                  }}
                  presets={{ primary: shapePrefs.primaryColor, secondary: shapePrefs.secondaryColor }}
                  squareStyle={shapePrefs.squareStyle}
                  showMoveHints={shapePrefs.showMoveHints}
                  resetBoardKey={boardResetKey}
                />
            </div>

            {/* Study mode overlay (UV12) */}
            {currentStudyItem && (
              <StudyOverlay
                item={currentStudyItem}
                itemIndex={studyItemIndex}
                totalItems={studyItems.length}
                annotationIndex={studyAnnotIndex}
                t={t}
                onNext={handleStudyNext}
                onStop={(): void => { setStudyActive(false); }}
              />
            )}

            {/* Training overlay (shown when session is active) */}
            {trainingControls.phase === "in_progress" && trainingControls.sessionState && (
              <TrainingOverlay
                sessionState={trainingControls.sessionState}
                hintsExhausted={hintsExhausted}
                t={t}
                onSkip={trainingControls.skipMove}
                onHint={handleTrainingHint}
                onAbort={trainingControls.abort}
              />
            )}

            {/* Move outcome hint (correct / wrong feedback) */}
            {trainingControls.phase === "in_progress" && trainingControls.lastFeedback && (
              <MoveOutcomeHint
                feedback={trainingControls.lastFeedback}
                correctMoveSan={trainingControls.correctMoveSan}
                allowRetry={trainingAllowRetry}
                t={t}
                onRetry={trainingControls.skipMove}
                onSkip={trainingControls.skipMove}
              />
            )}

            {/* Resize handle */}
            <div
              ref={boardResizeHandleRef}
              id="board-editor-resize-handle"
              className="board-editor-resize-handle"
              aria-hidden="true"
            />

            {/* ── Editor pane (toolbar + PGN text editor) ── */}
            <div className="text-editor-wrap board-editor-pane" data-guide-id={GUIDE_IDS.EDITOR_PANE}>
              <ToolbarRow
                isAtStart={isAtStart}
                isAtEnd={isAtEnd}
                boardFlipped={boardFlipped}
                isSetUpGame={isSetUpGame}
                studyItemCount={studyItems.length}
                studyActive={studyActive}
                trainingPhase={trainingControls.phase}
                engineName={engineName}
                vsEngineActive={vsEngine.active}
                t={t}
                onGotoFirst={(): void => { services.gotoFirst(); }}
                onGotoPrev={(): void => { services.gotoPrev(); }}
                onGotoNext={(): void => { services.gotoNext(); }}
                onGotoLast={(): void => { services.gotoLast(); }}
                onFlipBoard={(): void => { dispatch({ type: "toggle_board_flip" }); }}
                onShowEditStartPos={(): void => { setShowEditStartPos(true); }}
                onShowExtractDialog={(): void => { setShowExtractDialog(true); }}
                onShowHint={handleShowHint}
                onStartStudy={handleStartStudy}
                onShowTrainingLauncher={(): void => { setShowTrainingLauncher(true); }}
                onShowAnnotateDialog={(): void => { setShowAnnotateDialog(true); }}
                onVsEngineClick={(): void => {
                  if (vsEngine.active) vsEngine.stop();
                  else setShowVsEngineDialog(true);
                }}
              />

              {/* Editor area — PGN text editor with vertical text-editor sidebar */}
              <div className="editor-with-sidebar">
                <div className="editor-box">
                  {trainingControls.phase === "idle" && (
                    <TrainingHistoryStrip
                      sourceGameRef={trainingSourceRef}
                      onTrainAgain={(): void => { setShowTrainingLauncher(true); }}
                      onViewHistory={(): void => { setShowTrainingHistory(true); }}
                      t={t}
                    />
                  )}
                  <PgnTextEditor />
                </div>
                <TextEditorSidebar
                  layoutMode={layoutMode}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  isDirty={isDirty}
                  showEvalPills={showEvalPills}
                  t={t}
                  onSetLayoutMode={(mode): void => { services.setLayoutMode(mode); }}
                  onApplyDefaultIndent={(): void => { services.applyDefaultIndent(); }}
                  onSave={(): void => { services.saveActiveGameNow(); }}
                  onUndo={(): void => { services.undo(); }}
                  onRedo={(): void => { services.redo(); }}
                  onOpenBoardSettings={(): void => { setActiveRightPanel("settings"); }}
                  onToggleEvalPills={(): void => { services.setShowEvalPills(!showEvalPills); }}
                />
              </div>
            </div>
          </div>

          {/* ── Right panel stack (analysis, explorer, search, resources) ── */}
          {/* data-guide-id is set on the inner .right-panel-stack div via RightPanelStack */}
          <RightPanelStack
            variations={variations}
            isAnalyzing={isAnalyzing}
            engineName={engineName}
            sideToMove={sideToMove}
            onStartAnalysis={handleStartAnalysis}
            onStopAnalysis={stopAnalysis}
            onPvMoveHover={handlePvMoveHover}
            onPvMoveHoverEnd={handlePvMoveHoverEnd}
            openingResult={openingExplorer.result}
            openingIsLoading={openingExplorer.isLoading}
            openingSource={openingExplorer.source}
            openingEnabled={openingExplorer.enabled}
            onOpeningSourceChange={openingExplorer.setSource}
            onOpeningToggle={openingExplorer.setEnabled}
            onOpenSettings={(): void => { setShowExtDbSettings(true); }}
            tbResult={tablebase.result}
            tbIsLoading={tablebase.isLoading}
            tbEnabled={tablebase.enabled}
            onTbToggle={tablebase.setEnabled}
            shapePrefs={shapePrefs}
            onShapePrefsChange={services.setShapePrefs}
            activePanel={activeRightPanel}
            onActivePanelChange={setActiveRightPanel}
            t={t}
            onMoveClick={handlePanelMoveClick}
            onImportPgn={services.openPgnText}
            onOpenGame={services.openGameFromRef}
          />
        </section>

        {/* ── Developer dock ── */}
        {devToolsEnabled && <DevDock />}

        {/* ── Guide inspector (developer tool — Alt+Shift+G) ── */}
        <GuideInspector />

        {/* ── Move entry dialogs ── */}
        {pendingFork && (
          <DisambiguationDialog
            playedSan={pendingFork.san}
            existingSan={pendingFork.existingNextSan}
            t={t}
            onDecide={handleForkDecide}
            onCancel={handleCancel}
          />
        )}
        {pendingPromotion && (
          <PromotionPicker
            color={pendingPromotion.color}
            t={t}
            onPick={handlePromotionPick}
            onCancel={handleCancel}
          />
        )}

        {/* ── Edit starting position dialog (NG7) ── */}
        {showEditStartPos && (
          <EditStartPositionDialog
            initialFen={currentStartingFen}
            t={t}
            onSave={(fen): void => {
              setShowEditStartPos(false);
              services.updateGameInfoHeader("SetUp", "1");
              services.updateGameInfoHeader("FEN", fen);
            }}
            onClose={(): void => { setShowEditStartPos(false); }}
          />
        )}

        {/* ── Extract position dialog (UV5) ── */}
        {showExtractDialog && (
          <ExtractPositionDialog
            fen={currentFen}
            ply={currentPly}
            sanMoves={moves}
            metadata={{
              white: activeSession?.white,
              black: activeSession?.black,
              event: activeSession?.event,
              date: activeSession?.date,
            }}
            t={t}
            onCreate={(pgn): void => {
              setShowExtractDialog(false);
              services.openPgnText(pgn);
            }}
            onClose={(): void => { setShowExtractDialog(false); }}
          />
        )}

        {/* ── Navigate-away guard (M8) ── */}
        {pendingNavigate && (
          <dialog
            open
            className="confirm-dialog"
            onClose={(): void => { setPendingNavigate(null); }}
          >
            <div className="confirm-dialog-content">
              <p className="confirm-dialog-message">
                {t("editor.unsavedChanges", "You have unsaved changes. Save before leaving?")}
              </p>
              <div className="confirm-dialog-actions">
                <button
                  type="button"
                  className="confirm-dialog-btn confirm-dialog-btn--discard"
                  onClick={(): void => {
                    const nav = pendingNavigate;
                    setPendingNavigate(null);
                    if (nav.kind === "switch") rawServices.switchSession(nav.sessionId);
                    else rawServices.closeSession(nav.sessionId);
                  }}
                >
                  {t("editor.discardChanges", "Discard")}
                </button>
                <button
                  type="button"
                  className="confirm-dialog-btn"
                  onClick={(): void => {
                    rawServices.saveActiveGameNow();
                    const nav = pendingNavigate;
                    setPendingNavigate(null);
                    if (nav.kind === "switch") rawServices.switchSession(nav.sessionId);
                    else rawServices.closeSession(nav.sessionId);
                  }}
                >
                  {t("editor.saveAndLeave", "Save & Leave")}
                </button>
                <button
                  type="button"
                  className="confirm-dialog-btn confirm-dialog-btn--cancel"
                  onClick={(): void => { setPendingNavigate(null); }}
                >
                  {t("editor.cancelLeave", "Cancel")}
                </button>
              </div>
            </div>
          </dialog>
        )}

        {/* ── Training dialogs ── */}
        {showExtDbSettings && (
          <ExtDatabaseSettingsDialog
            settings={extDbSettings.settings}
            onSave={(speeds, ratings): void => {
              extDbSettings.setOpeningExplorerSpeeds(speeds);
              extDbSettings.setOpeningExplorerRatings(ratings);
            }}
            onClose={(): void => { setShowExtDbSettings(false); }}
            t={t}
          />
        )}
        {showTrainingHistory && (
          <TrainingHistoryPanel
            sourceGameRef={trainingSourceRef}
            onClose={(): void => { setShowTrainingHistory(false); }}
            onTrainAgain={(): void => { setShowTrainingHistory(false); setShowTrainingLauncher(true); }}
            t={t}
          />
        )}
        {showTrainingLauncher && (
          <TrainingLauncher
            gameTitle={trainingGameTitle}
            pgnText={pgnText}
            sourceRef={trainingSourceRef}
            t={t}
            onStart={(config): void => {
              setShowTrainingLauncher(false);
              trainingControls.start(config);
            }}
            onCancel={(): void => { setShowTrainingLauncher(false); }}
          />
        )}
        {pendingTrainingPromotion && (
          <PromotionPicker
            color={
              trainingControls.sessionState?.position.fen.split(" ")[1] === "b"
                ? "b"
                : "w"
            }
            t={t}
            onPick={handleTrainingPromotionPick}
            onCancel={(): void => { setPendingTrainingPromotion(null); }}
          />
        )}
        {trainingControls.phase === "reviewing" &&
          trainingControls.summary &&
          trainingControls.transcript && (
            <TrainingResult
              summary={trainingControls.summary}
              transcript={trainingControls.transcript}
              t={t}
              onMerge={handleMergeResult}
              onDiscard={trainingControls.confirmResult}
            />
          )}
        {/* ── Annotate game dialog (G9) ── */}
        {showAnnotateDialog && (
          <AnnotateGameDialog
            phase={gameAnnotation.phase}
            progress={gameAnnotation.progress}
            annotatedModel={gameAnnotation.annotatedModel}
            engineName={engineName}
            t={t}
            onStart={(opts): void => { gameAnnotation.start(selectPgnModel(state) ?? (() => { throw new Error(); })(), opts); }}
            onApply={(model): void => {
              setShowAnnotateDialog(false);
              rawServices.applyPgnModelEdit(model, null);
            }}
            onCancel={gameAnnotation.cancel}
            onClose={(): void => { setShowAnnotateDialog(false); }}
          />
        )}

        {/* ── Play vs engine dialogs (G8) ── */}
        {showVsEngineDialog && (
          <PlayVsEngineDialog
            engineName={engineName}
            t={t}
            onStart={(config): void => {
              setShowVsEngineDialog(false);
              vsEngine.start(config);
            }}
            onCancel={(): void => { setShowVsEngineDialog(false); }}
          />
        )}
        {vsEngine.active && vsEngine.gameOver && (
          <dialog open className="vs-engine-gameover-dialog">
            <div className="vs-engine-gameover-content">
              <p className="vs-engine-gameover-message">
                {vsEngine.gameOver.winner === "draw"
                  ? t("vsEngine.draw", "Draw")
                  : vsEngine.gameOver.winner === vsEngine.playerSide
                    ? t("vsEngine.youWon", "You won!")
                    : t("vsEngine.engineWon", "Engine wins")}
                {" "}
                <span className="vs-engine-gameover-reason">
                  ({vsEngine.gameOver.reason})
                </span>
              </p>
              <button
                type="button"
                className="vs-engine-gameover-btn"
                onClick={(): void => { vsEngine.stop(); }}
              >
                {t("vsEngine.close", "Close")}
              </button>
            </div>
          </dialog>
        )}
        {/* ── Training curriculum panel ── */}
        {showCurriculumPanel && (
          <CurriculumPanel
            onClose={(): void => { setShowCurriculumPanel(false); }}
            onLaunchTask={handleLaunchTaskFromCurriculum}
            t={t}
          />
        )}
        {/* ── Web import browser panel (W4 — Tier 3) ── */}
        {browserPanelState !== null && (
          <WebImportBrowserPanel
            gateway={browserPanelState.gateway}
            url={browserPanelState.url}
            captureScript={browserPanelState.captureScript}
            onCaptureResult={handleCaptureResult}
            onClose={closeBrowserPanel}
          />
        )}
      </main>
    </ServiceContextProvider>
  );
};
