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
import { useGameIngress } from "../../hooks/useGameIngress";
import { isLikelyPgnText } from "../../runtime/bootstrap_shared";
import { useAppContext } from "../../state/app_context";
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
  selectEditorStylePrefs,
  selectDefaultLayoutPrefs,
} from "../../state/selectors";
import { useTranslator } from "../../hooks/useTranslator";
import { useAppStartup } from "../../hooks/useAppStartup";
import { useEngineAnalysis } from "../../hooks/useEngineAnalysis";
import { useOpeningExplorer } from "../../hooks/useOpeningExplorer";
import { useExtDatabaseSettings } from "../../hooks/useExtDatabaseSettings";
import { ExtDatabaseSettingsDialog } from "../settings/ExtDatabaseSettingsDialog";
import { EditorStyleDialog } from "../settings/EditorStyleDialog";
import { DefaultLayoutDialog } from "../settings/DefaultLayoutDialog";
import { useTablebaseProbe } from "../../hooks/useTablebaseProbe";
import { useVsEngine } from "../../hooks/useVsEngine";
import { useGameAnnotation } from "../../hooks/useGameAnnotation";
import { useMoveEntry } from "../../hooks/useMoveEntry";
import { useWebImport } from "../../hooks/useWebImport";
import { WebImportBrowserPanel } from "../web_import/WebImportBrowserPanel";
import { collectStudyItems } from "../../model/study_items";
import { getHeaderValue } from "../../model/pgn_headers";
import { STANDARD_STARTING_FEN } from "../../editor/fen_utils";
import { ServiceContextProvider } from "../../state/ServiceContext";
import type { AppStartupServices } from "../../state/ServiceContext";
import { useHoverPreview } from "../board/HoverPreviewContext";
import { replayPvToPosition } from "../../board/move_position";
import { selectPositionPreviewOnHover } from "../../state/selectors";
import { MenuPanel } from "./MenuPanel";
import { DevDock } from "./DevDock";
import { GuideInspector } from "../guide/GuideInspector";
import { GUIDE_IDS } from "../../guide/guide_ids";
import { GameInfoEditor } from "../game_editor/GameInfoEditor";
import { GameSessionsPanel } from "../resource_viewer/GameSessionsPanel";
import { ChessBoard } from "../board/ChessBoard";
import type { BoardShape } from "../../board/board_shapes";
import { isBoardKey } from "../../board/board_shapes";
import { PgnTextEditor } from "../game_editor/PgnTextEditor";
import { ToolbarRow } from "./ToolbarRow";
import { TextEditorSidebar } from "../game_editor/TextEditorSidebar";
import { RightPanelStack } from "./RightPanelStack";
import type { PanelId } from "./RightPanelStack";
import { PlayVsEngineDialog } from "../dialogs/PlayVsEngineDialog";
import { AnnotateGameDialog } from "../dialogs/AnnotateGameDialog";
import { DisambiguationDialog } from "../board/DisambiguationDialog";
import { PromotionPicker } from "../board/PromotionPicker";
import { ExtractPositionDialog } from "../dialogs/ExtractPositionDialog";
import { EditStartPositionDialog } from "../dialogs/EditStartPositionDialog";
import { StudyOverlay } from "../guide/StudyOverlay";
import { useTrainingSession } from "../../training/hooks/useTrainingSession";
import { REPLAY_PROTOCOL } from "../../training/protocols/replay_protocol";
import { OPENING_PROTOCOL } from "../../training/protocols/opening_protocol";
import { TrainingHistoryStrip } from "../../training/components/TrainingHistoryStrip";
import { TrainingHistoryPanel } from "../../training/components/TrainingHistoryPanel";
import { TrainingLauncher } from "../../training/components/TrainingLauncher";
import { CurriculumPanel } from "../../training/components/CurriculumPanel";
import { TrainingOverlay } from "../../training/components/TrainingOverlay";
import { MoveOutcomeHint } from "../../training/components/MoveOutcomeHint";
import { TrainingResult } from "../../training/components/TrainingResult";
import { useBoardColumnResize } from "../../hooks/useBoardColumnResize";
import { useNavigateGuard } from "../../hooks/useNavigateGuard";
import { useTrainingDialogState } from "../../hooks/useTrainingDialogState";

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

  // Editor style dialog
  const [showEditorStyleDialog, setShowEditorStyleDialog] = useState(false);
  // Default Layout dialog
  const [showDefaultLayoutDialog, setShowDefaultLayoutDialog] = useState(false);

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
  const [showExtDbSettings, setShowExtDbSettings] = useState(false);

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

  // ── M8: navigate-away guard ───────────────────────────────────────────────
  const rawServices: AppStartupServices = useAppStartup();

  const navigateGuard = useNavigateGuard(rawServices, sessions, activeSession);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  useEffect((): void => {
    if (navigateGuard.pendingNavigate) {
      confirmDialogRef.current?.showModal();
    }
  }, [navigateGuard.pendingNavigate]);

  const training = useTrainingDialogState(
    trainingControls,
    rawServices,
    () => state,
  );

  const effectiveOnMovePlayed =
    trainingControls.phase === "in_progress"
      ? training.handleTrainingMovePlayed
      : vsEngine.active
        ? handleVsEngineMovePlayed
        : onMovePlayed;

  /** Services wired into the context — switchSession/closeSession guarded for dirty state. */
  const services: AppStartupServices = {
    ...rawServices,
    openCurriculumPanel: (): void => { training.setShowCurriculumPanel(true); },
    openEditorStyleDialog: (): void => { setShowEditorStyleDialog(true); },
    openDefaultLayoutDialog: (): void => { setShowDefaultLayoutDialog(true); },
    switchSession: navigateGuard.switchSession,
    closeSession: navigateGuard.closeSession,
  };

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

  const { boardEditorBoxRef, boardResizeHandleRef } = useBoardColumnResize();

  useGameIngress({
    appPanelRef,
    overlayRef,
    isLikelyPgnText,
    openPgnText: (pgnText: string, options?: Parameters<typeof services.openPgnText>[1]): void => { services.openPgnText(pgnText, options); },
    resolveUrl,
  });

  // Guard app close when any session has unsaved edits (M9).
  // A ref carries the current value so the handler registered once always reads
  // the latest state without needing to re-register.
  const hasUnsavedRef = useRef(false);
  useEffect((): void => {
    hasUnsavedRef.current = sessions.some(
      (s) => s.dirtyState === "dirty" || s.dirtyState === "error",
    );
  }, [sessions]);
  useEffect((): (() => void) => {
    const handler = (e: BeforeUnloadEvent): void => {
      if (!hasUnsavedRef.current) return;
      e.preventDefault();
      // returnValue is required for the browser dialog to appear.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return (): void => { window.removeEventListener("beforeunload", handler); };
  }, []);

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

  const trainingGameTitle = activeSession?.title ?? t("training.launcher.untitled", "Untitled game");
  const trainingSourceRef = activeSession?.sourceGameRef || activeSession?.sessionId || "";

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

          {/* ── Game tabs card ── */}
          <section className="game-tabs-card" data-guide-id={GUIDE_IDS.SESSIONS_PANEL}>
            {/* Menu open trigger — centred on top border of this card */}
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

            <div className="game-tabs-header">
              <p className="game-tabs-title">{t("games.open", "Open games")}</p>
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
                onShowTrainingLauncher={(): void => { training.setShowTrainingLauncher(true); }}
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
                      onTrainAgain={(): void => { training.setShowTrainingLauncher(true); }}
                      onViewHistory={(): void => { training.setShowTrainingHistory(true); }}
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
                  onOpenDefaultLayoutConfig={(): void => { services.openDefaultLayoutDialog(); }}
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
        {navigateGuard.pendingNavigate && (
          <dialog
            ref={confirmDialogRef}
            className="confirm-dialog"
            onClose={navigateGuard.clearPendingNavigate}
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
                    const nav = navigateGuard.pendingNavigate;
                    navigateGuard.clearPendingNavigate();
                    if (!nav) return;
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
                    const nav = navigateGuard.pendingNavigate;
                    navigateGuard.clearPendingNavigate();
                    if (!nav) return;
                    if (nav.kind === "switch") rawServices.switchSession(nav.sessionId);
                    else rawServices.closeSession(nav.sessionId);
                  }}
                >
                  {t("editor.saveAndLeave", "Save & Leave")}
                </button>
                <button
                  type="button"
                  className="confirm-dialog-btn confirm-dialog-btn--cancel"
                  onClick={navigateGuard.clearPendingNavigate}
                >
                  {t("editor.cancelLeave", "Cancel")}
                </button>
              </div>
            </div>
          </dialog>
        )}

        {/* ── Editor style dialog ── */}
        {showEditorStyleDialog && (
          <EditorStyleDialog
            prefs={selectEditorStylePrefs(state)}
            pgnModel={selectPgnModel(state)}
            initialLayoutMode={layoutMode}
            onSave={(prefs): void => { services.setEditorStylePrefs(prefs); }}
            onClose={(): void => { setShowEditorStyleDialog(false); }}
          />
        )}

        {/* ── Default Layout dialog ── */}
        {showDefaultLayoutDialog && (
          <DefaultLayoutDialog
            prefs={selectDefaultLayoutPrefs(state)}
            onSave={(prefs): void => { services.setDefaultLayoutPrefs(prefs); }}
            onClose={(): void => { setShowDefaultLayoutDialog(false); }}
          />
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
        {training.showTrainingHistory && (
          <TrainingHistoryPanel
            sourceGameRef={trainingSourceRef}
            onClose={(): void => { training.setShowTrainingHistory(false); }}
            onTrainAgain={(): void => { training.setShowTrainingHistory(false); training.setShowTrainingLauncher(true); }}
            t={t}
          />
        )}
        {training.showTrainingLauncher && (
          <TrainingLauncher
            gameTitle={trainingGameTitle}
            pgnText={pgnText}
            sourceRef={trainingSourceRef}
            t={t}
            onStart={(config): void => {
              training.setShowTrainingLauncher(false);
              trainingControls.start(config);
            }}
            onCancel={(): void => { training.setShowTrainingLauncher(false); }}
          />
        )}
        {training.pendingTrainingPromotion && (
          <PromotionPicker
            color={
              trainingControls.sessionState?.position.fen.split(" ")[1] === "b"
                ? "b"
                : "w"
            }
            t={t}
            onPick={training.handleTrainingPromotionPick}
            onCancel={(): void => { training.setPendingTrainingPromotion(null); }}
          />
        )}
        {trainingControls.phase === "reviewing" &&
          trainingControls.summary &&
          trainingControls.transcript && (
            <TrainingResult
              summary={trainingControls.summary}
              transcript={trainingControls.transcript}
              t={t}
              onMerge={training.handleMergeResult}
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
        {training.showCurriculumPanel && (
          <CurriculumPanel
            onClose={(): void => { training.setShowCurriculumPanel(false); }}
            onLaunchTask={training.handleLaunchTaskFromCurriculum}
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
