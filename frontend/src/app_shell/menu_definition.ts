/**
 * menu_definition.ts — Declarative application menu structure.
 *
 * Defines the full desktop menu bar as a plain, framework-free data structure.
 * The Tauri desktop menu is built from this definition at startup by
 * `useTauriMenu` (`hooks/useTauriMenu.ts`), which wires each action id to the
 * matching `AppStartupServices` callback.
 *
 * ## How to edit
 *
 * - Add a new action id to `MenuActionId`, add its handler to `MENU_ACTIONS`
 *   in `useTauriMenu.ts`, and insert a `{ kind: "action", ... }` node here.
 * - Change labels or accelerators directly in `APP_MENU_DEFINITION` below.
 * - The browser runtime ignores this file entirely (Tauri-only).
 *
 * ## Node kinds
 *
 * | kind          | fields                                              |
 * |---------------|-----------------------------------------------------|
 * | `"action"`    | `id`, `label`, optional `accelerator`               |
 * | `"predefined"`| `item` — one of the `PredefinedMenuItemKind` values |
 * | `"separator"` | (no extra fields)                                   |
 * | `"submenu"`   | `label`, `items`                                    |
 *
 * Predefined items map to native OS menu actions (Copy, Paste, Quit, …) and
 * are rendered by the OS — their labels and shortcuts are not customisable.
 *
 * @see hooks/useTauriMenu.ts for the Tauri build logic and action bindings.
 * @see doc/architecture-manual.qmd §Desktop menu bar for the design rationale.
 */

// ── Action identifiers ────────────────────────────────────────────────────────

/**
 * All named application actions that can appear in the menu bar.
 * Each id is handled by a corresponding entry in `MENU_ACTIONS` inside
 * `useTauriMenu.ts`.
 */
export type MenuActionId =
  | "file.new-database"
  | "file.new-directory"
  | "file.open-resource-file"
  | "file.open-resource-directory";

// ── Node types ────────────────────────────────────────────────────────────────

/** A single application action (triggers an `AppStartupServices` callback). */
export type MenuActionNode = {
  readonly kind: "action";
  readonly id: MenuActionId;
  readonly label: string;
  /** Platform-agnostic accelerator string understood by Tauri, e.g. `"CmdOrCtrl+O"`. */
  readonly accelerator?: string;
};

/**
 * A native OS-provided menu item (copy, paste, quit, …).
 * The `item` string is passed verbatim to `PredefinedMenuItem.new()`.
 * Supported values: `"Copy"` | `"Cut"` | `"Paste"` | `"SelectAll"` |
 * `"Undo"` | `"Redo"` | `"Minimize"` | `"Maximize"` | `"Fullscreen"` |
 * `"Hide"` | `"HideOthers"` | `"ShowAll"` | `"CloseWindow"` |
 * `"Quit"` | `"About"` | `"Services"` | `"Separator"`.
 */
export type MenuPredefinedNode = {
  readonly kind: "predefined";
  readonly item: string;
};

/** A horizontal divider between groups of items. */
export type MenuSeparatorNode = { readonly kind: "separator" };

/** A labelled sub-menu containing further nodes. */
export type MenuSubmenuNode = {
  readonly kind: "submenu";
  readonly label: string;
  readonly items: readonly MenuNode[];
};

export type MenuNode =
  | MenuActionNode
  | MenuPredefinedNode
  | MenuSeparatorNode
  | MenuSubmenuNode;

/** The full menu bar definition — an ordered list of top-level submenus. */
export type MenuDefinition = readonly MenuSubmenuNode[];

// ── Application menu bar ──────────────────────────────────────────────────────

/**
 * The canonical menu bar for X2Chess.
 *
 * Editing this object is the only change required to restructure the desktop
 * menu.  Action labels and keyboard shortcuts live here; action logic lives
 * in `useTauriMenu.ts`.
 */
export const APP_MENU_DEFINITION: MenuDefinition = [
  // ── X2Chess (application menu) ────────────────────────────────────────────
  {
    kind: "submenu",
    label: "X2Chess",
    items: [
      { kind: "predefined", item: "About" },
      { kind: "separator" },
      { kind: "predefined", item: "Services" },
      { kind: "separator" },
      { kind: "predefined", item: "Hide" },
      { kind: "predefined", item: "HideOthers" },
      { kind: "predefined", item: "ShowAll" },
      { kind: "separator" },
      { kind: "predefined", item: "Quit" },
    ],
  },

  // ── File ──────────────────────────────────────────────────────────────────
  {
    kind: "submenu",
    label: "File",
    items: [
      { kind: "action", id: "file.new-database",  label: "New Database\u2026",    accelerator: "CmdOrCtrl+Shift+N" },
      { kind: "action", id: "file.new-directory",  label: "New Game Folder\u2026", accelerator: "CmdOrCtrl+Shift+D" },
      { kind: "separator" },
      { kind: "action", id: "file.open-resource-file",      label: "Open Resource File\u2026",      accelerator: "CmdOrCtrl+O" },
      { kind: "action", id: "file.open-resource-directory", label: "Open Resource Folder\u2026" },
    ],
  },

  // ── Edit ──────────────────────────────────────────────────────────────────
  {
    kind: "submenu",
    label: "Edit",
    items: [
      { kind: "predefined", item: "Undo" },
      { kind: "predefined", item: "Redo" },
      { kind: "separator" },
      { kind: "predefined", item: "Cut" },
      { kind: "predefined", item: "Copy" },
      { kind: "predefined", item: "Paste" },
      { kind: "predefined", item: "SelectAll" },
    ],
  },

  // ── View ──────────────────────────────────────────────────────────────────
  {
    kind: "submenu",
    label: "View",
    items: [
      { kind: "predefined", item: "Fullscreen" },
    ],
  },

  // ── Window ────────────────────────────────────────────────────────────────
  {
    kind: "submenu",
    label: "Window",
    items: [
      { kind: "predefined", item: "Minimize" },
      { kind: "predefined", item: "Maximize" },
      { kind: "separator" },
      { kind: "predefined", item: "CloseWindow" },
    ],
  },
];
