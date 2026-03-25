/**
 * ToolbarRow — navigation, format, layout, and action toolbar for the PGN editor.
 *
 * Renders the full toolbar row: navigation buttons, comment-format buttons,
 * PGN layout selector, and action buttons (save, study, train, annotate,
 * vs-engine, undo, redo). All state and callbacks flow in as props from
 * AppShell so this component is a pure presentation layer.
 *
 * Integration API:
 * - `<ToolbarRow {...props} />` — rendered by AppShell inside the editor pane.
 *
 * Communication API:
 * - All interactions fire the corresponding callback prop.
 */

import type { ReactElement } from "react";

type ToolbarRowProps = {
  isAtStart: boolean;
  isAtEnd: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  boardFlipped: boolean;
  layoutMode: "plain" | "text" | "tree";
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
  onSetLayoutMode: (mode: "plain" | "text" | "tree") => void;
  onApplyDefaultIndent: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShowEditStartPos: () => void;
  onShowExtractDialog: () => void;
  onShowHint: () => void;
  onStartStudy: () => void;
  onShowTrainingLauncher: () => void;
  onShowAnnotateDialog: () => void;
  onVsEngineClick: () => void;
};

export const ToolbarRow = ({
  isAtStart, isAtEnd, canUndo, canRedo, isDirty, boardFlipped,
  layoutMode, isSetUpGame, studyItemCount, studyActive,
  trainingPhase, engineName, vsEngineActive, t,
  onGotoFirst, onGotoPrev, onGotoNext, onGotoLast, onFlipBoard,
  onSetLayoutMode, onApplyDefaultIndent, onSave, onUndo, onRedo,
  onShowEditStartPos, onShowExtractDialog, onShowHint,
  onStartStudy, onShowTrainingLauncher, onShowAnnotateDialog, onVsEngineClick,
}: ToolbarRowProps): ReactElement => (
  <div className="toolbar-box">
    <div className="move-toolbar">
      {/* Navigation button group */}
      <div className="toolbar-group toolbar-group-nav">
        <button id="btn-first" className="icon-button" type="button"
          title={t("controls.first", "|<")} disabled={isAtStart} onClick={onGotoFirst}>
          <img src="/icons/toolbar/nav-first.svg" alt={t("controls.first", "|<")} />
        </button>
        <button id="btn-prev" className="icon-button" type="button"
          title={t("controls.prev", "<")} disabled={isAtStart} onClick={onGotoPrev}>
          <img src="/icons/toolbar/nav-prev.svg" alt={t("controls.prev", "<")} />
        </button>
        <button id="btn-next" className="icon-button" type="button"
          title={t("controls.next", ">")} disabled={isAtEnd} onClick={onGotoNext}>
          <img src="/icons/toolbar/nav-next.svg" alt={t("controls.next", ">")} />
        </button>
        <button id="btn-last" className="icon-button" type="button"
          title={t("controls.last", ">|")} disabled={isAtEnd} onClick={onGotoLast}>
          <img src="/icons/toolbar/nav-last.svg" alt={t("controls.last", ">|")} />
        </button>
        <button id="btn-flip-board" className="icon-button" type="button"
          title={t("toolbar.flipBoard", "Flip board")} onClick={onFlipBoard}
          aria-label={t("toolbar.flipBoard", "Flip board")}>
          <span className="flip-board-indicator" aria-hidden="true">
            <span className={`flip-board-top ${boardFlipped ? "flip-board-white" : "flip-board-black"}`} />
            <span className={`flip-board-bottom ${boardFlipped ? "flip-board-black" : "flip-board-white"}`} />
          </span>
        </button>
      </div>

      {/* Edit / format button group */}
      <div className="toolbar-group toolbar-group-edit">
        <button id="btn-comment-bold"
          className="icon-button icon-button-text icon-button-format" type="button"
          title={t("toolbar.commentBold", "Bold comment text")}
          aria-label={t("toolbar.commentBold", "Bold comment text")}>
          <strong>B</strong>
        </button>
        <button id="btn-comment-italic"
          className="icon-button icon-button-text icon-button-format" type="button"
          title={t("toolbar.commentItalic", "Italic comment text")}
          aria-label={t("toolbar.commentItalic", "Italic comment text")}>
          <em>I</em>
        </button>
        <button id="btn-comment-underline"
          className="icon-button icon-button-text icon-button-format" type="button"
          title={t("toolbar.commentUnderline", "Underline comment text")}
          aria-label={t("toolbar.commentUnderline", "Underline comment text")}>
          <u>U</u>
        </button>

        {/* PGN layout buttons */}
        <div className="toolbar-pgn-layout" role="radiogroup"
          aria-label={t("toolbar.pgnLayout.group", "PGN layout")}>
          <button id="btn-pgn-layout-plain" type="button" data-pgn-layout="plain"
            className={`icon-button icon-button-text pgn-layout-btn${layoutMode === "plain" ? " active" : ""}`}
            title={t("toolbar.pgnLayout.plain", "Plain — literal PGN")}
            aria-pressed={layoutMode === "plain" ? "true" : "false"}
            onClick={(): void => { onSetLayoutMode("plain"); }}>
            {t("toolbar.pgnLayout.plainShort", "Plain")}
          </button>
          <button id="btn-pgn-layout-text" type="button" data-pgn-layout="text"
            className={`icon-button icon-button-text pgn-layout-btn${layoutMode === "text" ? " active" : ""}`}
            title={t("toolbar.pgnLayout.text", "Text — narrative layout")}
            aria-pressed={layoutMode === "text" ? "true" : "false"}
            onClick={(): void => { onSetLayoutMode("text"); }}>
            {t("toolbar.pgnLayout.textShort", "Text")}
          </button>
          <button id="btn-pgn-layout-tree" type="button" data-pgn-layout="tree"
            className={`icon-button icon-button-text pgn-layout-btn${layoutMode === "tree" ? " active" : ""}`}
            title={t("toolbar.pgnLayout.tree", "Tree — structure view (same as Text for now)")}
            aria-pressed={layoutMode === "tree" ? "true" : "false"}
            onClick={(): void => { onSetLayoutMode("tree"); }}>
            {t("toolbar.pgnLayout.treeShort", "Tree")}
          </button>
        </div>

        <button id="btn-comment-left" className="icon-button" type="button"
          title={t("toolbar.commentLeft", "Insert comment left")}>
          <img src="/icons/toolbar/comment-left.svg" alt={t("toolbar.commentLeft", "Insert comment left")} />
        </button>
        <button id="btn-comment-right" className="icon-button" type="button"
          title={t("toolbar.commentRight", "Insert comment right")}>
          <img src="/icons/toolbar/comment-right.svg" alt={t("toolbar.commentRight", "Insert comment right")} />
        </button>
        <button id="btn-linebreak" className="icon-button" type="button"
          title={t("toolbar.linebreak", "Insert line break")}>
          <img src="/icons/toolbar/linebreak.svg" alt={t("toolbar.linebreak", "Insert line break")} />
        </button>
        <button id="btn-indent" className="icon-button" type="button"
          title={t("toolbar.indent", "Insert indent")}>
          <img src="/icons/toolbar/indent.svg" alt={t("toolbar.indent", "Insert indent")} />
        </button>
        <button id="btn-default-indent" className="icon-button" type="button"
          title={t("pgn.defaultIndent", "Default indent")} onClick={onApplyDefaultIndent}>
          <img src="/icons/toolbar/default-indent.svg" alt={t("pgn.defaultIndent", "Default indent")} />
        </button>

        {isSetUpGame && (
          <button id="btn-edit-start-pos" className="icon-button icon-button-text" type="button"
            title={t("toolbar.editStartPos", "Edit starting position")} onClick={onShowEditStartPos}>
            {t("toolbar.editStartPosShort", "Position")}
          </button>
        )}
        <button id="btn-save"
          className={`icon-button icon-button-text${isDirty ? " icon-button--dirty" : ""}`}
          type="button"
          title={t("toolbar.save", "Save game (Ctrl+S)")} disabled={!isDirty} onClick={onSave}>
          {t("toolbar.saveShort", "Save")}
        </button>
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
        <button id="btn-undo" className="icon-button" type="button"
          title={t("toolbar.undo", "Undo")} disabled={!canUndo} onClick={onUndo}>
          <img src="/icons/toolbar/undo.svg" alt={t("toolbar.undo", "Undo")} />
        </button>
        <button id="btn-redo" className="icon-button" type="button"
          title={t("toolbar.redo", "Redo")} disabled={!canRedo} onClick={onRedo}>
          <img src="/icons/toolbar/redo.svg" alt={t("toolbar.redo", "Redo")} />
        </button>
      </div>
    </div>
  </div>
);
