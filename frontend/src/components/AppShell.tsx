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

import { useRef, useEffect } from "react";
import type { ReactElement } from "react";
import { createGameIngressHandlers } from "../game_sessions/ingress_handlers";
import { isLikelyPgnText } from "../runtime/bootstrap_shared";
import { useAppContext } from "../state/app_context";
import {
  selectCurrentPly,
  selectLayoutMode,
  selectMoveCount,
  selectUndoDepth,
  selectRedoDepth,
} from "../state/selectors";
import { useTranslator } from "../hooks/useTranslator";
import { useAppStartup } from "../hooks/useAppStartup";
import { ServiceContextProvider } from "../state/ServiceContext";
import type { AppStartupServices } from "../state/ServiceContext";
import { MenuPanel } from "./MenuPanel";
import { DevDock } from "./DevDock";
import { GameInfoEditor } from "./GameInfoEditor";
import { GameSessionsPanel } from "./GameSessionsPanel";
import { ChessBoard } from "./ChessBoard";
import { PgnTextEditor } from "./PgnTextEditor";
import { ResourceViewer } from "./ResourceViewer";

/** Root application shell component. */
export const AppShell = (): ReactElement => {
  const { state } = useAppContext();
  const currentPly: number = selectCurrentPly(state);
  const moveCount: number = selectMoveCount(state);
  const layoutMode: "plain" | "text" | "tree" = selectLayoutMode(state);
  const undoDepth: number = selectUndoDepth(state);
  const redoDepth: number = selectRedoDepth(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  /** Initialise all services; returns stable callbacks for the service context. */
  const services: AppStartupServices = useAppStartup();

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
            <ChessBoard />

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
      </main>
    </ServiceContextProvider>
  );
};
