/**
 * open_url — platform-aware external URL opener.
 *
 * Opens a URL in the user's default system browser.  Behaviour differs by
 * runtime:
 *
 *   Browser build  →  `window.open(url, "_blank", "noreferrer")`
 *   Tauri desktop  →  `window.open` as above (see note below)
 *
 * Integration API:
 * - `openExternalUrl(url)` — fire-and-forget; safe to call without awaiting.
 *
 * ---
 * TODO: Replace the Tauri path with `@tauri-apps/plugin-opener` once the
 * plugin is added to the project.  `window.open` is sufficient for browser
 * builds and for most Tauri WebKit (macOS) builds, but WKWebView may open a
 * second in-app webview window instead of handing off to Safari on some OS
 * configurations.  The plugin guarantees system-browser hand-off on all
 * supported platforms.
 *
 * Steps to upgrade:
 *   1. `npm install @tauri-apps/plugin-opener`
 *   2. Add `opener` to `[dependencies]` in `src-tauri/Cargo.toml` and
 *      register `tauri_plugin_opener::init()` in `src-tauri/src/lib.rs`.
 *   3. Replace the body of `openExternalUrl` with:
 *        const { open } = await import("@tauri-apps/plugin-opener");
 *        await open(url);
 *      (keep the `window.__TAURI_INTERNALS__` guard so browser builds
 *       still fall through to `window.open`.)
 * ---
 */

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open `url` in the system default browser.
 *
 * @param url - A fully-qualified URL (must start with `http://` or `https://`).
 */
export const openExternalUrl = (url: string): void => {
  window.open(url, "_blank", "noreferrer");
};
