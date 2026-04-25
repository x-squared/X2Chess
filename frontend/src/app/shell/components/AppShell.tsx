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
import type { ReactElement, CSSProperties } from "react";
import { useGameIngress } from "../../../features/sessions/hooks/useGameIngress";
import { isLikelyPgnText } from "../../../runtime/bootstrap_shared";
import { useAppContext } from "../../providers/AppStateProvider";
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
  selectPositionPreviewOnHover,
} from "../../../core/state/selectors";
import { useTranslator } from "../../hooks/useTranslator";
import { useAppStartup } from "../../startup/useAppStartup";
import { useEngineAnalysis } from "../../../features/analysis/hooks/useEngineAnalysis";
import { useOpeningExplorer } from "../../../features/analysis/hooks/useOpeningExplorer";
import { useExtDatabaseSettings } from "../../../features/resources/hooks/useExtDatabaseSettings";
import { useTablebaseProbe } from "../../../features/analysis/hooks/useTablebaseProbe";
import { useVsEngine } from "../../../features/analysis/hooks/useVsEngine";
import { useGameAnnotation } from "../../../features/analysis/hooks/useGameAnnotation";
import { useMoveEntry } from "../../../features/editor/hooks/useMoveEntry";
import { useWebImport } from "../../../features/resources/hooks/useWebImport";
import { getHeaderValue } from "../../../../../parts/pgnparser/src/pgn_headers";
import { STANDARD_STARTING_FEN } from "../../../features/editor/model/fen_utils";
import { ServiceContextProvider } from "../../providers/ServiceProvider";
import type { AppStartupServices } from "../../../core/contracts/app_services";
import { useHoverPreview } from "../../../components/board/HoverPreviewContext";
import { replayPvToPosition } from "../../../board/move_position";
import { MenuPanel } from "./MenuPanel";
import { GuideInspector } from "../../../features/guide/components/GuideInspector";
import { UI_IDS } from "../../../core/model/ui_ids";
import { GameInfoEditor } from "../../../features/editor/components/GameInfoEditor";
import { GameSessionsPanel } from "../../../features/resources/components/GameSessionsPanel";
import { ChessBoard } from "../../../components/board/ChessBoard";
import type { BoardShape } from "../../../board/board_shapes";
import { isBoardKey } from "../../../board/board_shapes";
import { PgnTextEditor } from "../../../features/editor/components/PgnTextEditor";
import { ToolbarRow } from "./ToolbarRow";
import { TextEditorSidebar } from "../../../features/editor/components/TextEditorSidebar";
import { applyMarkdownWrap } from "../../../features/editor/components/comment_markdown_format";
import type { CommentFormat } from "../../../features/editor/components/comment_markdown_format";
import { RightPanelStack } from "./RightPanelStack";
import type { PanelId } from "./RightPanelStack";
import { AppShellOverlays } from "./AppShellOverlays";
import { StudyOverlay } from "../../../features/guide/components/StudyOverlay";
import { useTrainingSession } from "../../../training/hooks/useTrainingSession";
import { REPLAY_PROTOCOL } from "../../../training/protocols/replay_protocol";
import { OPENING_PROTOCOL } from "../../../training/protocols/opening_protocol";
import { FIND_MOVE_PROTOCOL } from "../../../training/protocols/find_move_protocol";
import { buildTrainingGameContext } from "../../../training/domain/training_game_context";
import type { TrainingGameContext } from "../../../training/domain/training_game_context";
import { TrainingHistoryStrip } from "../../../training/components/TrainingHistoryStrip";
import { TrainingOverlay } from "../../../training/components/TrainingOverlay";
import { MoveOutcomeHint } from "../../../training/components/MoveOutcomeHint";
import { useBoardColumnResize } from "../hooks/useBoardColumnResize";
import { useStudyMode } from "../hooks/useStudyMode";
import { useAppShellKeyboard } from "../hooks/useAppShellKeyboard";
import { useNavigateGuard } from "../../../features/sessions/guards/useNavigateGuard";
import { useTrainingDialogState } from "../../../features/training/hooks/useTrainingDialogState";
import { buildFenAtPly } from "../fen_at_ply";

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
  const pgnModel = selectPgnModel(state);
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
  // New game dialog
  const [showNewGameDialog, setShowNewGameDialog] = useState(false);

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

  const currentFen = useMemo((): string => {
    const startFenHeader: string = getHeaderValue(pgnModel, "FEN", "").trim();
    const startFen: string | undefined = startFenHeader.length > 0 ? startFenHeader : undefined;
    return buildFenAtPly(moves, currentPly, startFen);
  }, [moves, currentPly, pgnModel]);

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
  const [textSearchTrigger, setTextSearchTrigger] = useState<{ query: string } | undefined>(undefined);
  const [boardResetKey, setBoardResetKey] = useState<number>(0);

  // NG7: edit starting position dialog
  const isSetUpGame = getHeaderValue(pgnModel, "SetUp") === "1";
  const currentStartingFen = isSetUpGame
    ? getHeaderValue(pgnModel, "FEN", STANDARD_STARTING_FEN)
    : STANDARD_STARTING_FEN;
  const [showEditStartPos, setShowEditStartPos] = useState(false);

  // UV5: extract position dialog
  const [showExtractDialog, setShowExtractDialog] = useState(false);

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

  // useMoveEntry is called outside ServiceContextProvider, so services cannot be read
  // from context.  A ref is used as a bridge: the ref is populated later in the same
  // render (after useAppStartup returns), and is always current by the time any user
  // interaction triggers the callbacks.
  const moveEntryServicesRef = useRef<AppStartupServices | null>(null);
  const hintClearTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const {
    pendingFork,
    pendingPromotion,
    onMovePlayed,
    handleForkDecide,
    handlePromotionPick,
    handleCancel: handleCancelMove,
  } = useMoveEntry(moveEntryServicesRef);

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


  const handleSearchPlayer = useCallback((query: string): void => {
    setActiveRightPanel("text-search");
    setTextSearchTrigger({ query });
  }, []);

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
  const trainingControls = useTrainingSession([REPLAY_PROTOCOL, OPENING_PROTOCOL, FIND_MOVE_PROTOCOL]);
  const trainingGameContext: TrainingGameContext = useMemo(
    () => buildTrainingGameContext(pgnModel),
    [pgnModel],
  );
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

  // Auto-flip the board to face the user's chosen side when training starts.
  // Triggers once per session (when phase first becomes "in_progress").
  const prevTrainingPhaseRef = useRef<string>("idle");
  useEffect((): void => {
    const prev = prevTrainingPhaseRef.current;
    prevTrainingPhaseRef.current = trainingControls.phase;
    if (prev !== "in_progress" && trainingControls.phase === "in_progress") {
      const side = (trainingControls.sessionState?.config.protocolOptions as { side?: string })?.side;
      if (side === "black") {
        dispatch({ type: "set_board_flipped", flipped: true });
      } else if (side === "white") {
        dispatch({ type: "set_board_flipped", flipped: false });
      }
      // "both" — leave the board as-is; the user can flip manually.
    }
  }, [trainingControls.phase, trainingControls.sessionState, dispatch]);

  // T11: hint during training — highlight the source square of the correct game move briefly.
  const handleTrainingHint = useCallback((): void => {
    trainingControls.requestHint();
    const sessionState = trainingControls.sessionState;
    if (!sessionState) return;
    const ply = sessionState.currentSourcePly;
    const mainlineMoves = (sessionState.protocolState as { mainlineMoves?: string[] }).mainlineMoves;
    const uci = mainlineMoves?.[ply];
    if (!uci || uci.length < 2) return;
    const from = uci.slice(0, 2);
    if (!isBoardKey(from)) return;

    if (hintClearTimerRef.current !== null) {
      window.clearTimeout(hintClearTimerRef.current);
    }
    setHintShapes([{ kind: "highlight", square: from, color: "green" }]);
    hintClearTimerRef.current = window.setTimeout((): void => {
      setHintShapes([]);
      hintClearTimerRef.current = null;
    }, 2500);
  }, [trainingControls]);

  const isDirty: boolean =
    activeSession?.dirtyState === "dirty" ||
    activeSession?.dirtyState === "error" ||
    !!activeSession?.isUnsaved;

  const boardWrapperClass: string | undefined =
    trainingControls.phase === "in_progress" ? "board-training-elevated" : undefined;

  // Training board scale: 50–100 % of the max fitted size. Starts at 100 %.
  const [trainingBoardScale, setTrainingBoardScale] = useState<number>(100);

  // ── M8: navigate-away guard ───────────────────────────────────────────────
  const rawServices: AppStartupServices = useAppStartup();
  moveEntryServicesRef.current = rawServices;

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
    openNewGameDialog: (): void => { setShowNewGameDialog(true); },
    switchSession: navigateGuard.switchSession,
    closeSession: navigateGuard.closeSession,
  };

  // UV12: study mode (after rawServices so navigation is available)
  const {
    studyItems,
    studyActive,
    setStudyActive,
    studyItemIndex,
    studyAnnotIndex,
    currentStudyItem,
    handleStartStudy,
    handleStudyNext,
  } = useStudyMode(pgnModel, rawServices);

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

  useAppShellKeyboard(sessions, services);

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
          <section className="game-tabs-card" data-ui-id={UI_IDS.SESSIONS_PANEL}>
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

            {/* Training pause pill — shown while training is paused */}
            {trainingControls.phase === "paused" && trainingControls.sessionState && (
              <button
                type="button"
                className="training-pause-pill"
                title={t("training.resumeTooltip", "Click to resume training")}
                onClick={trainingControls.resume}
              >
                <span className="training-pause-pill__icon" aria-hidden="true">▶</span>
                <span className="training-pause-pill__label">
                  {t("training.resumePill", "Training paused — resume")}
                </span>
              </button>
            )}
          </section>

          {/* ── Game info card (compact summary + fold-down editor) ── */}
          <GameInfoEditor />

          {/* ── Board / editor split pane ── */}
          <div ref={boardEditorBoxRef} id="board-editor-box" className="board-editor-box" data-ui-id={UI_IDS.BOARD_ROOT}>
            {/* Chessboard — elevated above the training backdrop when training is active */}
            <div
              data-ui-id={UI_IDS.CHESS_BOARD}
              className={boardWrapperClass}
              style={trainingControls.phase === "in_progress"
                ? { "--training-board-scale": String(trainingBoardScale) } as CSSProperties
                : undefined}
            >
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

            {/* Resize handle */}
            <div
              ref={boardResizeHandleRef}
              id="board-editor-resize-handle"
              className="board-editor-resize-handle"
              aria-hidden="true"
            />

            {/* ── Editor pane (toolbar + PGN text editor) ── */}
            <div className="text-editor-wrap board-editor-pane" data-ui-id={UI_IDS.EDITOR_PANE}>
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
                onFlipBoard={(): void => { services.flipBoard(); }}
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
                  commentFormatEnabled={layoutMode !== "plain"}
                  onFormatComment={(fmt: CommentFormat): void => { applyMarkdownWrap(fmt); }}
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
          {/* `data-ui-id` is set on the inner .right-panel-stack div via RightPanelStack */}
          <RightPanelStack
            devToolsEnabled={devToolsEnabled}
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
            onSearchPlayer={handleSearchPlayer}
            textSearchTrigger={textSearchTrigger}
            t={t}
            onMoveClick={handlePanelMoveClick}
            onImportPgn={services.openPgnText}
            onOpenGame={services.openGameFromRef}
          />
        </section>

        {/* ── Training focus mode — backdrop + HUD + outcome toast ── */}
        {trainingControls.phase === "in_progress" && (
          <div className="training-backdrop" aria-hidden="true" />
        )}
        {trainingControls.phase === "in_progress" && trainingControls.sessionState && (
          <TrainingOverlay
            sessionState={trainingControls.sessionState}
            hintsExhausted={hintsExhausted}
            boardFlipped={boardFlipped}
            boardScale={trainingBoardScale}
            t={t}
            onSkip={trainingControls.skipMove}
            onHint={handleTrainingHint}
            onFlip={(): void => {
              services.flipBoard();
              // flipBoard calls applyModelUpdate, which resets g.boardPreview = null
              // (via syncChessParseState → applyParsedState) and dispatches that null to
              // React. Re-dispatch the training position so it wins in the same batch.
              const pos = trainingControls.sessionState?.position;
              if (pos) {
                dispatch({ type: "set_board_preview", preview: { fen: pos.fen, lastMove: null } });
              }
            }}
            onBoardScale={setTrainingBoardScale}
            onPause={trainingControls.pause}
            onAbort={trainingControls.abort}
          />
        )}
        {trainingControls.phase === "in_progress" && trainingControls.lastFeedback && (
          <MoveOutcomeHint
            feedback={trainingControls.lastFeedback}
            correctMoveSan={trainingControls.correctMoveSan}
            allowRetry={trainingAllowRetry}
            t={t}
            onRetry={(): void => {
              trainingControls.clearFeedback();
              setBoardResetKey((k) => k + 1);
            }}
            onSkip={trainingControls.skipMove}
          />
        )}

        {/* ── Guide inspector (developer tool — Alt+Shift+G) ── */}
        <GuideInspector />

        {/* ── All modal dialogs and overlay panels ── */}
        <AppShellOverlays
          moveEntry={{ pendingFork, pendingPromotion, onMovePlayed, handleForkDecide, handlePromotionPick, handleCancel: handleCancelMove }}
          onMoveCancel={handleCancel}
          showEditStartPos={showEditStartPos}
          onCloseEditStartPos={(): void => { setShowEditStartPos(false); }}
          currentStartingFen={currentStartingFen}
          activeSessionId={activeSessionId}
          showExtractDialog={showExtractDialog}
          onCloseExtractDialog={(): void => { setShowExtractDialog(false); }}
          currentFen={currentFen}
          currentPly={currentPly}
          sanMoves={moves}
          activeSession={activeSession}
          navigateGuard={navigateGuard}
          confirmDialogRef={confirmDialogRef}
          rawServices={rawServices}
          showEditorStyleDialog={showEditorStyleDialog}
          onCloseEditorStyleDialog={(): void => { setShowEditorStyleDialog(false); }}
          showDefaultLayoutDialog={showDefaultLayoutDialog}
          onCloseDefaultLayoutDialog={(): void => { setShowDefaultLayoutDialog(false); }}
          showNewGameDialog={showNewGameDialog}
          onNewGameCreate={(pgn: string): void => { setShowNewGameDialog(false); void rawServices.newGameInActiveResource(pgn); }}
          onCloseNewGameDialog={(): void => { setShowNewGameDialog(false); }}
          layoutMode={layoutMode}
          state={state}
          showExtDbSettings={showExtDbSettings}
          onCloseExtDbSettings={(): void => { setShowExtDbSettings(false); }}
          extDbSettings={extDbSettings}
          training={training}
          trainingControls={trainingControls}
          trainingSourceRef={trainingSourceRef}
          trainingGameTitle={trainingGameTitle}
          trainingGameContext={trainingGameContext}
          pgnText={pgnText}
          showAnnotateDialog={showAnnotateDialog}
          onCloseAnnotateDialog={(): void => { setShowAnnotateDialog(false); }}
          gameAnnotation={gameAnnotation}
          engineName={engineName}
          showVsEngineDialog={showVsEngineDialog}
          onCloseVsEngineDialog={(): void => { setShowVsEngineDialog(false); }}
          vsEngine={vsEngine}
          browserPanelState={browserPanelState}
          onCaptureResult={handleCaptureResult}
          onCloseBrowserPanel={closeBrowserPanel}
          services={services}
          t={t}
        />
      </main>
    </ServiceContextProvider>
  );
};
