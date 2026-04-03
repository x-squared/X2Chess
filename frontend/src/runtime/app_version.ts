/**
 * app_version — single source of truth for the running app version.
 *
 * Integration API:
 * - `CURRENT_APP_VERSION` — the semver string of the running build.
 * - `parseSemver(v)` — parse a semver string into a comparable tuple.
 * - `isNewerVersion(local, remote)` — returns true when remote > local.
 *
 * Configuration API:
 * - Version is injected at build time via the `__X2CHESS_APP_VERSION__` Vite
 *   constant (sourced from `tauri.conf.json`).  Falls back to `"0.0.0"` in
 *   browser dev mode.
 *
 * Communication API:
 * - Pure module; no side effects, no I/O.
 */

/** Semantic version of the running build, e.g. `"0.1.0"`. */
export type AppVersion = string;

/**
 * The running app version.
 * Falls back to `"0.0.0"` in browser dev mode when the build constant is absent.
 */
export const CURRENT_APP_VERSION: AppVersion =
  typeof __X2CHESS_APP_VERSION__ !== "undefined" ? __X2CHESS_APP_VERSION__ : "0.0.0";

/**
 * Parse a semver string into a `[major, minor, patch]` tuple.
 * Returns `null` if the string is not a valid `MAJOR.MINOR.PATCH` pattern.
 *
 * @param v - Version string, e.g. `"1.2.3"` or `"v1.2.3"`.
 */
export const parseSemver = (v: string): [number, number, number] | null => {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts as [number, number, number];
};

/**
 * Returns `true` if `remote` is strictly greater than `local`.
 * Both must be `MAJOR.MINOR.PATCH` strings; anything else returns `false`.
 *
 * @param local - Current app version, e.g. `"0.1.0"`.
 * @param remote - Remote version from `latest.json`, e.g. `"0.2.0"`.
 */
export const isNewerVersion = (local: AppVersion, remote: AppVersion): boolean => {
  const l = parseSemver(local);
  const r = parseSemver(remote);
  if (!l || !r) return false;
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false;
  }
  return false;
};
