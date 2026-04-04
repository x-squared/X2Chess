/**
 * editor_style_prefs — user-configurable visual style for the PGN text editor.
 *
 * Integration API:
 * - `readEditorStylePrefs()` — call once on startup to obtain initial preferences.
 * - `writeEditorStylePrefs(prefs)` — persist updated preferences; call from the
 *   `setEditorStylePrefs` service callback.
 * - `editorStyleToCssVars(prefs)` — convert preferences to CSS custom-property values
 *   for application to the `.text-editor` element via inline `style`.
 * - `DEFAULT_EDITOR_STYLE_PREFS` — shipped defaults.
 *
 * Configuration API:
 * - Storage key: `"x2chess.editorStylePrefs.v1"`.
 * - Version 1 — initial versioned form; no migrations required.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";

// ── Types ─────────────────────────────────────────────────────────────────────

/** CSS font-family token for the editor text. */
export type EditorFontFamily = "inherit" | "ui-serif" | "ui-sans-serif" | "ui-monospace";

/** Sidebar accent (vertical line) on the left edge of a block. */
export type SidebarStyle = {
  enabled: boolean;
  /** Width in pixels (1–6). */
  widthPx: number;
  /** CSS color string, e.g. `"#7c98c8"` or `"rgba(71, 85, 105, 0.52)"`. */
  color: string;
};

/** Visual style for one indentation depth level (text mode). */
export type TextLevelStyle = {
  /** Font size relative to the editor base size, e.g. `1.0` or `0.95`. */
  fontSizeEm: number;
  sidebar: SidebarStyle;
  /** CSS color string, or empty string for transparent/no background. */
  backgroundColor: string;
};

/**
 * Full user-configurable style preferences for the PGN text editor.
 *
 * The preferences are split into global, intro-section, text-mode-specific,
 * and tree-mode-specific sections.  Plain mode has no configurable style
 * beyond the global font settings.
 */
export type EditorStylePrefs = {
  // ── Global ────────────────────────────────────────────────────────────────
  /** CSS font-family for the editor (plain / text / tree). */
  fontFamily: EditorFontFamily;
  /** Base font size in pixels. */
  fontSizePx: number;
  /** Line height multiplier (e.g. 1.45). */
  lineHeight: number;

  // ── Intro section (text + tree mode) ─────────────────────────────────────
  intro: {
    /** Left sidebar accent on the intro comment block. */
    sidebar: SidebarStyle;
    /** Background tint of the intro comment block; empty = no background. */
    backgroundColor: string;
    /** Bottom margin between the intro block and the first move, in rem. */
    paddingBottomRem: number;
    /** Whether mainline move tokens are rendered in bold. */
    mainLineBold: boolean;
  };

  // ── Text mode ─────────────────────────────────────────────────────────────
  text: {
    /** Horizontal indent per nesting level, in rem. */
    indentStepRem: number;
    /** Visual style for depth-1 indented blocks. */
    level1: TextLevelStyle;
    /** Visual style for depth-2 indented blocks. */
    level2: TextLevelStyle;
    /** Visual style for depth-3 and deeper indented blocks. */
    level3plus: TextLevelStyle;
  };

  // ── Tree mode ─────────────────────────────────────────────────────────────
  tree: {
    /** Horizontal indent per variation depth level, in em. */
    indentStepEm: number;
    /** Background fill of variation-label pill buttons. */
    pillBackgroundColor: string;
    /** Border color of variation-label pill buttons. */
    pillBorderColor: string;
    /** Text color of variation-label pill buttons. */
    pillTextColor: string;
  };
};

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_EDITOR_STYLE_PREFS: EditorStylePrefs = {
  fontFamily: "inherit",
  fontSizePx: 14,
  lineHeight: 1.45,
  intro: {
    sidebar: { enabled: true, widthPx: 3, color: "#7c98c8" },
    backgroundColor: "#f4f8ff",
    paddingBottomRem: 0.45,
    mainLineBold: true,
  },
  text: {
    indentStepRem: 0.9,
    level1: {
      fontSizeEm: 1.0,
      sidebar: { enabled: true, widthPx: 3, color: "rgba(71, 85, 105, 0.52)" },
      backgroundColor: "rgba(100, 116, 139, 0.08)",
    },
    level2: {
      fontSizeEm: 1.0,
      sidebar: { enabled: true, widthPx: 2, color: "rgba(100, 116, 139, 0.44)" },
      backgroundColor: "rgba(71, 85, 105, 0.1)",
    },
    level3plus: {
      fontSizeEm: 0.95,
      sidebar: { enabled: true, widthPx: 2, color: "rgba(100, 116, 139, 0.34)" },
      backgroundColor: "rgba(51, 65, 85, 0.12)",
    },
  },
  tree: {
    indentStepEm: 1.2,
    pillBackgroundColor: "rgba(17, 17, 17, 0.08)",
    pillBorderColor: "rgba(17, 17, 17, 0.40)",
    pillTextColor: "#111111",
  },
};

