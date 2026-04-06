/**
 * logger — application-wide structured log facade.
 *
 * In the Tauri desktop runtime, delegates to `@tauri-apps/plugin-log`, which
 * routes all entries through the Rust log system and writes them to a
 * platform log file (macOS: ~/Library/Logs/com.x2chess.app/x2chess.log).
 * In the browser dev server, falls back to the browser console.
 *
 * `attachConsole()` is called during init so that existing `console.*` calls
 * (including those in third-party code) are also captured in the log file
 * without requiring any further code changes.
 *
 * Integration API:
 * - Call `initLogger()` once at application startup (in `main.tsx`) before
 *   the React tree is mounted.
 * - Import `log` wherever structured log output is needed.
 *
 * Configuration API:
 * - Log-level filtering is configured on the Rust side (see `main.rs`):
 *   Debug in dev builds, Info in release builds.
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
 * Initialise the logger.
 *
 * In the Tauri runtime: attaches the plugin-log console bridge so that
 * `console.*` calls are also written to the log file.
 * In the browser: no-op.
 *
 * Must be called once before any `log.*` call.
 */
export const initLogger = async (): Promise<void> => {
  if (!isTauriRuntime()) return;
  await attachConsole();
};

const fmt = (module: string, message: string): string =>
  `[${module}] ${message}`;

/**
 * Structured log facade.
 *
 * Each method is fire-and-forget (returns `void`).
 * Pass the calling module name as the first argument to make entries
 * easy to filter: `log.info("useAppStartup", "App ready")`.
 */
export const log = {
  debug: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriDebug(fmt(module, message));
    } else {
      console.debug(fmt(module, message));
    }
  },

  info: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriInfo(fmt(module, message));
    } else {
      console.info(fmt(module, message));
    }
  },

  warn: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriWarn(fmt(module, message));
    } else {
      console.warn(fmt(module, message));
    }
  },

  error: (module: string, message: string): void => {
    if (isTauriRuntime()) {
      void tauriError(fmt(module, message));
    } else {
      console.error(fmt(module, message));
    }
  },
};
