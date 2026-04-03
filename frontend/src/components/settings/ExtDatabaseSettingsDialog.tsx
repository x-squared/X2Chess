/**
 * ExtDatabaseSettingsDialog — settings UI for external database provider
 * configuration (E9).
 *
 * Integration API:
 * - `<ExtDatabaseSettingsDialog settings={...} onSave={...} onClose={...} t={...} />`
 *
 * Configuration API:
 * - Lichess opening explorer: speed and rating bucket filters.
 *
 * Communication API:
 * - `onSave(speeds, ratings)` — fires with updated values when user clicks Save.
 * - `onClose()` — fires on cancel or backdrop click.
 */

import { useState, type ReactElement, type ChangeEvent } from "react";
import type { ExtDatabaseSettings } from "../../hooks/useExtDatabaseSettings";

// ── Options ───────────────────────────────────────────────────────────────────

const LICHESS_SPEEDS = [
  { id: "bullet", label: "Bullet" },
  { id: "blitz", label: "Blitz" },
  { id: "rapid", label: "Rapid" },
  { id: "classical", label: "Classical" },
  { id: "correspondence", label: "Correspondence" },
];

const LICHESS_RATINGS = [
  { value: 1000, label: "≤ 1000" },
  { value: 1200, label: "1000–1200" },
  { value: 1400, label: "1200–1400" },
  { value: 1600, label: "1400–1600" },
  { value: 1800, label: "1600–1800" },
  { value: 2000, label: "1800–2000" },
  { value: 2200, label: "2000–2200" },
  { value: 2500, label: "2200–2500" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const toggle = <T,>(arr: T[], item: T): T[] =>
  arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

// ── Props ─────────────────────────────────────────────────────────────────────

type ExtDatabaseSettingsDialogProps = {
  settings: ExtDatabaseSettings;
  onSave: (speeds: string[], ratings: number[]) => void;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const ExtDatabaseSettingsDialog = ({
  settings,
  onSave,
  onClose,
  t,
}: ExtDatabaseSettingsDialogProps): ReactElement => {
  const [speeds, setSpeeds] = useState<string[]>(settings.openingExplorer.speeds);
  const [ratings, setRatings] = useState<number[]>(settings.openingExplorer.ratings);

  return (
    <div className="ext-db-settings-backdrop" onClick={onClose}>
      <div
        className="ext-db-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("extDb.settings.title", "External database settings")}
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="ext-db-settings-header">
          <span className="ext-db-settings-title">
            {t("extDb.settings.title", "External database settings")}
          </span>
          <button
            type="button"
            className="ext-db-settings-close"
            aria-label={t("common.close", "Close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="ext-db-settings-body">
          {/* Opening explorer — Lichess source filters */}
          <section className="ext-db-settings-section">
            <h3 className="ext-db-settings-section-title">
              {t("extDb.settings.openingExplorer", "Opening explorer (Lichess games)")}
            </h3>
            <p className="ext-db-settings-hint">
              {t("extDb.settings.speedsHint", "Leave all unchecked to include every speed.")}
            </p>

            <fieldset className="ext-db-settings-fieldset">
              <legend className="ext-db-settings-legend">
                {t("extDb.settings.speeds", "Time controls")}
              </legend>
              <div className="ext-db-settings-checkboxes">
                {LICHESS_SPEEDS.map(({ id, label }) => (
                  <label key={id} className="ext-db-settings-checkbox-label">
                    <input
                      type="checkbox"
                      checked={speeds.includes(id)}
                      onChange={(_e: ChangeEvent<HTMLInputElement>): void => {
                        setSpeeds(toggle(speeds, id));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="ext-db-settings-fieldset">
              <legend className="ext-db-settings-legend">
                {t("extDb.settings.ratings", "Rating ranges")}
              </legend>
              <div className="ext-db-settings-checkboxes">
                {LICHESS_RATINGS.map(({ value, label }) => (
                  <label key={value} className="ext-db-settings-checkbox-label">
                    <input
                      type="checkbox"
                      checked={ratings.includes(value)}
                      onChange={(_e: ChangeEvent<HTMLInputElement>): void => {
                        setRatings(toggle(ratings, value));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </div>

        <div className="ext-db-settings-footer">
          <button
            type="button"
            className="ext-db-settings-btn ext-db-settings-btn--secondary"
            onClick={onClose}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="ext-db-settings-btn ext-db-settings-btn--primary"
            onClick={(): void => { onSave(speeds, ratings); onClose(); }}
          >
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
};
