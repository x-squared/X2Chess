/**
 * TextEditorSidebar — vertical strip of text-editor toolbar buttons.
 *
 * Sits to the right of the PgnTextEditor and contains controls that
 * apply to the PGN text itself: layout mode selection, default-indent,
 * save, undo, and redo.
 *
 * Integration API:
 * - `<TextEditorSidebar {...props} />` — rendered as a sibling of the
 *   editor-box div inside the board-editor-pane.
 *
 * Configuration API:
 * - `layoutMode` — currently active layout mode; drives button active state.
 * - `canUndo`, `canRedo` — drive disabled state of undo/redo buttons.
 * - `isDirty` — drives visual indicator and disabled state of save button.
 *
 * Communication API:
 * - `onSetLayoutMode(mode)` — fires when a layout mode button is clicked.
 * - `onInsertIndentMarker()` — inserts `[[indent]]` at the current comment caret.
 * - `onInsertDeindentMarker()` — inserts `[[deindent]]` at the current comment caret.
 * - `onApplyDefaultIndent()` — fires when the Default Layout button is clicked.
 * - `onOpenDefaultLayoutConfig()` — fires when the Default Layout configure button is clicked.
 * - `onSave()` — fires when the save button is clicked.
 * - `onUndo()` / `onRedo()` — fire when the undo/redo buttons are clicked.
 * - `onOpenBoardSettings()` — fires when the board settings (⚙) button is clicked.
 */

import type { ReactElement } from "react";
import { GUIDE_IDS } from "../../guide/model/guide_ids";

type TextEditorSidebarProps = {
  layoutMode: "plain" | "text" | "tree";
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  /** Whether engine evaluation pills are currently shown (text/tree mode only). */
  showEvalPills: boolean;
  t: (key: string, fallback?: string) => string;
  onSetLayoutMode: (mode: "plain" | "text" | "tree") => void;
  onInsertIndentMarker: () => void;
  onInsertDeindentMarker: () => void;
  onApplyDefaultIndent: () => void;
  onOpenDefaultLayoutConfig: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenBoardSettings: () => void;
  /** Called when the user toggles evaluation pill visibility. */
  onToggleEvalPills: () => void;
};

