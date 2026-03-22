/**
 * useExtDatabaseSettings — localStorage-persisted settings for external database
 * integrations (E9).
 *
 * Integration API:
 * - `useExtDatabaseSettings()` — returns settings and setters.
 *
 * Configuration API:
 * - Storage key: `"x2chess.ext-db-settings"` in localStorage.
 *
 * Communication API:
 * - Pure React hook; no network calls.
 */

import { useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpeningExplorerSettings = {
  /**
   * Lichess speed filters for the "lichess" source.
   * Empty array = all speeds included (Lichess default).
   */
  speeds: string[];
  /**
   * Lichess rating bucket filters for the "lichess" source.
   * Empty array = all ratings included (Lichess default).
   */
  ratings: number[];
};

export type ExtDatabaseSettings = {
  openingExplorer: OpeningExplorerSettings;
};

const STORAGE_KEY = "x2chess.ext-db-settings";

const DEFAULT_SETTINGS: ExtDatabaseSettings = {
  openingExplorer: {
    speeds: [],
    ratings: [],
  },
};

// ── Persistence helpers ───────────────────────────────────────────────────────

const loadSettings = (): ExtDatabaseSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ExtDatabaseSettings>;
    return {
      openingExplorer: {
        speeds: Array.isArray(parsed.openingExplorer?.speeds)
          ? (parsed.openingExplorer.speeds as string[])
          : [],
        ratings: Array.isArray(parsed.openingExplorer?.ratings)
          ? (parsed.openingExplorer.ratings as number[])
          : [],
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const persistSettings = (settings: ExtDatabaseSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or private browsing — silently ignore.
  }
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export type ExtDatabaseSettingsState = {
  settings: ExtDatabaseSettings;
  setOpeningExplorerSpeeds: (speeds: string[]) => void;
  setOpeningExplorerRatings: (ratings: number[]) => void;
  resetToDefaults: () => void;
};

export const useExtDatabaseSettings = (): ExtDatabaseSettingsState => {
  const [settings, setSettings] = useState<ExtDatabaseSettings>(loadSettings);

  const update = useCallback((next: ExtDatabaseSettings): void => {
    setSettings(next);
    persistSettings(next);
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
    update(DEFAULT_SETTINGS);
  }, [update]);

  return { settings, setOpeningExplorerSpeeds, setOpeningExplorerRatings, resetToDefaults };
};
