/**
 * EngineManagerPanel — modal panel for managing configured UCI engines.
 *
 * Shows an icon toolbar above the engine list, then below the list either the
 * add-engine form, a selected-engine summary (name + path / option overrides),
 * or a hint. On open, the **default** engine (if any) is selected and the configure panel is shown;
 * choosing another engine opens its configure view. Toolbar **Configure** targets the current selection.
 * While configuring, the detail pane is hidden and the config panel fills the space below the list.
 * When the registry becomes empty (e.g. last engine removed), selection and the embedded configure
 * snapshot are cleared so stale engine rows cannot remain visible.
 * Persists all changes via `useEngineConfig`.
 *
 * Integration API:
 * - `<EngineManagerPanel engineConfig={...} discoveredOptions={...}
 *     onClose={...} t={...} />`
 *
 * Configuration API:
 * - `engineConfig` — result of `useEngineConfig()` hook from the parent.
 * - `discoveredOptions` — map from engineId to its UCI options (may be empty
 *   until probed). For a copied engine (new id, same path as another row), options are taken
 *   from any same-path entry that was already probed.
 *
 * Communication API:
 * - `onClose()` — fires when the user dismisses the panel.
 */

import {
  useState,
  useCallback,
  useEffect,
  type ReactElement,
} from "react";
import type { EngineConfig } from "../../../../../parts/engines/src/domain/engine_config";
import type { UciOption } from "../../../../../parts/engines/src/domain/uci_types";
import type { EngineConfigState, DetectedEngine } from "../hooks/useEngineConfig";
import { makeEngineId } from "../hooks/useEngineConfig";
import { EngineConfigDialog } from "./EngineConfigDialog";
import { UI_IDS } from "../../../core/model/ui_ids";
import { tauriInvoke } from "../../../platform/desktop/tauri_ipc_bridge";
import { log } from "../../../logger";
import { resolveDiscoveredUciOptionsForEngine } from "../resolve_discovered_uci_options";

// ── Initial selection (prefer registry default engine) ────────────────────────

type InitialEngineSelection = {
  selectedId: string | null;
  configuringEngine: EngineConfig | null;
};

/**
 * Pick the default-analysis engine when present; otherwise the first configured engine.
 * When the list is non-empty, returns a snapshot for the embedded configure panel.
 */
function resolveInitialEngineSelection(
  enginesList: readonly EngineConfig[],
  defaultId: string | null | undefined,
): InitialEngineSelection {
  if (enginesList.length === 0) {
    return { selectedId: null, configuringEngine: null };
  }
  const regDefault: string | null = defaultId ?? null;
  const preferredId: string =
    regDefault != null && enginesList.some((e) => e.id === regDefault)
      ? regDefault
      : enginesList[0].id;
  const eng: EngineConfig | undefined = enginesList.find((e) => e.id === preferredId);
  return {
    selectedId: preferredId,
    configuringEngine: eng ? { ...eng } : null,
  };
}

// ── Toolbar icon buttons ──────────────────────────────────────────────────────

type IconBtnProps = {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactElement;
};

const IconBtn = ({ title, disabled, onClick, children }: IconBtnProps): ReactElement => (
  <button
    type="button"
    className={`eng-mgr-toolbar-btn${disabled ? " eng-mgr-toolbar-btn--disabled" : ""}`}
    title={title}
    disabled={disabled}
    onClick={onClick}
    aria-label={title}
  >
    {children}
  </button>
);

// ── SVG icons (inline, matching project icon style) ───────────────────────────

const IconAdd = (): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconRemove = (): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconConfigure = (): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconCopy = (): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconChangeExec = (): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconReveal = (): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M14 14h7v7h-7z" /><path d="M3 14h7v7H3z" />
  </svg>
);

// ── Add-engine flow ───────────────────────────────────────────────────────────

type AddEngineViewProps = {
  onAdd: (cfg: EngineConfig) => void;
  onCancel: () => void;
  detectEngines: () => Promise<DetectedEngine[]>;
  pickExecutable: () => Promise<string | null>;
  t: (key: string, fallback?: string) => string;
};

