/**
 * open_url — platform-aware external URL opener.
 *
 * Opens a URL in the user's default system browser.  Behaviour differs by
 * runtime:
 *
 *   Browser build  →  `window.open(url, "_blank", "noreferrer")`
 *   Tauri desktop  →  `open_external_url` Tauri command (open/xdg-open/rundll32)
 *                     Falls back to `window.open` if the command is unavailable.
 *
 * Integration API:
 * - `openExternalUrl(url)` — fire-and-forget; safe to call without awaiting.
 */

import { isTauriRuntime } from "../platform/desktop/tauri/tauri_gateways";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open `url` in the system default browser.
 *
 * @param url - A fully-qualified URL (must start with `http://` or `https://`).
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  const normalized =
    url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url.trim()}`;
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url: normalized });
    return;
  }
  window.open(normalized, "_blank", "noreferrer");
};
