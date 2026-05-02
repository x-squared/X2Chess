/**
 * MetadataFieldInput — type-appropriate input control for a metadata field.
 *
 * Renders the correct input widget based on `MetadataFieldDefinition.type` and `cardinality`:
 * - `text`      → single-line `<input>` · `many`: pill list + text input (Enter/blur commits)
 * - `date`      → three optional numeric fields (dd · mm · yyyy)
 * - `select`    → `<select>` dropdown · `many`: checkbox list over `selectValues`
 * - `number`    → `<input type="number">` · `many`: pill list + number input
 * - `flag`      → `<input type="checkbox">`
 * - `link`      → URL text input with an inline open-in-browser button · `many`: pill list + URL input
 * - `reference` → compact one-line game chip. Pick/Change opens the game picker;
 *   opening the referenced game is an explicit action from that chip.
 *   Requires `resourceRef`, `t`, `onFetchMetadata`, and `onOpen`.
 *
 * Integration API:
 * - `<MetadataFieldInput field={...} value={...} onChange={...} />`
 * - For `reference` fields also pass `resourceRef`, `t`, `onFetchMetadata`, and `onOpen`.
 *
 * Configuration API:
 * - `resourceRef`     — required for `reference`; identifies the resource to pick from.
 * - `t`               — translator; required for `reference`.
 * - `onFetchMetadata` — async fn resolving a game's metadata by recordId; used to build the chip.
 * - `onOpen`          — called with `recordId` when the chip is clicked to open the referenced game.
 * - `inheritedValue`  — value inherited from a referenced game via schema inheritance.
 *   Shown as a ghost hint below the input when `value` is empty. Never written to storage.
 *   Omit (or leave undefined) when there is nothing to inherit.
 *
 * Communication API:
 * - `onChange(value)` fires with the new string value on every change.
 *   Flag fields use "true"/"false". Date fields use partial dd.mm.yyyy notation.
 *   Game-link fields emit the selected `recordId`, or `""` when cleared.
 */

import { useState, useEffect, useCallback, type ReactElement, type ChangeEvent, type MouseEvent } from "react";
import { log } from "../../../logger";
import type { MetadataFieldDefinition } from "../../../../../parts/resource/src/domain/metadata_schema";
import { MULTI_VALUE_SEP } from "../../../../../parts/resource/src/domain/metadata_schema";
import { openExternalUrl } from "../../../resources/open_url";
import { GamePickerDialog, type PickerRow } from "../../../components/dialogs/GamePickerDialog";