const AddEngineView = ({
  onAdd,
  onCancel,
  detectEngines,
  pickExecutable,
  t,
}: AddEngineViewProps): ReactElement => {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [detected, setDetected] = useState<DetectedEngine[] | null>(null);
  const [detecting, setDetecting] = useState(false);

  const handleDetect = useCallback(async (): Promise<void> => {
    log.debug("EngineManagerPanel", () => "AddEngineView: auto-detect clicked");
    setDetecting(true);
    const hits = await detectEngines();
    log.debug("EngineManagerPanel", () => `AddEngineView: detected count=${hits.length}`);
    setDetected(hits);
    if (hits.length === 1) {
      setPath(hits[0].path);
      setName(hits[0].name);
    }
    setDetecting(false);
  }, [detectEngines]);

  const handlePick = useCallback(async (): Promise<void> => {
    log.debug("EngineManagerPanel", "AddEngineView: browse executable clicked");
    const picked = await pickExecutable();
    log.debug("EngineManagerPanel", () => `AddEngineView: pick result=${picked ?? "null"}`);
    if (picked) {
      setPath(picked);
      if (!name) {
        const base = picked.split("/").pop() ?? picked;
        setName(base);
      }
    }
  }, [pickExecutable, name]);

  const handleAdd = useCallback((): void => {
    if (!path.trim()) return;
    const cfg: EngineConfig = {
      id: makeEngineId(),
      label: name.trim() || (path.split("/").pop() ?? path),
      path: path.trim(),
      options: {},
    };
    onAdd(cfg);
  }, [path, name, onAdd]);

  return (
    <div className="eng-mgr-add-view">
      <p className="eng-mgr-add-hint">
        {t("engines.add.hint", "Enter the path to a UCI chess engine executable.")}
      </p>

      {/* Detect results */}
      {detected !== null && (
        <div className="eng-mgr-detected">
          {detected.length === 0 ? (
            <p className="eng-mgr-detected-empty">
              {t("engines.add.noneFound", "No engines found in standard locations.")}
            </p>
          ) : (
            <ul className="eng-mgr-detected-list">
              {detected.map((d) => (
                <li key={d.path} className="eng-mgr-detected-item">
                  <button
                    type="button"
                    className="eng-mgr-detected-btn"
                    onClick={(): void => { setPath(d.path); setName(d.name); }}
                  >
                    <span className="eng-mgr-detected-name">{d.name}</span>
                    <span className="eng-mgr-detected-path">{d.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="eng-mgr-add-field-row">
        <label className="eng-mgr-add-label" htmlFor="eng-add-name">
          {t("engines.add.name", "Name")}
        </label>
        <input
          id="eng-add-name"
          type="text"
          className="eng-mgr-add-input"
          placeholder={t("engines.add.namePlaceholder", "Stockfish 18")}
          value={name}
          onChange={(e): void => { setName(e.target.value); }}
        />
      </div>

      <div className="eng-mgr-add-field-row">
        <label className="eng-mgr-add-label" htmlFor="eng-add-path">
          {t("engines.add.path", "Executable path")}
        </label>
        <div className="eng-mgr-add-path-row">
          <input
            id="eng-add-path"
            type="text"
            className="eng-mgr-add-input eng-mgr-add-input--path"
            placeholder="/opt/homebrew/bin/stockfish"
            value={path}
            onChange={(e): void => { setPath(e.target.value); }}
          />
          <button
            type="button"
            className="eng-mgr-add-pick-btn"
            onClick={handlePick}
            title={t("engines.add.pick", "Browse…")}
          >
            {t("engines.add.pick", "Browse…")}
          </button>
        </div>
      </div>

      <div className="eng-mgr-add-actions">
        <button
          type="button"
          className="eng-mgr-btn eng-mgr-btn--ghost"
          onClick={handleDetect}
          disabled={detecting}
        >
          {detecting
            ? t("engines.add.detecting", "Detecting…")
            : t("engines.add.autoDetect", "Auto-detect")}
        </button>
        <div className="eng-mgr-add-actions-right">
          <button
            type="button"
            className="eng-mgr-btn eng-mgr-btn--secondary"
            onClick={onCancel}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="eng-mgr-btn eng-mgr-btn--primary"
            disabled={!path.trim()}
            onClick={handleAdd}
          >
            {t("engines.add.add", "Add Engine")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

type EngineManagerPanelProps = {
  engineConfig: EngineConfigState;
  discoveredOptions: Map<string, UciOption[]>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Full-screen modal panel for managing the engine registry.
 */
export const EngineManagerPanel = ({
  engineConfig,
  discoveredOptions,
  onClose,
  t,
}: EngineManagerPanelProps): ReactElement => {
  const { engines, defaultEngineId, addEngine, removeEngine, updateEngine, copyEngine, setDefault, detectEngines, pickExecutable } =
    engineConfig;

  const initialSel: InitialEngineSelection = resolveInitialEngineSelection(engines, defaultEngineId);

  const [selectedId, setSelectedId] = useState<string | null>(initialSel.selectedId);
  const [showAddView, setShowAddView] = useState(engines.length === 0);
  const [configuringEngine, setConfiguringEngine] = useState<EngineConfig | null>(
    engines.length === 0 ? null : initialSel.configuringEngine,
  );

  const selectedEngine = engines.find((e) => e.id === selectedId) ?? null;

  /**
   * Keep list selection / configure panel aligned with `engines` from the registry.
   * When the registry becomes empty, clear sidecar state — otherwise the embedded configure
   * panel can keep a stale `EngineConfig` snapshot after the last engine is removed.
   */
  useEffect((): void => {
    if (engines.length === 0) {
      setSelectedId(null);
      setConfiguringEngine(null);
      return;
    }

    if (showAddView) return;

    const selectionStillValid: boolean =
      selectedId != null && engines.some((e) => e.id === selectedId);
    if (!selectionStillValid) {
      const sel: InitialEngineSelection = resolveInitialEngineSelection(engines, defaultEngineId);
      setSelectedId(sel.selectedId);
      setConfiguringEngine(sel.configuringEngine);
      return;
    }

    if (
      configuringEngine != null &&
      !engines.some((e) => e.id === configuringEngine.id)
    ) {
      setConfiguringEngine(null);
    }
  }, [engines, defaultEngineId, showAddView, selectedId, configuringEngine]);

  const handleAdd = useCallback(
    (cfg: EngineConfig): void => {
      addEngine(cfg);
      setSelectedId(cfg.id);
      setShowAddView(false);
      setConfiguringEngine({ ...cfg });
    },
    [addEngine],
  );

  const handleRemove = useCallback((): void => {
    if (!selectedId) return;
    const remaining: EngineConfig[] = engines.filter((e) => e.id !== selectedId);
    removeEngine(selectedId);
    const next: EngineConfig | null =
      remaining.find((e) => e.id === defaultEngineId) ?? remaining[0] ?? null;
    setSelectedId(next?.id ?? null);
    setConfiguringEngine(next ? { ...next } : null);
  }, [selectedId, removeEngine, engines, defaultEngineId]);

  const handleConfigure = useCallback((): void => {
    if (selectedEngine) setConfiguringEngine({ ...selectedEngine });
  }, [selectedEngine]);

  const handlePersistEngineConfig = useCallback(
    (updated: EngineConfig): void => {
      updateEngine(updated);
      setConfiguringEngine({ ...updated });
    },
    [updateEngine],
  );

  const handleChangeExecutable = useCallback(async (): Promise<void> => {
    if (!selectedEngine) return;
    const picked = await pickExecutable();
    if (picked) {
      updateEngine({ ...selectedEngine, path: picked });
    }
  }, [selectedEngine, pickExecutable, updateEngine]);

  const handleReveal = useCallback(async (): Promise<void> => {
    if (!selectedEngine) return;
    try {
      await tauriInvoke("reveal_in_finder", { path: selectedEngine.path });
    } catch (err: unknown) {
      const message: string =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      log.error("EngineManagerPanel", "reveal_in_finder invoke failed", { message });
    }
  }, [selectedEngine]);

  const hasSelected = selectedEngine !== null;

  return (
    <>
      {/* Backdrop */}
      <div className="eng-mgr-backdrop" onClick={onClose} />

      {/* Panel */}
      <div
        className="eng-mgr-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("engines.manager.title", "Manage engines")}
        data-ui-id={UI_IDS.ENGINE_MANAGER_PANEL}
      >
        {/* Panel header */}
        <div className="eng-mgr-panel-header">
          <span className="eng-mgr-panel-title">
            {t("engines.manager.title", "Manage engines")}
          </span>
          <button
            type="button"
            className="eng-mgr-close"
            onClick={onClose}
            aria-label={t("common.close", "Close")}
          >
            ×
          </button>
        </div>

        <div className="eng-mgr-layout">
          {/* Toolbar above list; add / detail pane below list */}
          <div className="eng-mgr-list-section">
            {/* Icon toolbar */}
            <div
              className="eng-mgr-toolbar"
              data-ui-id={UI_IDS.ENGINE_MANAGER_TOOLBAR}
            >
              <IconBtn
                title={t("engines.manager.add", "Add engine")}
                onClick={(): void => {
                  setConfiguringEngine(null);
                  setShowAddView(true);
                  setSelectedId(null);
                }}
              >
                <IconAdd />
              </IconBtn>
              <IconBtn
                title={t("engines.manager.remove", "Remove selected engine")}
                disabled={!hasSelected}
                onClick={handleRemove}
              >
                <IconRemove />
              </IconBtn>
              <span className="eng-mgr-toolbar-sep" />
              <IconBtn
                title={t("engines.manager.configure", "Configure…")}
                disabled={!hasSelected}
                onClick={handleConfigure}
              >
                <IconConfigure />
              </IconBtn>
              <IconBtn
                title={t("engines.manager.copy", "Copy engine")}
                disabled={!hasSelected}
                onClick={(): void => { if (selectedId) copyEngine(selectedId); }}
              >
                <IconCopy />
              </IconBtn>
              <IconBtn
                title={t("engines.manager.changeExec", "Change executable…")}
                disabled={!hasSelected}
                onClick={(): void => { void handleChangeExecutable(); }}
              >
                <IconChangeExec />
              </IconBtn>
              <IconBtn
                title={t("engines.manager.reveal", "Show in file manager")}
                disabled={!hasSelected}
                onClick={(): void => { void handleReveal(); }}
              >
                <IconReveal />
              </IconBtn>
            </div>

            {/* Engine list */}
            <ul
              className="eng-mgr-list"
              data-ui-id={UI_IDS.ENGINE_MANAGER_LIST}
              role="listbox"
              aria-label={t("engines.manager.list", "Configured engines")}
            >
              {engines.length === 0 && (
                <li className="eng-mgr-list-empty">
                  {t("engines.manager.noEngines", "No engines configured.")}
                </li>
              )}
              {engines.map((engine) => (
                <li
                  key={engine.id}
                  role="option"
                  aria-selected={engine.id === selectedId}
                  className={`eng-mgr-list-item${engine.id === selectedId ? " eng-mgr-list-item--selected" : ""}${engine.id === defaultEngineId ? " eng-mgr-list-item--default" : ""}`}
                  onClick={(): void => {
                    setSelectedId(engine.id);
                    setShowAddView(false);
                    setConfiguringEngine({ ...engine });
                  }}
                >
                  <span className="eng-mgr-list-label">{engine.label}</span>
                  {engine.id === defaultEngineId && (
                    <span className="eng-mgr-list-default-badge">
                      {t("engines.manager.default", "default")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Below list: add form / selected engine summary — hidden while embedded configure fills the pane */}
          {configuringEngine == null ? (
            <div className="eng-mgr-detail">
              {showAddView ? (
                <AddEngineView
                  onAdd={handleAdd}
                onCancel={(): void => {
                  setShowAddView(false);
                  const sel: InitialEngineSelection = resolveInitialEngineSelection(engines, defaultEngineId);
                  setSelectedId(sel.selectedId);
                  setConfiguringEngine(sel.configuringEngine);
                }}
                  detectEngines={detectEngines}
                  pickExecutable={pickExecutable}
                  t={t}
                />
              ) : selectedEngine ? (
                <>
                  {/* Engine info strip */}
                  <div className="eng-mgr-info-strip">
                    <div className="eng-mgr-info-name">{selectedEngine.label}</div>
                    <div className="eng-mgr-info-path" title={selectedEngine.path}>
                      {selectedEngine.path}
                    </div>
                    {selectedEngine.id !== defaultEngineId && (
                      <button
                        type="button"
                        className="eng-mgr-btn eng-mgr-btn--ghost eng-mgr-btn--sm"
                        onClick={(): void => { setDefault(selectedEngine.id); }}
                      >
                        {t("engines.manager.makeDefault", "Set as default")}
                      </button>
                    )}
                  </div>

                  {/* Option summary */}
                  <div className="eng-mgr-option-summary">
                    {Object.keys(selectedEngine.options).length === 0 ? (
                      <p className="eng-mgr-option-summary-empty">
                        {t(
                          "engines.manager.noOverrides",
                          "No option overrides. Click Configure to edit engine options.",
                        )}
                      </p>
                    ) : (
                      <table className="eng-mgr-option-summary-table">
                        <tbody>
                          {Object.entries(selectedEngine.options).map(([k, v]) => (
                            <tr key={k} className="eng-mgr-option-summary-row">
                              <td className="eng-mgr-option-summary-key">{k}</td>
                              <td className="eng-mgr-option-summary-val">{String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : (
                <div className="eng-mgr-empty-detail">
                  <p>{t("engines.manager.selectHint", "Select an engine from the list or add a new one.")}</p>
                </div>
              )}
            </div>
          ) : null}

          {/* Configure engine — fills remaining sidecar height (`engines.config-dialog`) */}
          {configuringEngine ? (
            <EngineConfigDialog
              key={configuringEngine.id}
              embedded
              engine={configuringEngine}
              discoveredOptions={resolveDiscoveredUciOptionsForEngine(
                configuringEngine,
                engines,
                discoveredOptions,
              )}
              onPersist={handlePersistEngineConfig}
              onDismiss={(): void => {
                setConfiguringEngine(null);
              }}
              t={t}
              defaultEngineId={defaultEngineId}
              onSetDefault={setDefault}
            />
          ) : null}
        </div>
      </div>
    </>
  );
};