export const TextEditorSidebar = ({
  layoutMode,
  canUndo,
  canRedo,
  isDirty,
  showEvalPills,
  t,
  onSetLayoutMode,
  onInsertIndentMarker,
  onInsertDeindentMarker,
  onApplyDefaultIndent,
  onOpenDefaultLayoutConfig,
  onSave,
  onUndo,
  onRedo,
  onOpenBoardSettings,
  onToggleEvalPills,
}: TextEditorSidebarProps): ReactElement => (
  <div className="text-editor-sidebar" data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR}>
    {/* Layout mode group */}
    <div
      className="text-editor-sidebar-group"
      role="radiogroup"
      aria-label={t("toolbar.pgnLayout.group", "PGN layout")}
      data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR_LAYOUT_GROUP}
    >
      <button
        id="btn-pgn-layout-plain"
        data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR_LAYOUT_PLAIN}
        type="button"
        data-pgn-layout="plain"
        className={`icon-button${layoutMode === "plain" ? " active" : ""}`}
        title={t("toolbar.pgnLayout.plain", "Plain — literal PGN")}
        aria-pressed={layoutMode === "plain" ? "true" : "false"}
        onClick={(): void => { onSetLayoutMode("plain"); }}
      >
        <img src="/icons/toolbar/mode-plain.svg" alt={t("toolbar.pgnLayout.plainShort", "Plain")} />
      </button>
      <button
        id="btn-pgn-layout-text"
        type="button"
        data-pgn-layout="text"
        data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR_LAYOUT_TEXT}
        className={`icon-button${layoutMode === "text" ? " active" : ""}`}
        title={t("toolbar.pgnLayout.text", "Text — narrative layout")}
        aria-pressed={layoutMode === "text" ? "true" : "false"}
        onClick={(): void => { onSetLayoutMode("text"); }}
      >
        <img src="/icons/toolbar/mode-text.svg" alt={t("toolbar.pgnLayout.textShort", "Text")} />
      </button>
      <button
        id="btn-pgn-layout-tree"
        type="button"
        data-pgn-layout="tree"
        data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR_LAYOUT_TREE}
        className={`icon-button${layoutMode === "tree" ? " active" : ""}`}
        title={t("toolbar.pgnLayout.tree", "Tree — structured view")}
        aria-pressed={layoutMode === "tree" ? "true" : "false"}
        onClick={(): void => { onSetLayoutMode("tree"); }}
      >
        <img src="/icons/toolbar/mode-tree.svg" alt={t("toolbar.pgnLayout.treeShort", "Tree")} />
      </button>
    </div>

    <div className="text-editor-sidebar-sep" />

    <button
      id="btn-insert-indent-marker"
      className="icon-button"
      type="button"
      title={t("pgn.insertIndentMarker", "Insert indent marker ([[indent]])")}
      onMouseDown={(e): void => { e.preventDefault(); }}
      onClick={onInsertIndentMarker}
    >
      <img src="/icons/toolbar/indent.svg" alt={t("pgn.insertIndentMarkerShort", "Insert indent")} />
    </button>
    <button
      id="btn-insert-deindent-marker"
      className="icon-button"
      type="button"
      title={t("pgn.insertDeindentMarker", "Insert deindent marker ([[deindent]])")}
      onMouseDown={(e): void => { e.preventDefault(); }}
      onClick={onInsertDeindentMarker}
    >
      <img src="/icons/toolbar/default-indent.svg" alt={t("pgn.insertDeindentMarkerShort", "Insert deindent")} />
    </button>

    <button
      id="btn-default-layout"
      className="icon-button"
      type="button"
      title={
        layoutMode === "tree"
          ? t("pgn.defaultLayout.unavailable", "Default Layout (unavailable in tree mode)")
          : t("pgn.defaultLayout", "Default Layout")
      }
      disabled={layoutMode === "tree"}
      onClick={onApplyDefaultIndent}
    >
      <img src="/icons/toolbar/default-indent.svg" alt={t("pgn.defaultLayout", "Default Layout")} />
    </button>
    <button
      id="btn-default-layout-config"
      className="icon-button"
      type="button"
      title={t("pgn.defaultLayout.configure", "Configure Default Layout…")}
      onClick={onOpenDefaultLayoutConfig}
    >
      <span style={{ fontSize: "0.7rem", lineHeight: 1 }}>⚙</span>
    </button>

    <div className="text-editor-sidebar-sep" />

    {/* Eval pill visibility toggle — only meaningful in text/tree mode */}
    <button
      id="btn-toggle-eval-pills"
      type="button"
      className={`icon-button${layoutMode !== "plain" && showEvalPills ? " active" : ""}`}
      title={
        layoutMode === "plain"
          ? t("toolbar.evalPills.unavailable", "Eval pills (unavailable in plain mode)")
          : showEvalPills
            ? t("toolbar.evalPills.hide", "Hide engine evaluations")
            : t("toolbar.evalPills.show", "Show engine evaluations")
      }
      disabled={layoutMode === "plain"}
      aria-pressed={layoutMode !== "plain" && showEvalPills ? "true" : "false"}
      onClick={onToggleEvalPills}
    >
      <span className="eval-toggle-label" aria-hidden="true">±</span>
    </button>

    <div className="text-editor-sidebar-sep" />

    <button
      id="btn-save"
      className={`icon-button${isDirty ? " icon-button--dirty" : ""}`}
      type="button"
      title={t("toolbar.save", "Save game (Ctrl+S)")}
      disabled={!isDirty}
      onClick={onSave}
    >
      <img src="/icons/toolbar/save.svg" alt={t("toolbar.saveShort", "Save")} />
    </button>

    <div className="text-editor-sidebar-sep" />

    <button
      id="btn-undo"
      className="icon-button"
      type="button"
      title={t("toolbar.undo", "Undo")}
      disabled={!canUndo}
      onClick={onUndo}
    >
      <img src="/icons/toolbar/undo.svg" alt={t("toolbar.undo", "Undo")} />
    </button>
    <button
      id="btn-redo"
      className="icon-button"
      type="button"
      title={t("toolbar.redo", "Redo")}
      disabled={!canRedo}
      onClick={onRedo}
    >
      <img src="/icons/toolbar/redo.svg" alt={t("toolbar.redo", "Redo")} />
    </button>

    <div className="text-editor-sidebar-sep" />

    {/* Board settings */}
    <button
      id="btn-board-settings"
      className="icon-button"
      type="button"
      title={t("toolbar.boardSettings", "Board settings")}
      data-guide-id={GUIDE_IDS.EDITOR_SIDEBAR_BOARD_SETTINGS}
      onClick={onOpenBoardSettings}
    >
      ⚙
    </button>
  </div>
);
