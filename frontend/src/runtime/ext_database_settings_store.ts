/**
 * ext_database_settings_store — versioned store for external database settings.
 *
 * Integration API:
 * - `extDatabaseSettingsStore` — call `.read()` to load, `.write()` to persist.
 * - `ExtDatabaseSettings` / `OpeningExplorerSettings` — the setting types.
 * - `DEFAULT_EXT_DATABASE_SETTINGS` — shipped defaults.
 *
 * Configuration API:
 * - Storage key: `"x2chess.ext-db-settings"` in localStorage.
 * - Version 1 — initial versioned form.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpeningExplorerSettings = {
  /** Lichess speed filters. Empty array = all speeds (Lichess default). */
  speeds: string[];
  /** Lichess rating bucket filters. Empty array = all ratings (Lichess default). */
  ratings: number[];
};

export type ExtDatabaseSettings = {
  openingExplorer: OpeningExplorerSettings;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_EXT_DATABASE_SETTINGS: ExtDatabaseSettings = {
  openingExplorer: { speeds: [], ratings: [] },
};

// ── Store ─────────────────────────────────────────────────────────────────────

const coerce = (raw: unknown): ExtDatabaseSettings => {
  if (raw === null || typeof raw !== "object") return DEFAULT_EXT_DATABASE_SETTINGS;
  const p = raw as Record<string, unknown>;
  const ex = p["openingExplorer"];
  const exObj = ex !== null && typeof ex === "object" ? (ex as Record<string, unknown>) : {};
  return {
    openingExplorer: {
      speeds: Array.isArray(exObj["speeds"]) ? (exObj["speeds"] as string[]) : [],
      ratings: Array.isArray(exObj["ratings"]) ? (exObj["ratings"] as number[]) : [],
    },
  };
};

export const extDatabaseSettingsStore: VersionedStore<ExtDatabaseSettings> =
  createVersionedStore<ExtDatabaseSettings>({
    key: "x2chess.ext-db-settings",
    version: 1,
    defaultValue: DEFAULT_EXT_DATABASE_SETTINGS,
    migrations: [coerce],
  });
