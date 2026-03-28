/**
 * ToolbarRow — board navigation and game-action toolbar.
 *
 * Renders the horizontal toolbar above the editor pane: navigation buttons
 * (first/prev/next/last/flip) and game-level action buttons (study, train,
 * annotate, vs-engine, extract, position). Text-editor controls (layout mode,
 * save, undo/redo) are handled by TextEditorSidebar.
 *
 * Integration API:
 * - `<ToolbarRow {...props} />` — rendered by AppShell inside the editor pane,
 *   above the editor-with-sidebar row.
 *
 * Configuration API:
 * - `isAtStart`, `isAtEnd` — disable navigation buttons at game boundaries.
 * - `boardFlipped` — reflects board orientation in the flip indicator.
 * - `isSetUpGame` — shows the Position button when a custom starting FEN is set.
 * - `studyItemCount`, `studyActive` — controls Study button enabled state.
 * - `trainingPhase` — disables Train while a session is in progress.
 * - `engineName` — disables Annotate and vs Engine when no engine is loaded.
 * - `vsEngineActive` — toggles the vs Engine button label/style.
 *
 * Communication API:
 * - `onGotoFirst/Prev/Next/Last()` — navigation callbacks.
 * - `onFlipBoard()` — fires when the flip-board button is clicked.
 * - `onShowEditStartPos()` — fires when Position is clicked.
 * - `onShowExtractDialog()` — fires when Extract is clicked.
 * - `onShowHint()` — fires when Hint is clicked.
 * - `onStartStudy()` — fires when Study is clicked.
 * - `onShowTrainingLauncher()` — fires when Train is clicked.
 * - `onShowAnnotateDialog()` — fires when Annotate is clicked.
 * - `onVsEngineClick()` — fires when vs Engine / Stop is clicked.
 */

import type { ReactElement } from "react";
import { GUIDE_IDS } from "../guide/guide_ids";

type ToolbarRowProps = {
  isAtStart: boolean;
  isAtEnd: boolean;
  boardFlipped: boolean;
  isSetUpGame: boolean;
  studyItemCount: number;
  studyActive: boolean;
  trainingPhase: string;
  engineName: string | null;
  vsEngineActive: boolean;
  t: (key: string, fallback?: string) => string;
  onGotoFirst: () => void;
  onGotoPrev: () => void;
  onGotoNext: () => void;
  onGotoLast: () => void;
  onFlipBoard: () => void;
  onShowEditStartPos: () => void;
  onShowExtractDialog: () => void;
  onShowHint: () => void;
  onStartStudy: () => void;
  onShowTrainingLauncher: () => void;
  onShowAnnotateDialog: () => void;
  onVsEngineClick: () => void;
};

