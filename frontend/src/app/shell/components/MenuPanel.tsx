/**
 * MenuPanel — renders the slide-in application menu sidebar.
 *
 * Displays locale selector, move-speed slider, sound toggle, developer-tools
 * toggle, save-mode selector, and save/dock action buttons.  The backdrop and
 * aside visibility track `isMenuOpen` from `AppStoreState`.  All interactions
 * are wired directly to `AppStartupServices` callbacks via `onChange`/`onClick`.
 *
 * Integration API:
 * - `<MenuPanel />` — rendered directly inside `<main class="app">`.
 *   No props required; reads all state from context.
 *
 * Configuration API:
 * - No props.  Form control values (`moveDelayMs`, `soundEnabled`, `locale`,
 *   `isDeveloperToolsEnabled`) are applied as `value`/`checked` for controlled
 *   React inputs, driven by `AppStoreState`.
 *
 * Communication API:
 * - Outbound: all control changes dispatched through `useServiceContext()` callbacks.
 * - Inbound: re-renders when relevant `AppStoreState` fields change.
 */

import { useEffect, useState } from "react";
import type { ReactElement, ChangeEvent } from "react";
import { UI_IDS } from "../../../core/model/ui_ids";
import { SUPPORTED_LOCALES } from "../../i18n";
import { useAppContext } from "../../providers/AppStateProvider";
import {
  selectIsMenuOpen,
  selectLocale,
  selectMoveDelayMs,
  selectSoundEnabled,
  selectDevToolsEnabled,
  selectSessions,
  selectPositionPreviewOnHover,
  selectStorageImportPending,
} from "../../../core/state/selectors";
import { useServiceContext } from "../../providers/ServiceProvider";
import { useTranslator } from "../../hooks/useTranslator";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { UpdateBanner } from "./UpdateBanner";
import { StorageImportDialog } from "./StorageImportDialog";
import { WebImportRulesPanel } from "../../../features/resources/components/WebImportRulesPanel";
import type { SessionItemState } from "../../../core/state/app_reducer";

/** Reads the build timestamp injected by Vite at build time (falls back to "dev"). */
const resolveBuildLabel = (): string => {
  try {
    return typeof __X2CHESS_BUILD_TIMESTAMP__ !== "undefined"
      ? String(__X2CHESS_BUILD_TIMESTAMP__)
      : "dev";
  } catch {
    return "dev";
  }
};

