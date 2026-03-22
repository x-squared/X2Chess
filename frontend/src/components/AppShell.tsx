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
import { createGameIngressHandlers } from "../game_sessions/ingress_handlers";
import { isLikelyPgnText } from "../runtime/bootstrap_shared";
import { useAppContext } from "../state/app_context";
import {
  selectCurrentPly,
  selectLayoutMode,
  selectMoveCount,
  selectUndoDepth,
  selectRedoDepth,
  selectMoves,
  selectPgnText,
  selectPgnModel,
  selectSessions,
  selectActiveSessionId,
} from "../state/selectors";
import { useTranslator } from "../hooks/useTranslator";
import { useAppStartup } from "../hooks/useAppStartup";
import { useEngineAnalysis } from "../hooks/useEngineAnalysis";
import { useOpeningExplorer } from "../hooks/useOpeningExplorer";
import { useTablebaseProbe } from "../hooks/useTablebaseProbe";
import { useVsEngine } from "../hooks/useVsEngine";
import { useMoveEntry } from "../hooks/useMoveEntry";
import { collectStudyItems } from "../model/study_items";
import { getHeaderValue } from "../model/pgn_headers";
import { STANDARD_STARTING_FEN } from "../editor/fen_utils";
import { ServiceContextProvider } from "../state/ServiceContext";
import type { AppStartupServices } from "../state/ServiceContext";
import { MenuPanel } from "./MenuPanel";
import { DevDock } from "./DevDock";
import { GameInfoEditor } from "./GameInfoEditor";
import { GameSessionsPanel } from "./GameSessionsPanel";
import { ChessBoard } from "./ChessBoard";
import { PgnTextEditor } from "./PgnTextEditor";
import { ResourceViewer } from "./ResourceViewer";
import { AnalysisPanel } from "./AnalysisPanel";
import { OpeningExplorerPanel } from "./OpeningExplorerPanel";
import { TablebasePanel } from "./TablebasePanel";
import { PlayVsEngineDialog } from "./PlayVsEngineDialog";
import { DisambiguationDialog } from "./DisambiguationDialog";
import { PromotionPicker } from "./PromotionPicker";
import { ExtractPositionDialog } from "./ExtractPositionDialog";
import { EditStartPositionDialog } from "./EditStartPositionDialog";
import { StudyOverlay } from "./StudyOverlay";
import type { PromotionPiece } from "./PromotionPicker";
import { useTrainingSession } from "../training/hooks/useTrainingSession";
import { REPLAY_PROTOCOL } from "../training/protocols/replay_protocol";
import { TrainingLauncher } from "../training/components/TrainingLauncher";
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
  const moveCount: number = selectMoveCount(state);
  const layoutMode: "plain" | "text" | "tree" = selectLayoutMode(state);
  const undoDepth: number = selectUndoDepth(state);
  const redoDepth: number = selectRedoDepth(state);
  const moves: string[] = selectMoves(state);
  const pgnText: string = selectPgnText(state);
  const sessions = selectSessions(state);
  const activeSessionId = selectActiveSessionId(state);
  const activeSession = sessions.find((s) => s.sessionId === activeSessionId);
  const t: (key: string, fallback?: string) => string = useTranslator();

  const { variations, isAnalyzing, engineName, startAnalysis, stopAnalysis, findBestMove } =
    useEngineAnalysis();

  // G8: play vs engine
  const vsEngine = useVsEngine(findBestMove);
  const [showVsEngineDialog, setShowVsEngineDialog] = useState(false);

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

  const openingExplorer = useOpeningExplorer(currentFen);
  const tablebase = useTablebaseProbe(currentFen);
  const sideToMove: "w" | "b" = currentFen.split(" ")[1] === "b" ? "b" : "w";

  const handleStartAnalysis = useCallback((): void => {
    startAnalysis({ fen: currentFen, moves: [] });
  }, [startAnalysis, currentFen]);

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
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);
  useEffect((): void => { setHintMove(null); }, [currentPly]);
  const handleShowHint = useCallback((): void => {
    const bestPv = variations[0]?.pv;
    if (!bestPv?.length) {
      startAnalysis({ fen: currentFen, moves: [] });
      return;
    }
    const uciMove = bestPv[0];
    if (uciMove && uciMove.length >= 4) {
      setHintMove({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4) });
    }
  }, [variations, currentFen, startAnalysis]);

  const {
    pendingFork,
    pendingPromotion,
    onMovePlayed,
    handleForkDecide,
    handlePromotionPick,
    handleCancel,
  } = useMoveEntry();

  // ── Training session ───────────────────────────────────────────────────────
  const trainingControls = useTrainingSession(REPLAY_PROTOCOL);
  const [showTrainingLauncher, setShowTrainingLauncher] = useState(false);
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
  const trainingSourceRef = activeSession?.sourceLocator || activeSession?.sessionId || "";
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
  const vertResizeHandleRef = useRef<HTMLDivElement>(null);
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

  // Wire up resource viewer vertical resize handle.
  useEffect((): (() => void) => {
    const handleEl = vertResizeHandleRef.current;
    if (!handleEl) return (): void => {};

    const clampRV = (px: number): number => Math.max(120, Math.min(600, Math.round(px)));
    const clampBW = (px: number): number => Math.max(260, Math.min(680, Math.round(px)));

    const getCSSInt = (prop: string, fallback: number): number => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(prop);
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : fallback;
    };

    let startY = 0;
    let startRV = 0;
    let startBW = 0;

    const onMove = (e: PointerEvent): void => {
      const delta = e.clientY - startY;
      const newRV = clampRV(startRV - delta);
      const newBW = clampBW(Math.min(intendedBoardWidthRef.current, startBW + delta));
      document.documentElement.style.setProperty("--resource-viewer-height", `${newRV}px`);
      document.documentElement.style.setProperty("--board-column-width", `${newBW}px`);
    };
    const onUp = (): void => {};
    const onDown = (e: PointerEvent): void => {
      startY = e.clientY;
      startRV = getCSSInt("--resource-viewer-height", 260);
      startBW = getCSSInt("--board-column-width", 520);
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

  useEffect((): void => {
    const { bindEvents } = createGameIngressHandlers({
      appPanelEl: appPanelRef.current,
      isLikelyPgnText,
      openGameFromIncomingText: (pgnText: string): boolean => {
        services.openPgnText(pgnText);
        return true;
      },
      setDropOverlayVisible: (visible: boolean): void => {
        if (overlayRef.current) overlayRef.current.hidden = !visible;
      },
    });
    bindEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl/Cmd+S — save active game.
  useEffect((): (() => void) => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        services.saveActiveGameNow();
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
          <section className="game-tabs-card">
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
          <div ref={boardEditorBoxRef} id="board-editor-box" className="board-editor-box">
            {/* Chessboard */}
            <ChessBoard onMovePlayed={effectiveOnMovePlayed} hintMove={hintMove} />

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
                onHint={trainingControls.requestHint}
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
            <div className="text-editor-wrap board-editor-pane">
              <div className="toolbar-box">
                <div className="move-toolbar">
                  {/* Navigation button group */}
                  <div className="toolbar-group toolbar-group-nav">
                    <button
                      id="btn-first"
                      className="icon-button"
                      type="button"
                      title={t("controls.first", "|<")}
                      disabled={isAtStart}
                      onClick={(): void => { services.gotoFirst(); }}
                    >
                      <img src="/icons/toolbar/nav-first.svg" alt={t("controls.first", "|<")} />
                    </button>
                    <button
                      id="btn-prev"
                      className="icon-button"
                      type="button"
                      title={t("controls.prev", "<")}
                      disabled={isAtStart}
                      onClick={(): void => { services.gotoPrev(); }}
                    >
                      <img src="/icons/toolbar/nav-prev.svg" alt={t("controls.prev", "<")} />
                    </button>
                    <button
                      id="btn-next"
                      className="icon-button"
                      type="button"
                      title={t("controls.next", ">")}
                      disabled={isAtEnd}
                      onClick={(): void => { services.gotoNext(); }}
                    >
                      <img src="/icons/toolbar/nav-next.svg" alt={t("controls.next", ">")} />
                    </button>
                    <button
                      id="btn-last"
                      className="icon-button"
                      type="button"
                      title={t("controls.last", ">|")}
                      disabled={isAtEnd}
                      onClick={(): void => { services.gotoLast(); }}
                    >
                      <img src="/icons/toolbar/nav-last.svg" alt={t("controls.last", ">|")} />
                    </button>
                  </div>

                  {/* Edit / format button group */}
                  <div className="toolbar-group toolbar-group-edit">
                    <button
                      id="btn-comment-bold"
                      className="icon-button icon-button-text icon-button-format"
                      type="button"
                      title={t("toolbar.commentBold", "Bold comment text")}
                      aria-label={t("toolbar.commentBold", "Bold comment text")}
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      id="btn-comment-italic"
                      className="icon-button icon-button-text icon-button-format"
                      type="button"
                      title={t("toolbar.commentItalic", "Italic comment text")}
                      aria-label={t("toolbar.commentItalic", "Italic comment text")}
                    >
                      <em>I</em>
                    </button>
                    <button
                      id="btn-comment-underline"
                      className="icon-button icon-button-text icon-button-format"
                      type="button"
                      title={t("toolbar.commentUnderline", "Underline comment text")}
                      aria-label={t("toolbar.commentUnderline", "Underline comment text")}
                    >
                      <u>U</u>
                    </button>

                    {/* PGN layout buttons */}
                    <div
                      className="toolbar-pgn-layout"
                      role="radiogroup"
                      aria-label={t("toolbar.pgnLayout.group", "PGN layout")}
                    >
                      <button
                        id="btn-pgn-layout-plain"
                        className={`icon-button icon-button-text pgn-layout-btn${layoutMode === "plain" ? " active" : ""}`}
                        type="button"
                        data-pgn-layout="plain"
                        title={t("toolbar.pgnLayout.plain", "Plain — literal PGN")}
                        aria-pressed={layoutMode === "plain" ? "true" : "false"}
                        onClick={(): void => { services.setLayoutMode("plain"); }}
                      >
                        {t("toolbar.pgnLayout.plainShort", "Plain")}
                      </button>
                      <button
                        id="btn-pgn-layout-text"
                        className={`icon-button icon-button-text pgn-layout-btn${layoutMode === "text" ? " active" : ""}`}
                        type="button"
                        data-pgn-layout="text"
                        title={t("toolbar.pgnLayout.text", "Text — narrative layout")}
                        aria-pressed={layoutMode === "text" ? "true" : "false"}
                        onClick={(): void => { services.setLayoutMode("text"); }}
                      >
                        {t("toolbar.pgnLayout.textShort", "Text")}
                      </button>
                      <button
                        id="btn-pgn-layout-tree"
                        className={`icon-button icon-button-text pgn-layout-btn${layoutMode === "tree" ? " active" : ""}`}
                        type="button"
                        data-pgn-layout="tree"
                        title={t(
                          "toolbar.pgnLayout.tree",
                          "Tree — structure view (same as Text for now)",
                        )}
                        aria-pressed={layoutMode === "tree" ? "true" : "false"}
                        onClick={(): void => { services.setLayoutMode("tree"); }}
                      >
                        {t("toolbar.pgnLayout.treeShort", "Tree")}
                      </button>
                    </div>

                    <button
                      id="btn-comment-left"
                      className="icon-button"
                      type="button"
                      title={t("toolbar.commentLeft", "Insert comment left")}
                    >
                      <img
                        src="/icons/toolbar/comment-left.svg"
                        alt={t("toolbar.commentLeft", "Insert comment left")}
                      />
                    </button>
                    <button
                      id="btn-comment-right"
                      className="icon-button"
                      type="button"
                      title={t("toolbar.commentRight", "Insert comment right")}
                    >
                      <img
                        src="/icons/toolbar/comment-right.svg"
                        alt={t("toolbar.commentRight", "Insert comment right")}
                      />
                    </button>
                    <button
                      id="btn-linebreak"
                      className="icon-button"
                      type="button"
                      title={t("toolbar.linebreak", "Insert line break")}
                    >
                      <img
                        src="/icons/toolbar/linebreak.svg"
                        alt={t("toolbar.linebreak", "Insert line break")}
                      />
                    </button>
                    <button
                      id="btn-indent"
                      className="icon-button"
                      type="button"
                      title={t("toolbar.indent", "Insert indent")}
                    >
                      <img
                        src="/icons/toolbar/indent.svg"
                        alt={t("toolbar.indent", "Insert indent")}
                      />
                    </button>
                    <button
                      id="btn-default-indent"
                      className="icon-button"
                      type="button"
                      title={t("pgn.defaultIndent", "Default indent")}
                      onClick={(): void => { services.applyDefaultIndent(); }}
                    >
                      <img
                        src="/icons/toolbar/default-indent.svg"
                        alt={t("pgn.defaultIndent", "Default indent")}
                      />
                    </button>
                    {isSetUpGame && (
                      <button
                        id="btn-edit-start-pos"
                        className="icon-button icon-button-text"
                        type="button"
                        title={t("toolbar.editStartPos", "Edit starting position")}
                        onClick={(): void => { setShowEditStartPos(true); }}
                      >
                        {t("toolbar.editStartPosShort", "Position")}
                      </button>
                    )}
                    <button
                      id="btn-save"
                      className={`icon-button icon-button-text${isDirty ? " icon-button--dirty" : ""}`}
                      type="button"
                      title={t("toolbar.save", "Save game (Ctrl+S)")}
                      disabled={!isDirty}
                      onClick={(): void => { services.saveActiveGameNow(); }}
                    >
                      {t("toolbar.saveShort", "Save")}
                    </button>
                    <button
                      id="btn-study"
                      className="icon-button icon-button-text"
                      type="button"
                      title={t("toolbar.study", "Start study mode (Q/A prompts)")}
                      disabled={studyItems.length === 0 || studyActive}
                      onClick={handleStartStudy}
                    >
                      {t("toolbar.studyShort", "Study")}
                    </button>
                    <button
                      id="btn-extract"
                      className="icon-button icon-button-text"
                      type="button"
                      title={t("toolbar.extract", "Extract current position as new game")}
                      onClick={(): void => { setShowExtractDialog(true); }}
                    >
                      {t("toolbar.extractShort", "Extract")}
                    </button>
                    <button
                      id="btn-hint"
                      className="icon-button icon-button-text"
                      type="button"
                      title={t("toolbar.hint", "Show best-move hint")}
                      onClick={handleShowHint}
                    >
                      {t("toolbar.hintShort", "Hint")}
                    </button>
                    <button
                      id="btn-train"
                      className="icon-button icon-button-text"
                      type="button"
                      title={t("toolbar.train", "Start training session")}
                      disabled={trainingControls.phase !== "idle"}
                      onClick={(): void => { setShowTrainingLauncher(true); }}
                    >
                      {t("toolbar.trainShort", "Train")}
                    </button>
                    <button
                      id="btn-vs-engine"
                      className={`icon-button icon-button-text${vsEngine.active ? " icon-button--active" : ""}`}
                      type="button"
                      title={vsEngine.active ? t("toolbar.vsEngineStop", "Stop engine game") : t("toolbar.vsEngine", "Play vs engine")}
                      disabled={!engineName}
                      onClick={(): void => {
                        if (vsEngine.active) vsEngine.stop();
                        else setShowVsEngineDialog(true);
                      }}
                    >
                      {vsEngine.active ? t("toolbar.vsEngineStopShort", "Stop") : t("toolbar.vsEngineShort", "vs Engine")}
                    </button>
                    <button
                      id="btn-undo"
                      className="icon-button"
                      type="button"
                      title={t("toolbar.undo", "Undo")}
                      disabled={!canUndo}
                      onClick={(): void => { services.undo(); }}
                    >
                      <img src="/icons/toolbar/undo.svg" alt={t("toolbar.undo", "Undo")} />
                    </button>
                    <button
                      id="btn-redo"
                      className="icon-button"
                      type="button"
                      title={t("toolbar.redo", "Redo")}
                      disabled={!canRedo}
                      onClick={(): void => { services.redo(); }}
                    >
                      <img src="/icons/toolbar/redo.svg" alt={t("toolbar.redo", "Redo")} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor area — React PgnTextEditor */}
              <div className="editor-box">
                <PgnTextEditor />
              </div>
            </div>
          </div>

          {/* ── Engine analysis panel ── */}
          <AnalysisPanel
            variations={variations}
            isAnalyzing={isAnalyzing}
            engineName={engineName}
            sideToMove={sideToMove}
            t={t}
            onStartAnalysis={handleStartAnalysis}
            onStopAnalysis={stopAnalysis}
          />

          {/* ── Opening explorer panel (E1) ── */}
          <OpeningExplorerPanel
            result={openingExplorer.result}
            isLoading={openingExplorer.isLoading}
            source={openingExplorer.source}
            onSourceChange={openingExplorer.setSource}
            enabled={openingExplorer.enabled}
            onToggle={openingExplorer.setEnabled}
            t={t}
          />

          {/* ── Tablebase probe panel (E2) ── */}
          <TablebasePanel
            result={tablebase.result}
            isLoading={tablebase.isLoading}
            enabled={tablebase.enabled}
            onToggle={tablebase.setEnabled}
            t={t}
          />

          {/* Vertical resize handle (between board/editor and resource viewer) */}
          <div
            ref={vertResizeHandleRef}
            id="resource-viewer-resize-handle"
            className="resource-viewer-resize-handle"
            aria-hidden="true"
          />

          {/* ── Resource viewer card ── */}
          <ResourceViewer />
        </section>

        {/* ── Developer dock ── */}
        <DevDock />

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
      </main>
    </ServiceContextProvider>
  );
};
