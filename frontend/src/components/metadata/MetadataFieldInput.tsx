/**
 * MetadataFieldInput — type-appropriate input control for a metadata field.
 *
 * Renders the correct input widget based on `MetadataFieldDefinition.type`:
 * - `text`      → single-line `<input>`
 * - `date`      → three optional numeric fields (dd · mm · yyyy)
 * - `select`    → `<select>` dropdown with defined values
 * - `number`    → `<input type="number">`
 * - `flag`      → `<input type="checkbox">`
 * - `game_link` → game picker button + selected label; requires `resourceRef` and `t` props
 *
 * Integration API:
 * - `<MetadataFieldInput field={...} value={...} onChange={...} />`
 * - For `game_link` fields also pass `resourceRef` and `t`.
 *
 * Configuration API:
 * - `resourceRef` — required for `game_link`; identifies the resource to pick from.
 * - `t`           — translator; required for `game_link`.
 * - `gameLabel`   — optional cached display label for the current `game_link` value.
 *
 * Communication API:
 * - `onChange(value)` fires with the new string value on every change.
 *   Flag fields use "true"/"false". Date fields use partial dd.mm.yyyy notation.
 *   Game-link fields emit the selected `recordId`, or `""` when cleared.
 */

import { useState, useCallback, type ReactElement, type ChangeEvent } from "react";
import type { MetadataFieldDefinition } from "../../../../resource/domain/metadata_schema";
import { GamePickerDialog, type PickerRow } from "../dialogs/GamePickerDialog";

type MetadataFieldInputProps = {
  field: MetadataFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  /** Additional className applied to the root element. */
  className?: string;
  /**
   * Required for `game_link` fields: the resource the picker will load games from.
   * Must be the same resource the game being edited belongs to.
   */
  resourceRef?: { kind: string; locator: string };
  /** Translator function — required for `game_link` fields. */
  t?: (key: string, fallback?: string) => string;
  /** Cached human-readable label for the current `game_link` value (e.g. "White vs Black"). */
  gameLabel?: string;
};

// ── Date input ────────────────────────────────────────────────────────────────

/**
 * Parse a partial date string (dd.mm.yyyy, mm.yyyy, or yyyy) into parts.
 * Unknown components are returned as empty strings.
 */
const parseDateParts = (
  raw: string,
): { dd: string; mm: string; yyyy: string } => {
  const parts = raw.split(".");
  if (parts.length === 3) {
    return { dd: parts[0] ?? "", mm: parts[1] ?? "", yyyy: parts[2] ?? "" };
  }
  if (parts.length === 2) {
    return { dd: "", mm: parts[0] ?? "", yyyy: parts[1] ?? "" };
  }
  return { dd: "", mm: "", yyyy: parts[0] ?? "" };
};

const buildDateValue = (dd: string, mm: string, yyyy: string): string => {
  const cleanDd = dd.replace(/\?/g, "").trim();
  const cleanMm = mm.replace(/\?/g, "").trim();
  const cleanYyyy = yyyy.replace(/\?/g, "").trim();

  if (cleanDd && cleanMm && cleanYyyy) return `${cleanDd}.${cleanMm}.${cleanYyyy}`;
  if (cleanMm && cleanYyyy) return `${cleanMm}.${cleanYyyy}`;
  if (cleanYyyy) return cleanYyyy;
  return "";
};

const DateInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): ReactElement => {
  const { dd, mm, yyyy } = parseDateParts(value);

  const handleChange = useCallback(
    (part: "dd" | "mm" | "yyyy", newVal: string): void => {
      const next = { dd, mm, yyyy, [part]: newVal };
      onChange(buildDateValue(next.dd, next.mm, next.yyyy));
    },
    [dd, mm, yyyy, onChange],
  );

  return (
    <span className="metadata-field-date">
      <input
        type="number"
        className="metadata-field-date-part metadata-field-date-dd"
        placeholder="dd"
        min={1}
        max={31}
        value={dd}
        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
          handleChange("dd", e.target.value);
        }}
      />
      <span className="metadata-field-date-sep">.</span>
      <input
        type="number"
        className="metadata-field-date-part metadata-field-date-mm"
        placeholder="mm"
        min={1}
        max={12}
        value={mm}
        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
          handleChange("mm", e.target.value);
        }}
      />
      <span className="metadata-field-date-sep">.</span>
      <input
        type="number"
        className="metadata-field-date-part metadata-field-date-yyyy"
        placeholder="yyyy"
        min={1}
        max={9999}
        value={yyyy}
        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
          handleChange("yyyy", e.target.value);
        }}
      />
    </span>
  );
};

