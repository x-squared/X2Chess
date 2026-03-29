/**
 * SettingsPanel — board configuration panel.
 *
 * Exposes user-configurable preferences for board decoration: right-click
 * colour presets, square highlight style (fill / frame), and the move-hints
 * toggle.  Rendered as a tab inside `RightPanelStack`.
 *
 * Integration API:
 * - `<SettingsPanel prefs={...} onPrefsChange={...} t={...} />`
 *
 * Configuration API:
 * - `prefs`          — current `ShapePrefs` (read from app state).
 * - `onPrefsChange`  — called with the complete updated `ShapePrefs` when any
 *                      setting changes; caller is responsible for persisting.
 * - `t`              — translator function.
 *
 * Communication API:
 * - `onPrefsChange(prefs)` is the only outbound callback.
 */

import type { ReactElement } from "react";
import type { ShapeColor } from "../board/board_shapes";
import type { ShapePrefs, SquareStyleMode } from "../runtime/shape_prefs";
import { GUIDE_IDS } from "../guide/guide_ids";

type SettingsPanelProps = {
  prefs: ShapePrefs;
  onPrefsChange: (prefs: ShapePrefs) => void;
  t: (key: string, fallback?: string) => string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLOR_OPTIONS: Array<{ value: ShapeColor; label: string; swatch: string }> = [
  { value: "green",  label: "Green",  swatch: "rgba(103,200,103,0.85)" },
  { value: "red",    label: "Red",    swatch: "rgba(220, 80, 80,0.85)" },
  { value: "yellow", label: "Yellow", swatch: "rgba(230,205, 60,0.85)" },
  { value: "blue",   label: "Blue",   swatch: "rgba( 70,140,220,0.85)" },
];

type ColorPickerProps = {
  label: string;
  value: ShapeColor;
  onChange: (color: ShapeColor) => void;
};

const ColorPicker = ({ label, value, onChange }: ColorPickerProps): ReactElement => (
  <div className="settings-row">
    <span className="settings-row-label">{label}</span>
    <div className="settings-color-options" role="group" aria-label={label}>
      {COLOR_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.label}
          aria-pressed={value === opt.value}
          className={`settings-color-swatch${value === opt.value ? " active" : ""}`}
          style={{ background: opt.swatch }}
          onClick={(): void => { onChange(opt.value); }}
        />
      ))}
    </div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const SettingsPanel = ({
  prefs,
  onPrefsChange,
  t,
}: SettingsPanelProps): ReactElement => {
  const setPrimary = (primaryColor: ShapeColor): void => {
    onPrefsChange({ ...prefs, primaryColor });
  };
  const setSecondary = (secondaryColor: ShapeColor): void => {
    onPrefsChange({ ...prefs, secondaryColor });
  };
  const setSquareStyle = (squareStyle: SquareStyleMode): void => {
    onPrefsChange({ ...prefs, squareStyle });
  };
  const setShowMoveHints = (showMoveHints: boolean): void => {
    onPrefsChange({ ...prefs, showMoveHints });
  };

  return (
    <div className="settings-panel" data-guide-id={GUIDE_IDS.SETTINGS_PANEL}>
      {/* ── Board annotations ──────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          {t("settings.boardAnnotations", "Board annotations")}
        </h3>

        <ColorPicker
          label={t("settings.primaryColor", "Right-click colour")}
          value={prefs.primaryColor}
          onChange={setPrimary}
        />

        <ColorPicker
          label={t("settings.secondaryColor", "Shift + right-click colour")}
          value={prefs.secondaryColor}
          onChange={setSecondary}
        />

        <div className="settings-row">
          <span className="settings-row-label">
            {t("settings.squareStyle", "Highlight style")}
          </span>
          <div className="settings-button-group" role="group">
            <button
              type="button"
              aria-pressed={prefs.squareStyle === "fill"}
              className={`settings-toggle-btn${prefs.squareStyle === "fill" ? " active" : ""}`}
              onClick={(): void => { setSquareStyle("fill"); }}
            >
              {t("settings.squareStyleFill", "Fill")}
            </button>
            <button
              type="button"
              aria-pressed={prefs.squareStyle === "frame"}
              className={`settings-toggle-btn${prefs.squareStyle === "frame" ? " active" : ""}`}
              onClick={(): void => { setSquareStyle("frame"); }}
            >
              {t("settings.squareStyleFrame", "Frame")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Move hints ─────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          {t("settings.moveHints", "Move hints")}
        </h3>

        <div className="settings-row">
          <span className="settings-row-label">
            {t("settings.showMoveHints", "Show destination dots on hover")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.showMoveHints}
            className={`settings-switch${prefs.showMoveHints ? " active" : ""}`}
            onClick={(): void => { setShowMoveHints(!prefs.showMoveHints); }}
          >
            {prefs.showMoveHints
              ? t("settings.on", "On")
              : t("settings.off", "Off")}
          </button>
        </div>
      </div>
    </div>
  );
};
