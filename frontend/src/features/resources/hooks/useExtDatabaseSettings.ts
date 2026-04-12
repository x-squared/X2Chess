/**
 * useExtDatabaseSettings — localStorage-persisted settings for external database
 * integrations (E9).
 *
 * Integration API:
 * - `useExtDatabaseSettings()` — returns settings and setters.
 *
 * Configuration API:
 * - Storage key: `"x2chess.ext-db-settings"` in localStorage (via `extDatabaseSettingsStore`).
 *
 * Communication API:
 * - Pure React hook; no network calls.
 */

import { useState, useCallback } from "react";
import {
  extDatabaseSettingsStore,
  DEFAULT_EXT_DATABASE_SETTINGS,
} from "../../../runtime/ext_database_settings_store";
import type { ExtDatabaseSettings } from "../../../runtime/ext_database_settings_store";
export type { ExtDatabaseSettings, OpeningExplorerSettings } from "../../../runtime/ext_database_settings_store";

// ── Hook ──────────────────────────────────────────────────────────────────────

export type ExtDatabaseSettingsState = {
  settings: ExtDatabaseSettings;
  setOpeningExplorerSpeeds: (speeds: string[]) => void;
  setOpeningExplorerRatings: (ratings: number[]) => void;
  resetToDefaults: () => void;
};

/**
 * Read and update localStorage-persisted external database settings.
 *
 * @returns `ExtDatabaseSettingsState` with current `settings` and setter callbacks.
 */
export const useExtDatabaseSettings = (): ExtDatabaseSettingsState => {
  const [settings, setSettings] = useState<ExtDatabaseSettings>(() => extDatabaseSettingsStore.read());

  const update = useCallback((next: ExtDatabaseSettings): void => {
    setSettings(next);
    extDatabaseSettingsStore.write(next);
  }, []);

  const setOpeningExplorerSpeeds = useCallback(
    (speeds: string[]): void => {
      update({ ...settings, openingExplorer: { ...settings.openingExplorer, speeds } });
    },
    [settings, update],
  );

  const setOpeningExplorerRatings = useCallback(
    (ratings: number[]): void => {
      update({ ...settings, openingExplorer: { ...settings.openingExplorer, ratings } });
    },
    [settings, update],
  );

  const resetToDefaults = useCallback((): void => {
    update(DEFAULT_EXT_DATABASE_SETTINGS);
  }, [update]);

  return { settings, setOpeningExplorerSpeeds, setOpeningExplorerRatings, resetToDefaults };
};
