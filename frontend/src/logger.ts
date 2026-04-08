/**
 * logger — application-wide structured log facade.
 *
 * In the Tauri desktop runtime, delegates to `@tauri-apps/plugin-log`, which
 * routes all entries through the Rust log system and writes them to a
 * platform log file (macOS: ~/Library/Logs/com.x2chess.app/x2chess.log).
 * In the browser dev server, falls back to the browser console.
 *
 * `attachConsole()` is called during init so that log entries are also
 * forwarded back to the webview console (visible in the WebKit inspector).
 *
 * Integration API:
 * - Call `await initLogger()` once at application startup (in `main.tsx`)
 *   before the React tree is mounted, so the console bridge is active for
 *   all subsequent log calls.
 * - Import `log` wherever structured log output is needed.
 *
 * Configuration API:
 * - Log-level filtering is configured on the Rust side (see `main.rs`):
 *   Debug in dev builds, Info in release builds.
 * - The module-level `debugEnabled` flag gates debug-string construction on
 *   the JS side so hot paths pay no cost in release builds.
 *
 * Communication API:
 * - Outbound: Tauri `plugin:log|log` invoke (desktop) or `console.*` (browser).
 * - Inbound: none.
 */

import {
  debug as tauriDebug,
  info as tauriInfo,
  warn as tauriWarn,
  error as tauriError,
  attachConsole,
} from "@tauri-apps/plugin-log";
import { isTauriRuntime } from "./resources/tauri_gateways";

/**
 * True in Vite dev builds (`import.meta.env.DEV`).
 * Used to gate debug-string construction so expensive template literals are
 * never evaluated in release builds.
 */
const debugEnabled: boolean = import.meta.env.DEV;

/**
 * Initialise the logger.
 *
 * In the Tauri runtime: attaches the plugin-log console bridge so that log
 * entries written via this facade are forwarded back to the webview console.
 * In the browser dev server: no-op (console.*  is already the output).
 *
 * Must be awaited before the React tree is mounted so the bridge is active
 * for the first startup log calls.
 */
export const initLogger = async (): Promise<void> => {
  if (!isTauriRuntime()) return;
  await attachConsole();
};

const fmt = (level: string, module: string, message: string): string =>
  `[${level}] [${module}] ${message}`;

/**
 * Structured log facade.
 *
 * Each method is fire-and-forget (returns `void`).
 * Pass the calling module name as the first argument to make entries
 * easy to filter: `log.info("useAppStartup", "App ready")`.
 *
 * `log.debug` accepts a plain string or a factory function `() => string`.
 * Always use the factory form when the message involves any non-trivial
 * string construction, so the work is skipped entirely in release builds:
 *
 *   log.debug("myModule", () => `pos=${JSON.stringify(pos)}`);
 */
export const log = {
  debug: (module: string, message: string | (() => string)): void => {
    if (!debugEnabled) return;
    const msg: string = typeof message === "function" ? message() : message;
    if (isTauriRuntime()) {
      void tauriDebug(fmt("DEBUG", module, msg));
    } else {
      console.debug(fmt("DEBUG", module, msg));
    }
  },

  info: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriInfo(fmt("INFO", module, message));
    } else {
      console.info(fmt("INFO", module, message));
    }
  },

  warn: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriWarn(fmt("WARN", module, message));
    } else {
      console.warn(fmt("WARN", module, message));
    }
  },

  error: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriError(fmt("ERROR", module, message));
    } else {
      console.error(fmt("ERROR", module, message));
    }
  },
};
