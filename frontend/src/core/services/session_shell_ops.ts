/**
 * createShellOps — shell state and user-preference operations.
 *
 * Integration API:
 * - `createShellOps(bundle, dispatchRef, stateRef)` — call from
 *   `createSessionOrchestrator`; spread the result into `AppStartupServices`.
 *   Pure factory function; no React imports.
 *
 * Communication API:
 * - All operations dispatch fine-grained React actions via `dispatchRef`.
 * - Persistent preferences are written immediately to `shellPrefsStore` or the
 *   relevant prefs store so they survive a page reload.
 * - `setLayoutMode` also writes to `bundle.activeSessionRef.current.pgnLayoutMode`
 *   so the session's in-memory state is consistent with the dispatched action.
 */

import { resolveLocale } from "../../app/i18n";
import { shellPrefsStore } from "../../runtime/shell_prefs_store";
import { writeShapePrefs } from "../../runtime/shape_prefs";
import type { ShapePrefs } from "../../runtime/shape_prefs";
import { writeEditorStylePrefs } from "../../runtime/editor_style_prefs";
import type { EditorStylePrefs } from "../../runtime/editor_style_prefs";
import { writeDefaultLayoutPrefs } from "../../runtime/default_layout_prefs";
import type { DefaultLayoutPrefs } from "../../runtime/default_layout_prefs";
import { isTauriRuntime } from "../../platform/desktop/tauri/tauri_gateways";
import { createDesktopWebviewStorageGateway } from "../../platform/desktop/storage/webview_storage_gateway";
import { exportWebviewStorage, importWebviewStorage } from "./webview_storage_service";
import type { AppAction } from "../state/actions";
import type { AppStoreState } from "../state/app_reducer";
import type { AppStartupServices } from "../contracts/app_services";
import type { ServicesBundle } from "./createAppServices";

// ── Types ─────────────────────────────────────────────────────────────────────

type ShellOps = Pick<
  AppStartupServices,
  | "setMenuOpen"
  | "setDevDockOpen"
  | "setActiveDevTab"
  | "setLayoutMode"
  | "setShowEvalPills"
  | "setLocale"
  | "setMoveDelayMs"
  | "setSoundEnabled"
  | "setPositionPreviewOnHover"
  | "setDeveloperToolsEnabled"
  | "setShapePrefs"
  | "setEditorStylePrefs"
  | "setDefaultLayoutPrefs"
  | "exportWebviewStorage"
  | "importWebviewStorage"
>;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns shell state and preference operations wired to the given bundle.
 *
 * @param bundle Fully-wired services bundle.
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param stateRef Mutable ref mirroring the latest React state.
 */
export const createShellOps = (
  bundle: ServicesBundle,
  dispatchRef: { current: (action: AppAction) => void },
  stateRef: { current: AppStoreState },
): ShellOps => {
  const storageGateway = isTauriRuntime() ? createDesktopWebviewStorageGateway() : null;

  return {
    setMenuOpen: (open: boolean): void => {
      dispatchRef.current({ type: "set_is_menu_open", open });
    },

    setDevDockOpen: (open: boolean): void => {
      if (open && !stateRef.current.isDeveloperToolsEnabled) {
        dispatchRef.current({ type: "set_dev_tools_enabled", enabled: true });
        shellPrefsStore.write({ ...shellPrefsStore.read(), developerToolsEnabled: true });
      }
      dispatchRef.current({ type: "set_dev_dock_open", open });
      // Menu panel stacks above the dock (z-index); close it so the dock is visible immediately.
      if (open) {
        dispatchRef.current({ type: "set_is_menu_open", open: false });
      }
    },

    setActiveDevTab: (tab: "ast" | "pgn"): void => {
      dispatchRef.current({ type: "set_active_dev_tab", tab });
      dispatchRef.current({ type: "set_dev_dock_open", open: true });
      if (!stateRef.current.isDeveloperToolsEnabled) {
        dispatchRef.current({ type: "set_dev_tools_enabled", enabled: true });
        shellPrefsStore.write({ ...shellPrefsStore.read(), developerToolsEnabled: true });
      }
      dispatchRef.current({ type: "set_is_menu_open", open: false });
    },

    setLayoutMode: (mode: "plain" | "text" | "tree"): void => {
      bundle.activeSessionRef.current.pgnLayoutMode = mode;
      dispatchRef.current({ type: "set_layout_mode", mode });
      shellPrefsStore.write({ ...shellPrefsStore.read(), pgnLayout: mode });
    },

    setShowEvalPills: (show: boolean): void => {
      dispatchRef.current({ type: "set_show_eval_pills", show });
    },

    setLocale: (locale: string): void => {
      const resolved: string = resolveLocale(locale);
      dispatchRef.current({ type: "set_locale", locale: resolved });
      shellPrefsStore.write({ ...shellPrefsStore.read(), locale: resolved });
    },

    setMoveDelayMs: (value: number): void => {
      dispatchRef.current({ type: "set_move_delay_ms", value });
      shellPrefsStore.write({ ...shellPrefsStore.read(), moveDelayMs: value });
    },

    setSoundEnabled: (enabled: boolean): void => {
      dispatchRef.current({ type: "set_sound_enabled", enabled });
      shellPrefsStore.write({ ...shellPrefsStore.read(), sound: enabled });
    },

    setPositionPreviewOnHover: (enabled: boolean): void => {
      dispatchRef.current({ type: "set_position_preview_on_hover", enabled });
      shellPrefsStore.write({ ...shellPrefsStore.read(), positionPreviewOnHover: enabled });
    },

    setDeveloperToolsEnabled: (enabled: boolean): void => {
      dispatchRef.current({ type: "set_dev_tools_enabled", enabled });
      shellPrefsStore.write({ ...shellPrefsStore.read(), developerToolsEnabled: enabled });
      if (!enabled) {
        dispatchRef.current({ type: "set_dev_dock_open", open: false });
        return;
      }
      // Turning dev tools on should show the dock (checkbox alone used to leave it hidden).
      dispatchRef.current({ type: "set_dev_dock_open", open: true });
      dispatchRef.current({ type: "set_is_menu_open", open: false });
    },

    setShapePrefs: (prefs: ShapePrefs): void => {
      writeShapePrefs(prefs);
      dispatchRef.current({ type: "set_shape_prefs", prefs });
    },

    setEditorStylePrefs: (prefs: EditorStylePrefs): void => {
      writeEditorStylePrefs(prefs);
      dispatchRef.current({ type: "set_editor_style_prefs", prefs });
    },

    setDefaultLayoutPrefs: (prefs: DefaultLayoutPrefs): void => {
      writeDefaultLayoutPrefs(prefs);
      dispatchRef.current({ type: "set_default_layout_prefs", prefs });
    },

    exportWebviewStorage: (): void => {
      if (!storageGateway) return;
      void exportWebviewStorage(storageGateway).catch(() => {});
    },

    importWebviewStorage: (): void => {
      if (!storageGateway) return;
      void importWebviewStorage(storageGateway, dispatchRef.current).catch(() => {});
    },
  };
};
