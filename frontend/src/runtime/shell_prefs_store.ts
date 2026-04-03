/**
 * shell_prefs_store — versioned store for shell-level user preferences.
 *
 * Integration API:
 * - `shellPrefsStore` — call `.read()` on startup, `.write()` on change.
 * - `DEFAULT_SHELL_PREFS` — the shipped defaults.
 * - `ShellPrefs` — the preference shape.
 *
 * Configuration API:
 * - Storage key: `"x2chess.shellPrefs"` (compound; replaces the legacy set of
 *   individual keys `x2chess.sound`, `x2chess.moveDelayMs`, etc.).
 * - Version 1 — initial versioned form.  No migrations needed yet.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shell-level user preferences persisted across sessions. */
export type ShellPrefs = {
  /** Whether developer tools (debug panel etc.) are visible. */
  developerToolsEnabled: boolean;
  /**
   * BCP 47 locale tag chosen by the user, e.g. `"en"`.
   * Empty string means "follow the browser locale".
   */
  locale: string;
  /** Whether move sound effects are enabled. */
  sound: boolean;
  /** Delay between auto-played moves in milliseconds. */
  moveDelayMs: number;
  /** Whether position previews appear on hover in the resource viewer. */
  positionPreviewOnHover: boolean;
  /** PGN display mode for the active session. */
  pgnLayout: "plain" | "text" | "tree";
  /** Persisted height of the resource viewer panel in pixels, or null. */
  resourceViewerHeightPx: number | null;
  /** Persisted width of the board column in pixels, or null. */
  boardColumnWidthPx: number | null;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_SHELL_PREFS: ShellPrefs = {
  developerToolsEnabled: false,
  locale: "",
  sound: true,
  moveDelayMs: 0,
  positionPreviewOnHover: true,
  pgnLayout: "plain",
  resourceViewerHeightPx: null,
  boardColumnWidthPx: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const SHELL_PREFS_KEY = "x2chess.shellPrefs";

/**
 * Versioned localStorage store for shell preferences.
 *
 * Version 1 is the initial versioned form.  Legacy individual keys are
 * consolidated into this store on first startup via `migrateLocalStorage`.
 */
export const shellPrefsStore: VersionedStore<ShellPrefs> = createVersionedStore<ShellPrefs>({
  key: SHELL_PREFS_KEY,
  version: 1,
  defaultValue: DEFAULT_SHELL_PREFS,
  migrations: [],
  // No migrations: this is the first versioned form.
});
