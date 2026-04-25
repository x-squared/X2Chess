/**
 * TextEditorSidebar — vertical strip of text-editor toolbar buttons.
 *
 * Sits to the right of the PgnTextEditor and contains controls that
 * apply to the PGN text itself: layout mode selection, default-indent,
 * comment formatting, save, undo, and redo.
 *
 * Integration API:
 * - `<TextEditorSidebar {...props} />` — rendered as a sibling of the
 *   editor-box div inside the board-editor-pane.
 *
 * Configuration API:
 * - `layoutMode` — currently active layout mode; drives button active state.
 * - `canUndo`, `canRedo` — drive disabled state of undo/redo buttons.
 * - `isDirty` — drives visual indicator and disabled state of save button.
 * - `commentFormatEnabled` — enables the comment-formatting button; should be
 *   `true` whenever `layoutMode !== "plain"`.
 *
 * Communication API:
 * - `onSetLayoutMode(mode)` — fires when a layout mode button is clicked.
 * - `onApplyDefaultIndent()` — fires when the Default Layout button is clicked.
 * - `onOpenDefaultLayoutConfig()` — fires when the Default Layout configure button is clicked.
 * - `onFormatComment(format)` — fires when a format is chosen from the dropdown.
 * - `onSave()` — fires when the save button is clicked.
 * - `onUndo()` / `onRedo()` — fire when the undo/redo buttons are clicked.
 * - `onOpenBoardSettings()` — fires when the board settings (⚙) button is clicked.
 */

import { useState } from "react";
import type { ReactElement } from "react";
import { UI_IDS } from "../../../core/model/ui_ids";
import type { CommentFormat } from "./comment_markdown_format";

// ── LayoutModeGroup ───────────────────────────────────────────────────────────

type LayoutModeGroupProps = {
  layoutMode: "plain" | "text" | "tree";
  t: (key: string, fallback?: string) => string;
  onSetLayoutMode: (mode: "plain" | "text" | "tree") => void;
};

/**
 * Three-button radio group for selecting the PGN editor layout mode.
 * Extracted to keep `TextEditorSidebar` within complexity budget.
 *
 * Integration API:
 * - `<LayoutModeGroup layoutMode={...} t={...} onSetLayoutMode={...} />`
 *
 * Configuration API:
 * - `layoutMode` — active mode; drives `active` class and `aria-pressed`.
 * - `t` — translator function.
 * - `onSetLayoutMode(mode)` — fires when a button is clicked.
 *
 * Communication API:
 * - Outbound: `onSetLayoutMode`.
 */
const LayoutModeGroup = ({ layoutMode, t, onSetLayoutMode }: LayoutModeGroupProps): ReactElement => (
  <div
    className="text-editor-sidebar-group"
    role="radiogroup"
    aria-label={t("toolbar.pgnLayout.group", "PGN layout")}
    data-ui-id={UI_IDS.EDITOR_SIDEBAR_LAYOUT_GROUP}
  >
    <button
      id="btn-pgn-layout-text"
      type="button"
      data-pgn-layout="text"
      data-ui-id={UI_IDS.EDITOR_SIDEBAR_LAYOUT_TEXT}
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
      data-ui-id={UI_IDS.EDITOR_SIDEBAR_LAYOUT_TREE}
      className={`icon-button${layoutMode === "tree" ? " active" : ""}`}
      title={t("toolbar.pgnLayout.tree", "Tree — structured view")}
      aria-pressed={layoutMode === "tree" ? "true" : "false"}
      onClick={(): void => { onSetLayoutMode("tree"); }}
    >
      <img src="/icons/toolbar/mode-tree.svg" alt={t("toolbar.pgnLayout.treeShort", "Tree")} />
    </button>
  </div>
);

// ── CommentFormatDropdown ─────────────────────────────────────────────────────

type CommentFormatDropdownProps = {
  t: (key: string, fallback?: string) => string;
  onSelect: (format: CommentFormat) => void;
};

/**
 * Dropdown panel listing all comment-formatting actions.
 * Rendered by `TextEditorSidebar` when the "Aa" button is active.
 *
 * Integration API:
 * - `<CommentFormatDropdown t={...} onSelect={...} />` — mount inside the
 *   `.comment-format-anchor` div.
 *
 * Configuration API:
 * - `t` — translator function for button labels.
 * - `onSelect(format)` — called when the user clicks a format item.
 *
 * Communication API:
 * - Outbound: `onSelect`.  No inbound context reads.
 */