/** Renders the application menu backdrop and sidebar panel. */
export const MenuPanel = (): ReactElement => {
  const services = useServiceContext();
  const { state, dispatch } = useAppContext();
  const isMenuOpen: boolean = selectIsMenuOpen(state);
  const locale: string = selectLocale(state);
  const moveDelayMs: number = selectMoveDelayMs(state);
  const soundEnabled: boolean = selectSoundEnabled(state);
  const positionPreviewOnHover: boolean = selectPositionPreviewOnHover(state);
  const isDeveloperToolsEnabled: boolean = selectDevToolsEnabled(state);
  const sessions: SessionItemState[] = selectSessions(state);
  const storageImportPending: Record<string, string> | null = selectStorageImportPending(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  const buildLabel: string = resolveBuildLabel();
  const { update, installUpdate, dismissUpdate } = useUpdateCheck();
  const [webImportRulesOpen, setWebImportRulesOpen] = useState<boolean>(false);

  /** Save mode of the currently active session, or "auto" if none. */
  const activeSaveMode: string =
    sessions.find((s: SessionItemState): boolean => s.isActive)?.saveMode ?? "auto";

  useEffect((): void => {
    document.body.classList.toggle("menu-open", isMenuOpen);
  }, [isMenuOpen]);

  return (
    <>
      {/* Backdrop — click closes menu */}
      <div
        id="menu-backdrop"
        className="app-menu-backdrop"
        hidden={!isMenuOpen}
        onClick={(): void => { services.setMenuOpen(false); }}
      />

      {/* Sidebar panel */}
      <aside
        id="app-menu-panel"
        data-ui-id={UI_IDS.APP_MENU}
        className={isMenuOpen ? "app-menu-panel open" : "app-menu-panel"}
        aria-hidden={isMenuOpen ? undefined : "true"}
      >
        <div className="app-menu-header">
          <p className="app-menu-title">{t("menu.title", "Menu")}</p>
          <button
            id="btn-menu-close"
            className="menu-close"
            type="button"
            aria-label={t("menu.close", "Close menu")}
            onClick={(): void => { services.setMenuOpen(false); }}
          >
            ×
          </button>
        </div>

        <UpdateBanner
          update={update}
          onInstall={installUpdate}
          onDismiss={dismissUpdate}
        />

        <div className="controls controls-menu menu-file-group">
          {/* New game */}
          <button
            id="btn-menu-new-game"
            className="source-button"
            type="button"
            onClick={(): void => { services.setMenuOpen(false); services.openNewGameDialog(); }}
          >
            {t("menu.newGame", "New game\u2026")}
          </button>
        </div>

        <div className="controls controls-menu">
          {/* Move speed */}
          <label className="inline-control">
            {t("controls.speed", "Move speed (ms)")}
            <input
              id="speed-input"
              type="range"
              min="0"
              max="800"
              step="20"
              value={moveDelayMs}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                services.setMoveDelayMs(Number(e.target.value));
              }}
            />
            <span id="speed-value">{moveDelayMs}</span>
          </label>

          {/* Sound */}
          <label className="inline-control">
            <input
              id="sound-input"
              type="checkbox"
              checked={soundEnabled}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                services.setSoundEnabled(e.target.checked);
              }}
            />
            {t("controls.sound", "Sound")}
          </label>

          {/* Position preview on hover */}
          <label className="inline-control">
            <input
              id="position-preview-input"
              type="checkbox"
              checked={positionPreviewOnHover}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                services.setPositionPreviewOnHover(e.target.checked);
              }}
            />
            {t("controls.positionPreviewOnHover", "Position preview on hover")}
          </label>

          {/* Language */}
          <label className="inline-control">
            {t("controls.language", "Language")}
            <select
              id="locale-input"
              value={locale}
              onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                services.setLocale(e.target.value);
              }}
            >
              {SUPPORTED_LOCALES.map((code: string): ReactElement => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          {/* Developer tools */}
          <label className="inline-control">
            <input
              id="developer-tools-input"
              type="checkbox"
              checked={isDeveloperToolsEnabled}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                services.setDeveloperToolsEnabled(e.target.checked);
              }}
            />
            {t("controls.developerTools", "Developer Tools")}
          </label>

          {/* Save mode */}
          <label className="inline-control">
            {t("controls.saveMode", "Save mode")}
            <select
              id="save-mode-input"
              value={activeSaveMode}
              onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                services.setSaveMode(e.target.value);
              }}
            >
              <option value="auto">{t("controls.saveMode.auto", "Autosave")}</option>
              <option value="manual">{t("controls.saveMode.manual", "Manual")}</option>
            </select>
          </label>

          {/* Save now */}
          <button
            id="btn-save-active-game"
            className="source-button"
            type="button"
            onClick={(): void => { services.saveActiveGameNow(); }}
          >
            {t("controls.saveNow", "Save now")}
          </button>

          {/* Training plan */}
          <button
            id="btn-training-plan"
            className="source-button"
            type="button"
            onClick={(): void => { services.setMenuOpen(false); services.openCurriculumPanel(); }}
          >
            {t("controls.trainingPlan", "Training Plan…")}
          </button>

          {/* Engines */}
          <button
            id="btn-engine-manager"
            className="source-button"
            type="button"
            onClick={(): void => { services.setMenuOpen(false); services.openEngineManager(); }}
          >
            {t("controls.engineManager", "Engines…")}
          </button>

          {/* Web import rules */}
          <button
            id="btn-web-import-rules"
            className="source-button"
            type="button"
            onClick={(): void => { setWebImportRulesOpen(true); }}
          >
            {t("controls.webImportRules", "Web Import Rules…")}
          </button>

          {/* Editor style */}
          <button
            id="btn-editor-style"
            className="source-button"
            type="button"
            onClick={(): void => { services.setMenuOpen(false); services.openEditorStyleDialog(); }}
          >
            {t("controls.editorStyle", "Editor Style…")}
          </button>

          {/* Default Layout */}
          <button
            id="btn-default-layout-config"
            className="source-button"
            type="button"
            onClick={(): void => { services.setMenuOpen(false); services.openDefaultLayoutDialog(); }}
          >
            {t("controls.defaultLayout", "Default Layout…")}
          </button>

          {/* Export webview storage */}
          <button
            id="btn-export-storage"
            className="source-button"
            type="button"
            onClick={(): void => { services.exportWebviewStorage(); }}
          >
            {t("controls.exportStorage", "Export Storage…")}
          </button>

          {/* Import webview storage */}
          <button
            id="btn-import-storage"
            className="source-button"
            type="button"
            onClick={(): void => { services.importWebviewStorage(); }}
          >
            {t("controls.importStorage", "Import Storage…")}
          </button>
        </div>

        {webImportRulesOpen && (
          <WebImportRulesPanel onClose={(): void => { setWebImportRulesOpen(false); }} />
        )}

        {storageImportPending !== null && (
          <StorageImportDialog
            data={storageImportPending}
            onClose={(): void => {
              dispatch({ type: "set_storage_import_pending", data: null });
            }}
          />
        )}

        <div className="app-menu-footer">
          <span
            id="runtime-build-badge"
            className="runtime-build-badge"
            title="Build timestamp (used to detect stale windows)"
          >
            Build {buildLabel}
          </span>
        </div>
      </aside>
    </>
  );
};