type MetadataFieldInputProps = {
  field: MetadataFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  /** Additional className applied to the root element. */
  className?: string;
  /**
   * Required for `reference` fields: the resource the picker will load games from.
   * Must be the same resource the game being edited belongs to.
   */
  resourceRef?: { kind: string; locator: string };
  /** Translator function — required for `reference` fields. */
  t?: (key: string, fallback?: string) => string;
  /**
   * Async function that resolves a game's full metadata by `recordId`.
   * Used by `reference` fields to populate the chip (primary/secondary lines and tooltip).
   */
  onFetchMetadata?: (recordId: string) => Promise<Record<string, string> | null>;
  /**
   * Called with `recordId` when the user clicks the chip to open the referenced game.
   */
  onOpen?: (recordId: string) => void;
  /**
   * Value inherited from a referenced game. Shown as a ghost hint below the
   * input when `value` is empty. Has no effect when `value` is non-empty.
   * Not meaningful for `reference` or `flag` fields.
   */
  inheritedValue?: string;
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

// ── Reference input ──────────────────────────────────────────────────────────

const ReferenceInput = ({
  value,
  onChange,
  resourceRef,
  t: tFn,
  onFetchMetadata,
  onOpen,
}: {
  value: string;
  onChange: (v: string) => void;
  resourceRef?: { kind: string; locator: string };
  t?: (key: string, fallback?: string) => string;
  onFetchMetadata?: (recordId: string) => Promise<Record<string, string> | null>;
  onOpen?: (recordId: string) => void;
}): ReactElement => {
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [resolvedMeta, setResolvedMeta] = useState<Record<string, string> | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState<boolean>(false);
  const t = tFn ?? ((_key: string, fallback = ""): string => fallback);

  // Fetch metadata for the chip whenever the referenced recordId changes.
  useEffect((): (() => void) | void => {
    if (!value || !onFetchMetadata) {
      setResolvedMeta(null);
      return;
    }
    let cancelled = false;
    log.debug("ReferenceInput", () => `fetching metadata — recordId=${value}`);
    void (async (): Promise<void> => {
      const meta: Record<string, string> | null = await onFetchMetadata(value);
      if (cancelled) return;
      if (meta) {
        log.debug("ReferenceInput", () => `metadata resolved — recordId=${value}`);
      } else {
        log.warn("ReferenceInput", `metadata not found — recordId=${value}`);
      }
      setResolvedMeta(meta);
    })();
    return (): void => { cancelled = true; };
  // onFetchMetadata is a stable service reference; value is the meaningful dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect((): void => {
    if (!value) setClearConfirmOpen(false);
  }, [value]);

  // Derive compact one-line chip content from resolved metadata.
  const white: string = String(resolvedMeta?.White ?? "").trim();
  const black: string = String(resolvedMeta?.Black ?? "").trim();
  const event: string = String(resolvedMeta?.Event ?? "").trim();
  const date: string = String(resolvedMeta?.Date ?? "").trim();
  const result: string = String(resolvedMeta?.Result ?? "").trim();

  const playersLabel: string =
    white && black ? `${white} — ${black}` :
    white || black || value;

  const metaInline: string = [result, event, date].filter(Boolean).join(" · ");

  const tooltip: string = [
    white && `White: ${white}`,
    black && `Black: ${black}`,
    result && `Result: ${result}`,
    event && `Event: ${event}`,
    date && `Date: ${date}`,
  ].filter(Boolean).join("\n");

  const handlePick = useCallback((): void => { setPickerOpen(true); }, []);

  const handleClearClick = useCallback((event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    // [log: may downgrade to debug once reference-clear flow is stable]
    log.info("ReferenceInput", "clear-click: opened inline confirmation", {
      hasValue: value !== "",
      pickerOpen,
    });
    setClearConfirmOpen(true);
  }, [pickerOpen, value]);

  const handleClearConfirm = useCallback((event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    // [log: may downgrade to debug once reference-clear flow is stable]
    log.info("ReferenceInput", "clear-click: dispatching empty reference value");
    onChange("");
    setResolvedMeta(null);
    setPickerOpen(false);
    setClearConfirmOpen(false);
  }, [onChange]);

  const handleClearCancel = useCallback((event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    // [log: may downgrade to debug once reference-clear flow is stable]
    log.info("ReferenceInput", "clear-click: inline confirmation cancelled");
    setClearConfirmOpen(false);
  }, []);

  const handleSelect = useCallback((row: PickerRow): void => {
    onChange(row.recordId);
    setPickerOpen(false);
  }, [onChange]);

  const handleCancel = useCallback((): void => { setPickerOpen(false); }, []);

  const handleOpenGame = useCallback((): void => {
    if (value && onOpen) onOpen(value);
  }, [value, onOpen]);

  return (
    <span className="metadata-field-reference">
      {/* Current value chip — styled like a game tab */}
      {value ? (
        <button
          type="button"
          className={[
            "metadata-field-reference-game-chip",
            resolvedMeta ? "" : "metadata-field-reference-game-chip--unresolved",
            onOpen ? "" : "metadata-field-reference-game-chip--no-open",
          ].filter(Boolean).join(" ")}
          onClick={onOpen ? handleOpenGame : undefined}
          title={tooltip || value}
          aria-label={`${t("gamePicker.openGame", "Open game")}: ${playersLabel}`}
        >
          <span className="metadata-field-reference-game-primary">{playersLabel}</span>
          {metaInline && <span className="metadata-field-reference-game-secondary">{` · ${metaInline}`}</span>}
        </button>
      ) : (
        <span className="metadata-field-reference-empty">{t("gamePicker.none", "None")}</span>
      )}

      {/* Action buttons */}
      <span className="metadata-field-reference-actions">
        {resourceRef && (
          <button
            type="button"
            className="metadata-field-reference-btn"
            onClick={handlePick}
          >
            {value ? t("gamePicker.change", "Change…") : t("gamePicker.pick", "Pick…")}
          </button>
        )}
        {value && !clearConfirmOpen && (
          <button
            type="button"
            className="metadata-field-reference-clear"
            aria-label={t("gamePicker.clear", "Clear")}
            onClick={handleClearClick}
          >
            ×
          </button>
        )}
        {value && clearConfirmOpen && (
          <>
            <button
              type="button"
              className="metadata-field-reference-btn metadata-field-reference-btn-confirm"
              onClick={handleClearConfirm}
            >
              {t("gamePicker.clearYes", "Remove")}
            </button>
            <button
              type="button"
              className="metadata-field-reference-btn"
              onClick={handleClearCancel}
            >
              {t("gamePicker.cancel", "Cancel")}
            </button>
          </>
        )}
      </span>

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

// ── Link input helpers ────────────────────────────────────────────────────────

const normalizeUrl = (raw: string): string => {
  const s = raw.trim();
  if (!s || s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
};

const isValidUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch { return false; }
};

// ── Link input (single value) ─────────────────────────────────────────────────

const LinkInput = ({
  value,
  onChange,
  baseClass,
}: {
  value: string;
  onChange: (v: string) => void;
  baseClass: string;
}): ReactElement => {
  const [error, setError] = useState<string | null>(null);

  const handleBlur = (): void => {
    const normalized = normalizeUrl(value);
    if (normalized !== value) onChange(normalized);
    if (normalized && !isValidUrl(normalized)) setError("Invalid URL");
    else setError(null);
  };

  const handleOpen = (e: MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    openExternalUrl(normalizeUrl(value)).catch((err: unknown) => {
      log.warn("LinkInput", "failed to open URL", { err: String(err) });
      setError("Could not open link");
    });
  };

  return (
    <span className="metadata-field-link-wrap">
      <span className="metadata-field-link">
        <input
          type="url"
          className={`${baseClass} metadata-field-link-input${error ? " metadata-field-link-input--error" : ""}`}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(e.target.value);
            if (error) setError(null);
          }}
          onBlur={handleBlur}
        />
        {value.trim() && (
          <button
            type="button"
            className="metadata-field-link-open"
            title="Open in browser"
            onClick={handleOpen}
          >↗</button>
        )}
      </span>
      {error && <span className="metadata-field-link-error">{error}</span>}
    </span>
  );
};

// ── Multi-value text/number inputs ────────────────────────────────────────────

const MultiTextInput = ({
  value,
  onChange,
  inputType = "text",
  validate,
  placeholder = "Add value…",
}: {
  value: string;
  onChange: (v: string) => void;
  inputType?: "text" | "number";
  validate?: (v: string) => string | null;
  placeholder?: string;
}): ReactElement => {
  const items: string[] = value.split(MULTI_VALUE_SEP).filter(Boolean);
  const [input, setInput] = useState<string>("");
  const [addError, setAddError] = useState<string | null>(null);

  const commit = (): void => {
    const s = input.trim();
    if (!s) return;
    if (validate) {
      const err = validate(s);
      if (err) { setAddError(err); return; }
    }
    onChange([...items, s].join(MULTI_VALUE_SEP));
    setInput("");
    setAddError(null);
  };

  const remove = (idx: number): void => {
    onChange(items.filter((_, i) => i !== idx).join(MULTI_VALUE_SEP));
  };

  return (
    <span className="metadata-field-multivalue">
      {items.map((item, i) => (
        <span key={i} className="metadata-field-multivalue-pill">
          <span className="metadata-field-multivalue-pill-text" title={item}>{item}</span>
          <button
            type="button"
            className="metadata-field-multivalue-remove"
            aria-label="Remove"
            onClick={(): void => { remove(i); }}
          >×</button>
        </span>
      ))}
      <span className="metadata-field-multivalue-add-row">
        <input
          type={inputType}
          className={`metadata-field-input metadata-field-${inputType}${addError ? " metadata-field-link-input--error" : ""}`}
          value={input}
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            setInput(e.target.value);
            if (addError) setAddError(null);
          }}
          onKeyDown={(e): void => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          onBlur={(): void => { if (input.trim()) commit(); }}
        />
      </span>
      {addError && <span className="metadata-field-link-error">{addError}</span>}
    </span>
  );
};

