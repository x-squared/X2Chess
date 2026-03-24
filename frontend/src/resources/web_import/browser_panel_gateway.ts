/**
 * browser_panel_gateway — Build a `BrowserPanelGateway` backed by Tauri
 * commands for managing the in-app browser panel window.
 *
 * Integration API:
 * - `buildTauriBrowserPanelGateway()` — call once; inject the result into
 *   `useWebImport` when running inside the Tauri desktop runtime.
 * - `isTauriRuntime()` from `tauri_gateways.ts` determines whether to build.
 *
 * Configuration API:
 * - No configuration; all Tauri commands target the fixed `"browser"` window
 *   label managed by the Rust side.
 *
 * Communication API:
 * - Outbound: invokes Rust commands `open_browser_window`, `close_browser_window`,
 *   `browser_window_navigate`, `browser_window_go_back`, `browser_window_go_forward`,
 *   `browser_window_reload`, and `browser_window_capture` via Tauri IPC.
 * - `capture(script)` returns the JS expression result as a string, or `null`
 *   if the script resolved to null/undefined.
 */

import type { TauriWindowLike } from "../tauri_gateways";

// ── Gateway type ───────────────────────────────────────────────────────────────

/**
 * Abstraction over the Tauri browser-panel window commands.
 *
 * Inject a real implementation via `buildTauriBrowserPanelGateway` in the Tauri
 * desktop runtime; this gateway has no browser-only equivalent.
 */
export type BrowserPanelGateway = {
  /** Open (or navigate an already-open) browser window to the given URL. */
  open(url: string): Promise<void>;
  /** Close the browser window. No-op if already closed. */
  close(): Promise<void>;
  /** Navigate the browser window to a new URL. */
  navigate(url: string): Promise<void>;
  /** Navigate back in the browser window's session history. */
  goBack(): Promise<void>;
  /** Navigate forward in the browser window's session history. */
  goForward(): Promise<void>;
  /** Reload the current page in the browser window. */
  reload(): Promise<void>;
  /**
   * Evaluate a JS capture expression in the browser window.
   *
   * @param script - Short JS expression returning a FEN/PGN string or null.
   * @returns The extracted string, or `null` if the script returned null/undefined.
   * @throws If the browser window is not open or the script times out (10 s).
   */
  capture(script: string): Promise<string | null>;
};

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Construct a `BrowserPanelGateway` that routes calls through the Tauri
 * browser-panel commands.
 *
 * Must only be called when `isTauriRuntime()` is `true`.
 *
 * @throws At call time if the Tauri `invoke` function is unavailable.
 */
export const buildTauriBrowserPanelGateway = (): BrowserPanelGateway => {
  const getInvoke = (): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) => {
    const runtimeWindow = window as TauriWindowLike;
    const fn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof fn !== "function") {
      throw new Error("Tauri invoke API is unavailable — cannot control browser panel.");
    }
    return fn as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };

  return {
    open: (url) => getInvoke()("open_browser_window", { url }) as Promise<void>,
    close: () => getInvoke()("close_browser_window") as Promise<void>,
    navigate: (url) => getInvoke()("browser_window_navigate", { url }) as Promise<void>,
    goBack: () => getInvoke()("browser_window_go_back") as Promise<void>,
    goForward: () => getInvoke()("browser_window_go_forward") as Promise<void>,
    reload: () => getInvoke()("browser_window_reload") as Promise<void>,
    capture: (script) =>
      getInvoke()("browser_window_capture", { script }) as Promise<string | null>,
  };
};