const CommentFormatDropdown = ({ t, onSelect }: CommentFormatDropdownProps): ReactElement => {
  const items: [CommentFormat, string, string][] = [
    ["bold",          t("toolbar.commentFormat.bold",         "Bold"),          "⌘B"],
    ["italic",        t("toolbar.commentFormat.italic",       "Italic"),        "⌘I"],
    ["underline",     t("toolbar.commentFormat.underline",    "Underline"),     "⌘U"],
    ["bullet_list",   t("toolbar.commentFormat.bulletList",   "Bullet list"),   ""],
    ["numbered_list", t("toolbar.commentFormat.numberedList", "Numbered list"), ""],
  ];
  return (
    <div className="comment-format-dropdown" role="menu">
      {items.map(([fmt, label, shortcut]: [CommentFormat, string, string]): ReactElement => (
        <button
          key={fmt}
          type="button"
          role="menuitem"
          className="comment-format-dropdown-item"
          onMouseDown={(e): void => { e.preventDefault(); }}
          onClick={(): void => { onSelect(fmt); }}
        >
          <span>{label}</span>
          {shortcut && <span className="comment-format-dropdown-shortcut">{shortcut}</span>}
        </button>
      ))}
    </div>
  );
};

type TextEditorSidebarProps = {
  layoutMode: "plain" | "text" | "tree";
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  /** Whether engine evaluation pills are currently shown (text/tree mode only). */
  showEvalPills: boolean;
  /**
   * Enables the comment-formatting button; should be `true` when
   * `layoutMode !== "plain"` so Markdown syntax is meaningful.
   */
  commentFormatEnabled: boolean;
  t: (key: string, fallback?: string) => string;
  onSetLayoutMode: (mode: "plain" | "text" | "tree") => void;
  onApplyDefaultIndent: () => void;
  onOpenDefaultLayoutConfig: () => void;
  /** Called when the user selects a format from the comment-formatting dropdown. */
  onFormatComment: (format: CommentFormat) => void;
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
  commentFormatEnabled,
  t,
  onSetLayoutMode,
  onApplyDefaultIndent,
  onOpenDefaultLayoutConfig,
  onFormatComment,
  onSave,
  onUndo,
  onRedo,
  onOpenBoardSettings,
  onToggleEvalPills,
}: TextEditorSidebarProps): ReactElement => {
  const [formatDropdownOpen, setFormatDropdownOpen] = useState<boolean>(false);

  let evalPillsTitle: string;
  if (layoutMode === "plain") {
    evalPillsTitle = t("toolbar.evalPills.unavailable", "Eval pills (unavailable in plain mode)");
  } else if (showEvalPills) {
    evalPillsTitle = t("toolbar.evalPills.hide", "Hide engine evaluations");
  } else {
    evalPillsTitle = t("toolbar.evalPills.show", "Show engine evaluations");
  }

  const defaultLayoutTitle: string = layoutMode === "tree"
    ? t("pgn.defaultLayout.unavailable", "Default Layout (unavailable in tree mode)")
    : t("pgn.defaultLayout", "Default Layout");

  const evalPillsActive: boolean = layoutMode !== "plain" && showEvalPills;

  return (
  <div className="text-editor-sidebar" data-ui-id={UI_IDS.EDITOR_SIDEBAR}>
    {/* Layout mode group */}
    <LayoutModeGroup layoutMode={layoutMode} t={t} onSetLayoutMode={onSetLayoutMode} />

    <div className="text-editor-sidebar-sep" />

    {/* Default layout */}
    <button
      id="btn-default-layout"
      className="icon-button"
      type="button"
      title={defaultLayoutTitle}
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

    {/* Comment formatting — single button opening a format-picker dropdown */}
    <div className="comment-format-anchor">
      <button
        id="btn-comment-format"
        className={`icon-button${formatDropdownOpen ? " active" : ""}`}
        type="button"
        title={t("toolbar.commentFormat", "Comment formatting")}
        disabled={!commentFormatEnabled}
        data-ui-id={UI_IDS.EDITOR_SIDEBAR_FORMAT_COMMENT}
        onMouseDown={(e): void => { e.preventDefault(); }}
        onClick={(): void => { setFormatDropdownOpen((v: boolean): boolean => !v); }}
      >
        <span className="comment-format-btn-label" aria-hidden="true">Aa</span>
      </button>
      {formatDropdownOpen && (
        <CommentFormatDropdown
          t={t}
          onSelect={(fmt: CommentFormat): void => {
            onFormatComment(fmt);
            setFormatDropdownOpen(false);
          }}
        />
      )}
    </div>

    <div className="text-editor-sidebar-sep" />

    {/* Eval pill visibility toggle — only meaningful in text/tree mode */}
    <button
      id="btn-toggle-eval-pills"
      type="button"
      className={`icon-button${evalPillsActive ? " active" : ""}`}
      title={evalPillsTitle}
      disabled={layoutMode === "plain"}
      aria-pressed={evalPillsActive ? "true" : "false"}
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
      data-ui-id={UI_IDS.EDITOR_SIDEBAR_BOARD_SETTINGS}
      onClick={onOpenBoardSettings}
    >
      ⚙
    </button>
  </div>
  );
};
