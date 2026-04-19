import { shellPrefsStore, DEFAULT_SHELL_PREFS } from "./shell_prefs_store";
import type { ShellPrefs } from "./shell_prefs_store";

/**
 * localStorage key that controls which preferences are loaded at startup in DEV
 * mode.  Ignored in PROD builds.
 *
 * Values:
 * - `"defaults"` — factory defaults (`DEFAULT_SHELL_PREFS`) are used; stored
 *   prefs are preserved but bypassed.
 * - `"user"` — stored user preferences are loaded as normal.
 *
 * Set from the Developer Dock console:
 * ```js
 * localStorage.setItem("x2chess.devPrefsMode", "defaults")
 * localStorage.setItem("x2chess.devPrefsMode", "user")
 * ```
 * Then restart the app.  The initial value on a fresh install is `"defaults"`.
 */
export const DEV_PREFS_MODE_KEY = "x2chess.devPrefsMode";

export type AppMode = "DEV" | "PROD";

/** Controls which preferences are applied at startup (DEV mode only). */
export type DevPrefsMode = "defaults" | "user";

type ResolveLocaleFn = (locale: string) => string;

type BootstrapUiPrefs = {
  isDeveloperToolsEnabled: boolean;
  resourceViewerHeightPx: number | null;
  boardColumnWidthPx: number | null;
};

export const resolveBuildAppMode = (defaultAppMode: AppMode): AppMode => {
  const raw = typeof __X2CHESS_MODE__ === "undefined" ? defaultAppMode : String(__X2CHESS_MODE__);
  return raw === "PROD" ? "PROD" : "DEV";
};

/**
 * Read the persisted dev prefs mode.  Returns `"user"` when no value is stored
 * (safe default that preserves stored prefs).
 */
export const readDevPrefsMode = (): DevPrefsMode => {
  try {
    const raw = globalThis.localStorage?.getItem(DEV_PREFS_MODE_KEY);
    return raw === "defaults" ? "defaults" : "user";
  } catch {
    return "user";
  }
};

/**
 * Persist the dev prefs mode.
 */
export const writeDevPrefsMode = (mode: DevPrefsMode): void => {
  try {
    globalThis.localStorage?.setItem(DEV_PREFS_MODE_KEY, mode);
  } catch { /* quota / unavailable — ignore */ }
};

/**
 * Initialise the dev prefs mode on the first DEV launch.
 *
 * If the key has never been set, writes `"defaults"` (factory-defaults start)
 * and returns it.  On subsequent launches the stored value is returned as-is.
 */
export const initDevPrefsMode = (): DevPrefsMode => {
  try {
    const existing = globalThis.localStorage?.getItem(DEV_PREFS_MODE_KEY);
    if (!existing) {
      writeDevPrefsMode("defaults");
      return "defaults";
    }
    return readDevPrefsMode();
  } catch {
    return "defaults";
  }
};

/**
 * Return the effective shell prefs for startup, respecting the dev prefs mode.
 * In `"defaults"` mode the stored prefs are bypassed and factory defaults apply.
 */
export const readShellPrefsForStartup = (devPrefsMode: DevPrefsMode): ShellPrefs =>
  devPrefsMode === "defaults" ? DEFAULT_SHELL_PREFS : shellPrefsStore.read();

export const resolveInitialLocale = (
  resolveLocale: ResolveLocaleFn,
  defaultLocale: string,
  devPrefsMode: DevPrefsMode = "user",
): string => {
  const prefs = readShellPrefsForStartup(devPrefsMode);
  return resolveLocale(prefs.locale || navigator.language || defaultLocale);
};

export const readBootstrapUiPrefs = (appMode: AppMode, devPrefsMode: DevPrefsMode = "user"): BootstrapUiPrefs => {
  const prefs = readShellPrefsForStartup(devPrefsMode);
  const isDeveloperToolsEnabled = prefs.developerToolsEnabled || appMode === "DEV";
  return {
    isDeveloperToolsEnabled,
    resourceViewerHeightPx: prefs.resourceViewerHeightPx,
    boardColumnWidthPx: prefs.boardColumnWidthPx,
  };
};
