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
 * - Per-module debug filtering in dev builds:
 *   - Launch-time: set the `VITE_DEBUG_MODULES` env var before starting the
 *     app.  Use `*` for all modules or a comma-separated list of module names
 *     (e.g. `VITE_DEBUG_MODULES=useAppStartup,board npm run desktop:dev:isolated`).
 *   - Runtime: call `setDebugModules("useAppStartup,board")` or
 *     `setDebugModules("*")` from the WebKit inspector console.  The new
 *     filter takes effect immediately without a restart.  Persists in
 *     localStorage across restarts until cleared with `setDebugModules(null)`.
 *   - Default (no configuration): all modules are enabled in dev builds.
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
import { isTauriRuntime } from "./platform/desktop/tauri/tauri_gateways";

/**
 * True in Vite dev builds (`import.meta.env.DEV`).
 * Used to gate debug-string construction so expensive template literals are
 * never evaluated in release builds.
 *
 * Node's test runner (tsx without Vite) has no `import.meta.env`; treat as
 * non-dev so `log.debug` is a no-op and the module loads safely.
 */
const viteMetaEnv: { DEV?: boolean; VITE_DEBUG_MODULES?: string } | undefined =
  (import.meta as unknown as { env?: { DEV?: boolean; VITE_DEBUG_MODULES?: string } }).env;

const debugEnabled: boolean = Boolean(viteMetaEnv?.DEV);

// ── Per-module debug filter ───────────────────────────────────────────────────

const LS_KEY = "x2chess.debugModules";

/**
 * Resolved per-module debug filter.
 * `'*'` — all modules enabled.
 * `Set<string>` — only the named modules are enabled.
 * `null` — debug entirely suppressed (always the case in release builds).
 *
 * `undefined` means the cache has been invalidated and must be recomputed.
 */
let _cachedFilter: "*" | ReadonlySet<string> | null | undefined = undefined;

function parseFilter(raw: string): "*" | ReadonlySet<string> {
  if (raw.trim() === "*") return "*";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

function resolveFilter(): "*" | ReadonlySet<string> | null {
  if (!debugEnabled) return null;

  // Runtime override: localStorage.x2chess.debugModules
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LS_KEY);
      if (stored !== null) return parseFilter(stored);
    }
  } catch {
    // localStorage unavailable in Node test runner — fall through
  }

  // Launch-time override: VITE_DEBUG_MODULES env var (baked in by Vite)
  const envModules = viteMetaEnv?.VITE_DEBUG_MODULES;
  if (envModules) return parseFilter(envModules);

  // Default: all modules enabled in dev builds
  return "*";
}

function activeFilter(): "*" | ReadonlySet<string> | null {
  if (_cachedFilter === undefined) _cachedFilter = resolveFilter();
  return _cachedFilter;
}

function isModuleEnabled(module: string): boolean {
  const f = activeFilter();
  if (!f) return false;
  if (f === "*") return true;
  return f.has(module);
}

/**
 * Set the per-module debug filter at runtime.
 *
 * `value` — `"*"` to enable all modules, or a comma-separated list of module
 *   names (e.g. `"useAppStartup,board"`).  Pass `null` to clear the override
 *   and fall back to the `VITE_DEBUG_MODULES` env var or the default (`"*"`).
 *
 * The change takes effect immediately and is persisted in localStorage so it
 * survives restarts.  Call from the WebKit inspector console to adjust logging
 * without restarting the app.
 *
 * @example
 * // Enable all debug output
 * setDebugModules("*")
 * // Enable only two modules
 * setDebugModules("useAppStartup,board")
 * // Clear the runtime override (reverts to env var or default)
 * setDebugModules(null)
 */
export function setDebugModules(value: string | null): void {
  try {
    if (typeof localStorage !== "undefined") {
      if (value === null) {
        localStorage.removeItem(LS_KEY);
      } else {
        localStorage.setItem(LS_KEY, value);
      }
    }
  } catch {
    // ignore in environments without localStorage
  }
  _cachedFilter = undefined;
}

// ── Logger init ───────────────────────────────────────────────────────────────

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
 *
 * In dev builds, `log.debug` is additionally gated by the per-module filter.
 * See the module-level documentation for how to configure the filter.
 */
export const log = {
  debug: (module: string, message: string | (() => string)): void => {
    if (!debugEnabled) return;
    if (!isModuleEnabled(module)) return;
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
