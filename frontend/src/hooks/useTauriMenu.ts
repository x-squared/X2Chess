/**
 * useTauriMenu — builds the native desktop menu bar from the declarative
 * `APP_MENU_DEFINITION` and wires each action to an `AppStartupServices`
 * callback.
 *
 * Integration API:
 * - Call `useTauriMenu(services)` once inside `AppShell` (after the
 *   `ServiceContext.Provider` is mounted and `services` is stable).
 *
 * Configuration API:
 * - Edit `src/app_shell/menu_definition.ts` to change the menu structure,
 *   labels, or keyboard shortcuts.
 * - Add new action ids to `MenuActionId` there and handle them in
 *   `MENU_ACTIONS` below.
 *
 * Communication API:
 * - No-op in browser runtime (`isTauriRuntime()` guard).
 * - Builds the Tauri 2 `Menu` once on mount via `@tauri-apps/api/menu`.
 */

import { useEffect } from "react";
import { Menu, Submenu, MenuItem, PredefinedMenuItem, type PredefinedMenuItemOptions } from "@tauri-apps/api/menu";
import { invoke } from "@tauri-apps/api/core";
import type { AppStartupServices } from "../state/ServiceContext";
import {
  APP_MENU_DEFINITION,
  type MenuActionId,
  type MenuNode,
  type MenuSubmenuNode,
} from "../app_shell/menu_definition";
import { isTauriRuntime } from "../resources/tauri_gateways";

// ── Action handlers ───────────────────────────────────────────────────────────

/**
 * Maps each `MenuActionId` to the service call it triggers.
 * Add a new entry here whenever a new action id is introduced in
 * `menu_definition.ts`.
 */
const MENU_ACTIONS: Record<MenuActionId, (s: AppStartupServices) => void> = {
  "file.new-database":           (s) => { s.createResource("db"); },
  "file.new-directory":          (s) => { s.createResource("directory"); },
  "file.open-resource-file":      (s) => { s.openResourceFile(); },
  "file.open-resource-directory": (s) => { s.openResourceDirectory(); },
  "help.export-storage":          (s) => { s.exportWebviewStorage(); },
  "help.import-storage":          (s) => { s.importWebviewStorage(); },
};

// ── Menu builder ──────────────────────────────────────────────────────────────

const buildNode = async (
  node: MenuNode,
  services: AppStartupServices,
): Promise<MenuItem | PredefinedMenuItem | Submenu | null> => {
  try {
    if (node.kind === "separator") {
      return await PredefinedMenuItem.new({ item: "Separator" });
    }
    if (node.kind === "predefined") {
      return await PredefinedMenuItem.new({ item: node.item as PredefinedMenuItemOptions["item"] });
    }
    if (node.kind === "action") {
      const handler = MENU_ACTIONS[node.id];
      return await MenuItem.new({
        text: node.label,
        accelerator: node.accelerator,
        action: handler ? (): void => { handler(services); } : undefined,
      });
    }
    // submenu
    return await buildSubmenu(node, services);
  } catch (err) {
    console.warn("[useTauriMenu] Failed to build menu node:", node, err);
    return null;
  }
};

const buildSubmenu = async (
  def: MenuSubmenuNode,
  services: AppStartupServices,
): Promise<Submenu> => {
  const items = await Promise.all(def.items.map((n) => buildNode(n, services)));
  return Submenu.new({
    text: def.label,
    items: items.filter((i): i is NonNullable<typeof i> => i !== null),
  });
};

const buildAppMenu = async (services: AppStartupServices): Promise<void> => {
  const submenus = await Promise.all(
    APP_MENU_DEFINITION.map((sub) => buildSubmenu(sub, services)),
  );
  const menu = await Menu.new({ items: submenus });
  await menu.setAsAppMenu();
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Build and install the native desktop menu bar from `APP_MENU_DEFINITION`.
 *
 * @param services Stable `AppStartupServices` reference (from `useAppStartup`).
 */
export const useTauriMenu = (services: AppStartupServices): void => {
  useEffect((): void => {
    if (!isTauriRuntime()) return;
    void buildAppMenu(services).catch((err: unknown) => {
      console.warn("[useTauriMenu] Failed to build menu:", err);
    });
  // services is a stable memo — only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect((): (() => void) => {
    if (!isTauriRuntime() || !import.meta.env.DEV) return (): void => {};
    const handler = (e: KeyboardEvent): void => {
      const isInspectorShortcut =
        (e.metaKey && e.altKey && e.key === "i") ||   // Cmd+Option+I  (macOS)
        (e.ctrlKey && e.shiftKey && e.key === "I") ||  // Ctrl+Shift+I  (Linux/Windows)
        e.key === "F12";
      if (!isInspectorShortcut) return;
      e.preventDefault();
      void invoke("open_devtools").catch(() => {});
    };
    document.addEventListener("keydown", handler);
    return (): void => { document.removeEventListener("keydown", handler); };
  }, []);
};
