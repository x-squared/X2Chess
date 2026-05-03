/**
 * EngineConfigDialog — per-engine UCI options configuration dialog.
 *
 * Shows the engine's displayed name and a table of UCI options. Each option
 * renders an appropriate control (checkbox, number input, select, text). Well-
 * known options include a help chip (see `engine_option_help.ts`) with one fixed-position accent tooltip (no native `title`, avoids duplicate OS tooltip);
 * Hash / NNUE / Syzygy options are edited like any other UCI option.
 *
 * Integration API:
 * - `<EngineConfigDialog ... />` — full-screen modal when `embedded` is false (default).
 * - `<EngineConfigDialog embedded ... />` — fills remaining sidecar height below the engine list;
 *                         optional `defaultEngineId` / `onSetDefault` render the engine info strip inside the panel.
 *
 * Configuration API:
 * - `engine`            — the `EngineConfig` being edited (mutable copy).
 * - `discoveredOptions` — `UciOption[]` reported by the engine after `uci`.
 *                         May be empty when the engine has not been probed yet.
 * - `embedded`          — sidecar layout (no backdrop); typically fills height below the list.
 * - `defaultEngineId` / `onSetDefault` — when `embedded`, show registry info strip (path, set default).
 *
 * Communication API:
 * - `onPersist(updated)` — registry autosave (called debounced after edits); does not close the panel.
 * - `onDismiss()` — header ✕ / modal backdrop; pending debounced edits are flushed before the panel unmounts.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactElement,
  type ChangeEvent,
} from "react";
import type { EngineConfig } from "../../../../../parts/engines/src/domain/engine_config";
import type { UciOption } from "../../../../../parts/engines/src/domain/uci_types";
import { UI_IDS } from "../../../core/model/ui_ids";
import { composeOptionHelpText } from "../engine_option_help";
import type { HostHardwareSnapshot } from "../host_hardware_hints";
import { loadHostHardwareSnapshot } from "../load_host_hardware_snapshot";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shown first in the options table when the engine exposes them (hash / NNUE / Syzygy). */
const OPTIONS_TABLE_PRIORITY = new Set([
  "Hash",
  "EvalFile",
  "EvalFileSmall",
  "SyzygyPath",
  "SyzygyProbeDepth",
  "SyzygyProbeLimit",
  "Syzygy50MoveRule",
]);

type OptionValues = Record<string, string | number | boolean>;

const defaultValue = (opt: UciOption): string | number | boolean => {
  if (opt.type === "check") return opt.default;
  if (opt.type === "spin") return opt.default;
  if (opt.type === "combo") return opt.default;
  if (opt.type === "string") return opt.default;
  return "";
};

// ── Sub-components ────────────────────────────────────────────────────────────

type OptionRowProps = {
  opt: UciOption;
  value: string | number | boolean;
  onChange: (name: string, value: string | number | boolean) => void;
  hostHints: HostHardwareSnapshot | null;
  t: (key: string, fallback?: string) => string;
};