// ── Multi-value select input ──────────────────────────────────────────────────

const MultiSelectInput = ({
  value,
  onChange,
  selectValues,
}: {
  value: string;
  onChange: (v: string) => void;
  selectValues: string[];
}): ReactElement => {
  const selected = new Set(value.split(MULTI_VALUE_SEP).filter(Boolean));

  const toggle = (v: string): void => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(selectValues.filter((sv) => next.has(sv)).join(MULTI_VALUE_SEP));
  };

  return (
    <span className="metadata-field-multiselect">
      {selectValues.map((sv) => (
        <label key={sv} className="metadata-field-multiselect-option">
          <input
            type="checkbox"
            checked={selected.has(sv)}
            onChange={(): void => { toggle(sv); }}
          />
          <span>{sv}</span>
        </label>
      ))}
    </span>
  );
};

// ── Link input (multi-value) ──────────────────────────────────────────────────

const MultiLinkInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): ReactElement => {
  const urls: string[] = value.split(MULTI_VALUE_SEP).filter(Boolean);
  const [input, setInput] = useState<string>("");
  const [addError, setAddError] = useState<string | null>(null);

  const commit = (): void => {
    const normalized = normalizeUrl(input);
    if (!normalized) return;
    if (!isValidUrl(normalized)) { setAddError("Invalid URL"); return; }
    onChange([...urls, normalized].join(MULTI_VALUE_SEP));
    setInput("");
    setAddError(null);
  };

  const remove = (idx: number): void => {
    onChange(urls.filter((_, i) => i !== idx).join(MULTI_VALUE_SEP));
  };

  return (
    <span className="metadata-field-multilink">
      {urls.map((url, i) => (
        <span key={i} className="metadata-field-multilink-pill">
          <span className="metadata-field-multilink-pill-text" title={url}>{url}</span>
          <button
            type="button"
            className="metadata-field-link-open"
            title="Open in browser"
            onClick={(e: MouseEvent<HTMLButtonElement>): void => {
              e.stopPropagation();
              void openExternalUrl(url);
            }}
          >↗</button>
          <button
            type="button"
            className="metadata-field-multilink-remove"
            aria-label="Remove"
            onClick={(): void => { remove(i); }}
          >×</button>
        </span>
      ))}
      <span className="metadata-field-link">
        <input
          type="url"
          className={`metadata-field-input metadata-field-link-input${addError ? " metadata-field-link-input--error" : ""}`}
          value={input}
          placeholder="Add URL…"
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            setInput(e.target.value);
            if (addError) setAddError(null);
          }}
          onKeyDown={(e): void => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
          }}
          onBlur={(): void => { if (input.trim()) commit(); }}
        />
        <button
          type="button"
          className="metadata-field-link-open"
          title="Add URL"
          onClick={commit}
        >+</button>
      </span>
      {addError && <span className="metadata-field-link-error">{addError}</span>}
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
  onFetchMetadata,
  onOpen,
  inheritedValue,
}: MetadataFieldInputProps): ReactElement => {
  const baseClass = `metadata-field-input${className ? ` ${className}` : ""}`;
  const showInherited: boolean =
    inheritedValue !== undefined &&
    inheritedValue !== "" &&
    value === "" &&
    field.type !== "reference" &&
    field.type !== "flag";

  const withInheritedHint = (input: ReactElement): ReactElement =>
    showInherited ? (
      <span className="metadata-field-inherited-wrap">
        {input}
        <span className="metadata-field-inherited-hint" title="Inherited from referenced game">
          ↗ {inheritedValue}
        </span>
      </span>
    ) : input;

  switch (field.type) {
    case "date":
      return withInheritedHint(
        <DateInput value={value} onChange={onChange} />,
      );

    case "select":
      if (field.cardinality === "many") {
        return <MultiSelectInput value={value} onChange={onChange} selectValues={field.selectValues ?? []} />;
      }
      return withInheritedHint(
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
        </select>,
      );

    case "number":
      if (field.cardinality === "many") {
        return (
          <MultiTextInput
            value={value}
            onChange={onChange}
            inputType="number"
            validate={(s): string | null => (Number.isFinite(Number(s)) ? null : "Invalid number")}
            placeholder="Add number…"
          />
        );
      }
      return withInheritedHint(
        <input
          type="number"
          className={`${baseClass} metadata-field-number`}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(e.target.value);
          }}
        />,
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

    case "reference":
      return (
        <ReferenceInput
          value={value}
          onChange={onChange}
          resourceRef={resourceRef}
          t={t}
          onFetchMetadata={onFetchMetadata}
          onOpen={onOpen}
        />
      );

    case "link":
      if (field.cardinality === "many") {
        return <MultiLinkInput value={value} onChange={onChange} />;
      }
      return withInheritedHint(
        <LinkInput value={value} onChange={onChange} baseClass={baseClass} />,
      );

    default: // "text"
      if (field.cardinality === "many") {
        return <MultiTextInput value={value} onChange={onChange} />;
      }
      return withInheritedHint(
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
