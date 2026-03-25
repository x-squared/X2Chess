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
import { SUPPORTED_LOCALES } from "../app_shell/i18n";
import { useAppContext } from "../state/app_context";
import {
  selectIsMenuOpen,
  selectLocale,
  selectMoveDelayMs,
  selectSoundEnabled,
  selectDevToolsEnabled,
  selectSessions,
  selectPositionPreviewOnHover,
} from "../state/selectors";
import { useServiceContext } from "../state/ServiceContext";
import { useTranslator } from "../hooks/useTranslator";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import { UpdateBanner } from "./UpdateBanner";
import { WebImportRulesPanel } from "./WebImportRulesPanel";
import type { SessionItemState } from "../state/app_reducer";

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
  const { state } = useAppContext();
  const isMenuOpen: boolean = selectIsMenuOpen(state);
  const locale: string = selectLocale(state);
  const moveDelayMs: number = selectMoveDelayMs(state);
  const soundEnabled: boolean = selectSoundEnabled(state);
  const positionPreviewOnHover: boolean = selectPositionPreviewOnHover(state);
  const isDeveloperToolsEnabled: boolean = selectDevToolsEnabled(state);
  const sessions: SessionItemState[] = selectSessions(state);
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

          {/* Developer dock toggle */}
          <button
            id="btn-dev-dock-toggle"
            className="source-button"
            type="button"
            onClick={(): void => { services.setDevDockOpen(true); }}
          >
            {t("controls.openDeveloperDock", "Open Developer Dock")}
          </button>

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

          {/* Web import rules */}
          <button
            id="btn-web-import-rules"
            className="source-button"
            type="button"
            onClick={(): void => { setWebImportRulesOpen(true); }}
          >
            {t("controls.webImportRules", "Web Import Rules…")}
          </button>
        </div>

        {webImportRulesOpen && (
          <WebImportRulesPanel onClose={(): void => { setWebImportRulesOpen(false); }} />
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