const OptionRow = ({ opt, value, onChange, hostHints, t }: OptionRowProps): ReactElement => {
  const help: string | undefined = composeOptionHelpText(opt.name, opt, hostHints, t);
  const helpBtnRef = useRef<HTMLButtonElement | null>(null);
  const hideTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);

  const clearHideTimer = useCallback((): void => {
    if (hideTipTimerRef.current !== null) {
      clearTimeout(hideTipTimerRef.current);
      hideTipTimerRef.current = null;
    }
  }, []);

  const openTip = useCallback((): void => {
    clearHideTimer();
    const el: HTMLButtonElement | null = helpBtnRef.current;
    if (!el || !help) return;
    const r: DOMRect = el.getBoundingClientRect();
    setTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
  }, [clearHideTimer, help]);

  const scheduleHideTip = useCallback((): void => {
    clearHideTimer();
    hideTipTimerRef.current = setTimeout((): void => {
      setTipPos(null);
      hideTipTimerRef.current = null;
    }, 160);
  }, [clearHideTimer]);

  const hideTipNow = useCallback((): void => {
    clearHideTimer();
    setTipPos(null);
  }, [clearHideTimer]);

  const control = (): ReactElement => {
    if (opt.type === "button") {
      return (
        <button
          type="button"
          className="eng-cfg-option-btn"
          onClick={(): void => { onChange(opt.name, ""); }}
        >
          {opt.name}
        </button>
      );
    }
    if (opt.type === "check") {
      return (
        <input
          type="checkbox"
          className="eng-cfg-option-check"
          checked={Boolean(value)}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(opt.name, e.target.checked);
          }}
        />
      );
    }
    if (opt.type === "spin") {
      return (
        <input
          type="number"
          className="eng-cfg-option-spin"
          value={Number(value)}
          min={opt.min}
          max={opt.max}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            onChange(opt.name, Number(e.target.value));
          }}
        />
      );
    }
    if (opt.type === "combo") {
      return (
        <select
          className="eng-cfg-option-select"
          value={String(value)}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
            onChange(opt.name, e.target.value);
          }}
        >
          {opt.vars.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );
    }
    // string
    return (
      <input
        type="text"
        className="eng-cfg-option-text"
        value={String(value)}
        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
          onChange(opt.name, e.target.value);
        }}
      />
    );
  };

  return (
    <tr className="eng-cfg-option-row">
      <td className="eng-cfg-option-name-cell">
        <div className="eng-cfg-option-name-wrap">
          <span>{opt.name}</span>
          {help ? (
            <>
              <button
                ref={helpBtnRef}
                type="button"
                className="eng-cfg-option-help"
                aria-label={t("engines.config.optionHelpButton", "Show help for this option")}
                onMouseEnter={openTip}
                onMouseLeave={scheduleHideTip}
                onFocus={openTip}
                onBlur={hideTipNow}
              >
                ?
              </button>
              {tipPos ? (
                <div
                  role="tooltip"
                  className="eng-cfg-help-tooltip-floating"
                  style={{
                    position: "fixed",
                    left: tipPos.left,
                    top: tipPos.top,
                    transform: "translateX(-50%)",
                  }}
                  onMouseEnter={clearHideTimer}
                  onMouseLeave={scheduleHideTip}
                >
                  {help}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </td>
      <td className="eng-cfg-option-value">
        {opt.type !== "button" ? control() : null}
      </td>
    </tr>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

type EngineConfigDialogProps = {
  engine: EngineConfig;
  discoveredOptions: UciOption[];
  onPersist: (updated: EngineConfig) => void;
  onDismiss: () => void;
  t: (key: string, fallback?: string) => string;
  /** When true, layout for the engine-manager sidecar (no modal backdrop). */
  embedded?: boolean;
  /** Registry default engine id; used with `embedded` for the top info strip and “Set as default”. */
  defaultEngineId?: string | null;
  /** Promote this engine to default analysis engine (`embedded` info strip). */
  onSetDefault?: (engineId: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Dialog (modal or embedded) for editing an engine's name and UCI option overrides.
 */
const buildPersistedOptions = (
  values: OptionValues,
  discoveredOptionsList: UciOption[],
): Record<string, string | number | boolean> => {
  const options: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(values)) {
    const opt: UciOption | undefined = discoveredOptionsList.find((o) => o.name === k);
    if (!opt) continue;
    const def = opt.type !== "button" ? defaultValue(opt) : undefined;
    if (v !== def) options[k] = v;
  }
  return options;
};

export const EngineConfigDialog = ({
  engine,
  discoveredOptions,
  onPersist,
  onDismiss,
  t,
  embedded = false,
  defaultEngineId = null,
  onSetDefault,
}: EngineConfigDialogProps): ReactElement => {
  const [label, setLabel] = useState(engine.label);
  const [optionValues, setOptionValues] = useState<OptionValues>(() => {
    const init: OptionValues = {};
    for (const opt of discoveredOptions) {
      if (opt.type === "button") continue;
      init[opt.name] =
        engine.options[opt.name] !== undefined
          ? engine.options[opt.name]
          : defaultValue(opt);
    }
    return init;
  });

  const [hostHints, setHostHints] = useState<HostHardwareSnapshot | null>(null);

  useEffect((): (() => void) => {
    let cancelled: boolean = false;
    void loadHostHardwareSnapshot().then((snap: HostHardwareSnapshot): void => {
      if (!cancelled) {
        setHostHints(snap);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const handleOptionChange = useCallback(
    (name: string, value: string | number | boolean): void => {
      setOptionValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleRestoreDefaults = useCallback((): void => {
    const defaults: OptionValues = {};
    for (const opt of discoveredOptions) {
      if (opt.type === "button") continue;
      defaults[opt.name] = defaultValue(opt);
    }
    setOptionValues(defaults);
  }, [discoveredOptions]);

  const skipInitialPersistRef = useRef<boolean>(true);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const engineRef = useRef(engine);
  engineRef.current = engine;

  /** Latest form state for unmount flush (avoids stale closures). */
  const persistSnapshotRef = useRef({
    label,
    optionValues,
    discoveredOptions,
  });
  persistSnapshotRef.current = { label, optionValues, discoveredOptions };

  useEffect((): (() => void) | void => {
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false;
      return;
    }
    const delayMs: number = 380;
    const id: ReturnType<typeof setTimeout> = setTimeout((): void => {
      const snap = persistSnapshotRef.current;
      const eng = engineRef.current;
      const options: Record<string, string | number | boolean> = buildPersistedOptions(
        snap.optionValues,
        snap.discoveredOptions,
      );
      onPersistRef.current({ ...eng, label: snap.label, options });
    }, delayMs);
    return (): void => {
      clearTimeout(id);
    };
  }, [label, optionValues]);

  useEffect((): (() => void) => {
    return (): void => {
      const snap = persistSnapshotRef.current;
      const eng = engineRef.current;
      const options: Record<string, string | number | boolean> = buildPersistedOptions(
        snap.optionValues,
        snap.discoveredOptions,
      );
      onPersistRef.current({ ...eng, label: snap.label, options });
    };
  }, []);

  const visibleOptions: UciOption[] = ((): UciOption[] => {
    const visible: UciOption[] = discoveredOptions.filter((o) => o.type !== "button");
    const withIndex: { opt: UciOption; index: number }[] = visible.map((opt, index) => ({
      opt,
      index,
    }));
    withIndex.sort((a, b) => {
      const ap: number = OPTIONS_TABLE_PRIORITY.has(a.opt.name) ? 0 : 1;
      const bp: number = OPTIONS_TABLE_PRIORITY.has(b.opt.name) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.index - b.index;
    });
    return withIndex.map((x) => x.opt);
  })();
  const hasOptions = visibleOptions.length > 0;

  const dialogInner: ReactElement = (
    <>
        {/* Embedded: executable path + default (inside engines.config-dialog; scroll is below) */}
        {embedded ? (
          <div className="eng-mgr-info-strip eng-cfg-embed-info">
            <div className="eng-mgr-info-name">{engine.label}</div>
            <div className="eng-mgr-info-path" title={engine.path}>
              {engine.path}
            </div>
            {onSetDefault != null && engine.id !== defaultEngineId ? (
              <button
                type="button"
                className="eng-mgr-btn eng-mgr-btn--ghost eng-mgr-btn--sm"
                onClick={(): void => {
                  onSetDefault(engine.id);
                }}
              >
                {t("engines.manager.makeDefault", "Set as default")}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Header */}
        <div className={`eng-cfg-header${embedded ? " eng-cfg-header--embedded" : ""}`}>
          <span className="eng-cfg-title">
            {t("engines.config.title", "Configure engine")}
          </span>
          <button
            type="button"
            className="eng-cfg-close"
            onClick={onDismiss}
            aria-label={t("common.close", "Close")}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="eng-cfg-body">
          {/* Displayed name */}
          <div className="eng-cfg-name-row">
            <label className="eng-cfg-name-label" htmlFor="eng-cfg-name">
              {t("engines.config.displayedName", "Displayed name")}
            </label>
            <input
              id="eng-cfg-name"
              type="text"
              className="eng-cfg-name-input"
              value={label}
              onChange={(e): void => { setLabel(e.target.value); }}
            />
          </div>

          {/* Options table */}
          {hasOptions ? (
            <table
              className="eng-cfg-options-table"
              data-ui-id={UI_IDS.ENGINE_CONFIG_OPTIONS_TABLE}
            >
              <thead>
                <tr>
                  <th className="eng-cfg-col-name">
                    {t("engines.config.optionName", "Name")}
                  </th>
                  <th className="eng-cfg-col-value">
                    {t("engines.config.optionValue", "Value")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleOptions.map((opt) => (
                  <OptionRow
                    key={opt.name}
                    opt={opt}
                    value={optionValues[opt.name] ?? defaultValue(opt)}
                    onChange={handleOptionChange}
                    hostHints={hostHints}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="eng-cfg-no-options">
              {t(
                "engines.config.noOptions",
                "Start analysis once to load engine options, then re-open this dialog.",
              )}
            </p>
          )}
        </div>

        {/* Footer — registry autosave; only explicit reset remains */}
        <div className="eng-cfg-footer">
          <button
            type="button"
            className="eng-cfg-btn eng-cfg-btn--ghost"
            onClick={handleRestoreDefaults}
            disabled={!hasOptions}
          >
            {t("engines.config.restoreDefaults", "Restore Defaults")}
          </button>
        </div>
    </>
  );

  if (embedded) {
    return (
      <section
        className="eng-cfg-embedded"
        data-ui-id={UI_IDS.ENGINE_CONFIG_DIALOG}
        aria-label={t("engines.config.title", "Configure engine")}
      >
        <div className="eng-cfg-dialog eng-cfg-dialog--embedded">{dialogInner}</div>
      </section>
    );
  }

  return (
    <div className="eng-cfg-backdrop" onClick={onDismiss}>
      <div
        className="eng-cfg-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("engines.config.title", "Configure engine")}
        data-ui-id={UI_IDS.ENGINE_CONFIG_DIALOG}
        onClick={(e): void => { e.stopPropagation(); }}
      >
        {dialogInner}
      </div>
    </div>
  );
};