// ── Game-link input ───────────────────────────────────────────────────────────

const GameLinkInput = ({
  value,
  onChange,
  gameLabel,
  resourceRef,
  t: tFn,
}: {
  value: string;
  onChange: (v: string) => void;
  gameLabel?: string;
  resourceRef?: { kind: string; locator: string };
  t?: (key: string, fallback?: string) => string;
}): ReactElement => {
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const t = tFn ?? ((_key: string, fallback = ""): string => fallback);

  const handlePick = useCallback((): void => { setPickerOpen(true); }, []);
  const handleClear = useCallback((): void => { onChange(""); }, [onChange]);

  const handleSelect = useCallback(
    (row: PickerRow): void => {
      onChange(row.recordId);
      setPickerOpen(false);
    },
    [onChange],
  );

  const handleCancel = useCallback((): void => { setPickerOpen(false); }, []);

  const displayLabel: string = gameLabel || value;

  return (
    <span className="metadata-field-game-link">
      <span className="metadata-field-game-link-label">
        {displayLabel
          ? <span className="metadata-field-game-link-chip">{displayLabel}</span>
          : <span className="metadata-field-game-link-empty">{t("gamePicker.none", "None")}</span>}
      </span>
      {resourceRef && (
        <button
          type="button"
          className="metadata-field-game-link-btn"
          onClick={handlePick}
        >
          {value ? t("gamePicker.change", "Change…") : t("gamePicker.pick", "Pick…")}
        </button>
      )}
      {value && (
        <button
          type="button"
          className="metadata-field-game-link-clear"
          aria-label={t("gamePicker.clear", "Clear")}
          onClick={handleClear}
        >
          ×
        </button>
      )}
      {pickerOpen && resourceRef && (
        <GamePickerDialog
          resourceRef={resourceRef}
          onSelect={handleSelect}
          onCancel={handleCancel}
          t={t}
        />
      )}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Renders a type-appropriate input for a `MetadataFieldDefinition`.
 * The parent is responsible for rendering the `<label>` wrapper.
 */
export const MetadataFieldInput = ({
  field,
  value,
  onChange,
  className = "",
  resourceRef,
  t,
  gameLabel,
}: MetadataFieldInputProps): ReactElement => {
  const baseClass = `metadata-field-input${className ? ` ${className}` : ""}`;

  switch (field.type) {
    case "date":
      return (
        <DateInput
          value={value}
          onChange={onChange}
        />
      );

    case "select":
      return (
        <select
          className={`${baseClass} metadata-field-select`}
          value={value}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
            onChange(e.target.value);
          }}
        >
          <option value="" />
          {(field.selectValues ?? []).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );

    case "number":
      return (
        <input
          type="number"
          className={`${baseClass} metadata-field-number`}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(e.target.value);
          }}
        />
      );

    case "flag":
      return (
        <input
          type="checkbox"
          className={`${baseClass} metadata-field-flag`}
          checked={value === "true"}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(e.target.checked ? "true" : "false");
          }}
        />
      );

    case "game_link":
      return (
        <GameLinkInput
          value={value}
          onChange={onChange}
          gameLabel={gameLabel}
          resourceRef={resourceRef}
          t={t}
        />
      );

    default: // "text"
      return (
        <input
          type="text"
          className={`${baseClass} metadata-field-text`}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(e.target.value);
          }}
        />
      );
  }
};