export const ToolbarRow = ({
  isAtStart, isAtEnd, boardFlipped,
  isSetUpGame, studyItemCount, studyActive,
  trainingPhase, engineName, vsEngineActive, t,
  onGotoFirst, onGotoPrev, onGotoNext, onGotoLast, onFlipBoard,
  onShowEditStartPos, onShowExtractDialog, onShowHint,
  onStartStudy, onShowTrainingLauncher, onShowAnnotateDialog, onVsEngineClick,
}: ToolbarRowProps): ReactElement => (
  <div className="toolbar-box" data-guide-id={GUIDE_IDS.TOOLBAR}>
    <div className="move-toolbar">
      {/* Navigation button group */}
      <div className="toolbar-group toolbar-group-nav" data-guide-id={GUIDE_IDS.TOOLBAR_NAV_GROUP}>
        <button id="btn-first" className="icon-button" type="button"
          data-guide-id={GUIDE_IDS.TOOLBAR_NAV_FIRST}
          title={t("controls.first", "|<")} disabled={isAtStart} onClick={onGotoFirst}>
          <img src="/icons/toolbar/nav-first.svg" alt={t("controls.first", "|<")} />
        </button>
        <button id="btn-prev" className="icon-button" type="button"
          data-guide-id={GUIDE_IDS.TOOLBAR_NAV_PREV}
          title={t("controls.prev", "<")} disabled={isAtStart} onClick={onGotoPrev}>
          <img src="/icons/toolbar/nav-prev.svg" alt={t("controls.prev", "<")} />
        </button>
        <button id="btn-next" className="icon-button" type="button"
          data-guide-id={GUIDE_IDS.TOOLBAR_NAV_NEXT}
          title={t("controls.next", ">")} disabled={isAtEnd} onClick={onGotoNext}>
          <img src="/icons/toolbar/nav-next.svg" alt={t("controls.next", ">")} />
        </button>
        <button id="btn-last" className="icon-button" type="button"
          data-guide-id={GUIDE_IDS.TOOLBAR_NAV_LAST}
          title={t("controls.last", ">|")} disabled={isAtEnd} onClick={onGotoLast}>
          <img src="/icons/toolbar/nav-last.svg" alt={t("controls.last", ">|")} />
        </button>
        <button id="btn-flip-board" className="icon-button" type="button"
          data-guide-id={GUIDE_IDS.TOOLBAR_FLIP_BOARD}
          title={t("toolbar.flipBoard", "Flip board")} onClick={onFlipBoard}
          aria-label={t("toolbar.flipBoard", "Flip board")}>
          <span className="flip-board-indicator" aria-hidden="true">
            <span className={`flip-board-top ${boardFlipped ? "flip-board-white" : "flip-board-black"}`} />
            <span className={`flip-board-bottom ${boardFlipped ? "flip-board-black" : "flip-board-white"}`} />
          </span>
        </button>
      </div>

      {/* Board action button group */}
      <div className="toolbar-group toolbar-group-actions" data-guide-id={GUIDE_IDS.TOOLBAR_ACTIONS_GROUP}>
        {isSetUpGame && (
          <button id="btn-edit-start-pos" className="icon-button icon-button-text" type="button"
            title={t("toolbar.editStartPos", "Edit starting position")} onClick={onShowEditStartPos}>
            {t("toolbar.editStartPosShort", "Position")}
          </button>
        )}
        <button id="btn-study" className="icon-button icon-button-text" type="button"
          title={t("toolbar.study", "Start study mode (Q/A prompts)")}
          disabled={studyItemCount === 0 || studyActive} onClick={onStartStudy}>
          {t("toolbar.studyShort", "Study")}
        </button>
        <button id="btn-extract" className="icon-button icon-button-text" type="button"
          title={t("toolbar.extract", "Extract current position as new game")}
          onClick={onShowExtractDialog}>
          {t("toolbar.extractShort", "Extract")}
        </button>
        <button id="btn-hint" className="icon-button icon-button-text" type="button"
          title={t("toolbar.hint", "Show best-move hint")} onClick={onShowHint}>
          {t("toolbar.hintShort", "Hint")}
        </button>
        <button id="btn-train" className="icon-button icon-button-text" type="button"
          title={t("toolbar.train", "Start training session")}
          disabled={trainingPhase !== "idle"} onClick={onShowTrainingLauncher}>
          {t("toolbar.trainShort", "Train")}
        </button>
        <button id="btn-annotate" className="icon-button icon-button-text" type="button"
          title={t("toolbar.annotate", "Annotate game with engine")}
          disabled={!engineName} onClick={onShowAnnotateDialog}>
          {t("toolbar.annotateShort", "Annotate")}
        </button>
        <button id="btn-vs-engine"
          className={`icon-button icon-button-text${vsEngineActive ? " icon-button--active" : ""}`}
          type="button"
          title={vsEngineActive ? t("toolbar.vsEngineStop", "Stop engine game") : t("toolbar.vsEngine", "Play vs engine")}
          disabled={!engineName} onClick={onVsEngineClick}>
          {vsEngineActive ? t("toolbar.vsEngineStopShort", "Stop") : t("toolbar.vsEngineShort", "vs Engine")}
        </button>
      </div>
    </div>
  </div>
);
