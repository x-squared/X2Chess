import { useRef, type ReactElement } from "react";
import type { TabState } from "../../resources_viewer/viewer_utils";

// ── Local helpers ─────────────────────────────────────────────────────────────

const resolveTabLabel = (tab: TabState): { label: string; tooltip: string } => {
  const { kind, locator } = tab.resourceRef;
  const norm: string = locator.replaceAll("\\", "/").trim();
  if (kind === "directory") {
    const leaf: string = norm.split("/").filter(Boolean).at(-1) ?? "";
    return {
      label: !norm || norm === "local-files" ? "Directory" : leaf || norm,
      tooltip: norm,
    };
  }
  if (kind === "file" || kind === "db") {
    const leaf: string = norm.split("/").filter(Boolean).at(-1) ?? "";
    return { label: leaf || tab.title || kind, tooltip: norm };
  }
  return { label: tab.title || kind || "Resource", tooltip: norm };
};

// ── Props ─────────────────────────────────────────────────────────────────────

type ResourceTabBarProps = {
  tabs: TabState[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewGame: () => void;
  onMetadataOpen: () => void;
  onOpenResourceFile: () => void;
  onOpenResourceDirectory: () => void;
  onNewPgnFile: () => void;
  onNewDatabase: () => void;
  onNewDirectory: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Component ─────────────────────────────────────────────────────────────────

/** Header (title + action buttons) and tab strip for the resource viewer. */
export const ResourceTabBar = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewGame,
  onMetadataOpen,
  onOpenResourceFile,
  onOpenResourceDirectory,
  onNewPgnFile,
  onNewDatabase,
  onNewDirectory,
  t,
}: ResourceTabBarProps): ReactElement => {
  const newDropdownRef = useRef<HTMLDetailsElement>(null);
  const openDropdownRef = useRef<HTMLDetailsElement>(null);

  const closeNewDropdown = (): void => {
    if (newDropdownRef.current) newDropdownRef.current.open = false;
  };

  const closeOpenDropdown = (): void => {
    if (openDropdownRef.current) openDropdownRef.current.open = false;
  };

  return (
  <>
    {/* Header row: title + actions */}
    <div className="resource-viewer-header">
      <div>
        <p className="resource-viewer-title">{t("resources.title", "Resources")}</p>
      </div>
      <div className="resource-viewer-actions">
        <button
          id="btn-resource-metadata"
          className="resource-icon-button"
          type="button"
          aria-label={t("resources.metadata.button", "Choose metadata columns")}
          title={t("resources.metadata.button", "Choose metadata columns")}
          disabled={activeTabId === null}
          onClick={onMetadataOpen}
        >
          <img src="/icons/toolbar/metadata-columns.svg" alt="" aria-hidden="true" />
        </button>
        <details className="resource-new-dropdown" ref={newDropdownRef} onMouseLeave={closeNewDropdown}>
          <summary className="resource-action-button">
            {t("resources.new", "New resource")}
          </summary>
          <div className="resource-new-dropdown-menu">
            <button
              type="button"
              onClick={(): void => { closeNewDropdown(); onNewPgnFile(); }}
            >
              {t("resources.new.pgn", "New PGN file\u2026")}
            </button>
            <button
              type="button"
              onClick={(): void => { closeNewDropdown(); onNewDatabase(); }}
            >
              {t("resources.new.database", "New database\u2026")}
            </button>
            <button
              type="button"
              onClick={(): void => { closeNewDropdown(); onNewDirectory(); }}
            >
              {t("resources.new.directory", "New game folder\u2026")}
            </button>
          </div>
        </details>
        <details className="resource-new-dropdown" ref={openDropdownRef} onMouseLeave={closeOpenDropdown}>
          <summary className="resource-action-button">
            {t("resources.open", "Open resource")}
          </summary>
          <div className="resource-new-dropdown-menu">
            <button
              type="button"
              onClick={(): void => { closeOpenDropdown(); onOpenResourceFile(); }}
            >
              {t("resources.open.file", "Open file\u2026")}
            </button>
            <button
              type="button"
              onClick={(): void => { closeOpenDropdown(); onOpenResourceDirectory(); }}
            >
              {t("resources.open.directory", "Open folder\u2026")}
            </button>
          </div>
        </details>
      </div>
    </div>

    {/* Tab strip */}
    {tabs.length > 0 && (
      <div className="resource-tabs-row">
        <div
          className="resource-tabs"
          role="tablist"
          aria-label={t("resources.title", "Resources")}
        >
          {tabs.map((tab: TabState): ReactElement => {
            const isActive: boolean = tab.tabId === activeTabId;
            const { label, tooltip } = resolveTabLabel(tab);
            return (
              <div
                key={tab.tabId}
                role="tab"
                aria-selected={isActive}
                className={["resource-tab", isActive ? "active" : ""].filter(Boolean).join(" ")}
                data-resource-tab-id={tab.tabId}
              >
                <button
                  type="button"
                  className="resource-tab-title"
                  title={tooltip || undefined}
                  onClick={(): void => { onTabSelect(tab.tabId); }}
                >
                  {label}
                </button>
                <button
                  type="button"
                  className="resource-tab-close"
                  aria-label={t("resources.tab.close", "Close resource tab")}
                  onClick={(): void => { onTabClose(tab.tabId); }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="resource-new-game-btn" onClick={onNewGame}>
          {t("resources.newGame", "+ New game")}
        </button>
      </div>
    )}
  </>
  );
};