// ── CSS variable generation ───────────────────────────────────────────────────

/**
 * Convert `EditorStylePrefs` into a record of CSS custom-property name → value
 * strings, suitable for application via `style` on the `.text-editor` element.
 *
 * All variables are scoped under the element they are applied to, so the
 * EditorStyleDialog preview can use a separate instance without leaking into
 * the main editor.
 */
export const editorStyleToCssVars = (
  prefs: EditorStylePrefs,
): Record<string, string> => ({
  // Global
  "--editor-font-family": prefs.fontFamily,
  "--editor-font-size": `${prefs.fontSizePx}px`,
  "--text-editor-line-height": String(prefs.lineHeight),
  // Intro
  "--editor-intro-bg": prefs.intro.backgroundColor || "transparent",
  "--editor-intro-sidebar-color": prefs.intro.sidebar.enabled
    ? prefs.intro.sidebar.color
    : "transparent",
  "--editor-intro-sidebar-width": prefs.intro.sidebar.enabled
    ? `${prefs.intro.sidebar.widthPx}px`
    : "0",
  "--editor-intro-padding-bottom": `${prefs.intro.paddingBottomRem}rem`,
  "--editor-mainline-font-weight": prefs.intro.mainLineBold ? "700" : "400",
  // Text mode — indent
  "--editor-text-indent-step": `${prefs.text.indentStepRem}rem`,
  // Text level 1
  "--editor-text-l1-font-size": `${prefs.text.level1.fontSizeEm}em`,
  "--editor-text-l1-sidebar-width": prefs.text.level1.sidebar.enabled
    ? `${prefs.text.level1.sidebar.widthPx}px`
    : "0",
  "--editor-text-l1-sidebar-color": prefs.text.level1.sidebar.color,
  "--editor-text-l1-bg": prefs.text.level1.backgroundColor || "transparent",
  // Text level 2
  "--editor-text-l2-font-size": `${prefs.text.level2.fontSizeEm}em`,
  "--editor-text-l2-sidebar-width": prefs.text.level2.sidebar.enabled
    ? `${prefs.text.level2.sidebar.widthPx}px`
    : "0",
  "--editor-text-l2-sidebar-color": prefs.text.level2.sidebar.color,
  "--editor-text-l2-bg": prefs.text.level2.backgroundColor || "transparent",
  // Text level 3+
  "--editor-text-l3plus-font-size": `${prefs.text.level3plus.fontSizeEm}em`,
  "--editor-text-l3plus-sidebar-width": prefs.text.level3plus.sidebar.enabled
    ? `${prefs.text.level3plus.sidebar.widthPx}px`
    : "0",
  "--editor-text-l3plus-sidebar-color": prefs.text.level3plus.sidebar.color,
  "--editor-text-l3plus-bg": prefs.text.level3plus.backgroundColor || "transparent",
  // Tree mode
  "--tree-step": `${prefs.tree.indentStepEm}em`,
  "--tree-pill-bg": prefs.tree.pillBackgroundColor,
  "--tree-pill-border": prefs.tree.pillBorderColor,
  "--tree-pill-text": prefs.tree.pillTextColor,
});

// ── Store ─────────────────────────────────────────────────────────────────────

export const EDITOR_STYLE_PREFS_KEY = "x2chess.editorStylePrefs.v1";

export const editorStylePrefsStore: VersionedStore<EditorStylePrefs> =
  createVersionedStore<EditorStylePrefs>({
    key: EDITOR_STYLE_PREFS_KEY,
    version: 1,
    defaultValue: DEFAULT_EDITOR_STYLE_PREFS,
    migrations: [],
  });

/** Read persisted preferences, falling back to defaults for any missing field. */
export const readEditorStylePrefs = (): EditorStylePrefs =>
  editorStylePrefsStore.read();

/** Write preferences to localStorage. */
export const writeEditorStylePrefs = (prefs: EditorStylePrefs): void =>
  editorStylePrefsStore.write(prefs);
