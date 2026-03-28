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
 * - `onApplyDefaultIndent()` — fires when the default-indent button is clicked.
 * - `onSave()` — fires when the save button is clicked.
 * - `onUndo()` / `onRedo()` — fire when the undo/redo buttons are clicked.
 * - `onOpenBoardSettings()` — fires when the board settings (⚙) button is clicked.
 */

import type { ReactElement } from "react";
import { GUIDE_IDS } from "../guide/guide_ids";

type TextEditorSidebarProps = {
  layoutMode: "plain" | "text" | "tree";
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  t: (key: string, fallback?: string) => string;
  onSetLayoutMode: (mode: "plain" | "text" | "tree") => void;
  onApplyDefaultIndent: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenBoardSettings: () => void;
};

export const TextEditorSidebar = ({
  layoutMode,
  canUndo,
  canRedo,
  isDirty,
  t,
  onSetLayoutMode,
  onApplyDefaultIndent,
  onSave,
  onUndo,
  onRedo,
  onOpenBoardSettings,
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
      id="btn-default-indent"
      className="icon-button"
      type="button"
      title={t("pgn.defaultIndent", "Default indent")}
      onClick={onApplyDefaultIndent}
    >
      <img src="/icons/toolbar/default-indent.svg" alt={t("pgn.defaultIndent", "Default indent")} />
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
