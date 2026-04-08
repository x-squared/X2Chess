import { createResourceMetadataPrefs } from "./resource_metadata_prefs.js";
import { DEFAULT_RESOURCE_VIEWER_METADATA_KEYS } from "../../../parts/resource/src/domain/metadata";
import type { SourceRefLike } from "../runtime/bootstrap_shared";
import type { ResourceTabSnap } from "../runtime/workspace_snapshot_store";

/**
 * Index module.
 *
 * Integration API:
 * - Primary exports from this module: `createResourceViewerCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - State changes are reported via `onTabsChanged` rather than a shared mutable
 *   state object. All rendering is the responsibility of the caller (`ResourceViewer.tsx`).
 */

type ResourceRefLike = SourceRefLike;

type ResourceRow = {
  game: string;
  identifier: string;
  source: string;
  revision: string;
  metadata: Record<string, unknown>;
  sourceRef: ResourceRefLike | null;
};

type ResourceTab = {
  tabId: string;
  title: string;
  resourceRef: ResourceRefLike;
  rows: ResourceRow[];
  availableMetadataKeys: string[];
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
  errorMessage: string;
  isLoading: boolean;
};

type ResourceTabInput = {
  title?: string;
  resourceRef: ResourceRefLike;
  visibleMetadataKeys?: string[];
};

type ResourceViewerDeps = {
  defaultMetadataKeys?: string[];
  t: (key: string, fallback?: string) => string;
  listGamesForResource: (resourceRef: ResourceRefLike) => Promise<unknown[]>;
  onRequestOpenResource?: () => void | Promise<void>;
  onOpenGameBySourceRef?: (sourceRef: ResourceRefLike) => void | Promise<void>;
  /** Called after any change to tabs or active tab. */
  onTabsChanged?: (
    rawTabs: ResourceTab[],
    activeTabId: string | null,
    activeRowCount: number,
    activeTabError: string,
  ) => void;
};

const buildResourceTabId = (resourceRef: ResourceRefLike): string => {
  const kind: string = String(resourceRef?.kind || "unknown");
  const locator: string = String(resourceRef?.locator || "default");
  return `resource-${kind}-${locator}`.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const normalizeResourceLocator = (locator: unknown): string => String(locator || "").replaceAll("\\", "/").trim();

const deriveDirectoryLabel = (locator: unknown): string => {
  const normalizedLocator: string = normalizeResourceLocator(locator);
  if (!normalizedLocator || normalizedLocator === "local-files") {
    return "Directory";
  }
  const segments: string[] = normalizedLocator.split("/").filter(Boolean);
  const leaf: string = segments[segments.length - 1] || "";
  return leaf || normalizedLocator;
};

const deriveResourceNameLabel = (locator: string, fallback: string): string => {
  if (!locator) return fallback;
  const segments: string[] = locator.split("/").filter(Boolean);
  const leaf: string = segments[segments.length - 1] || "";
  return leaf || fallback;
};

const resolveTabTitleText = (tab: ResourceTab): { label: string; tooltip: string } => {
  const kind: string = String(tab?.resourceRef?.kind || "");
  const locator: string = normalizeResourceLocator(tab?.resourceRef?.locator || "");
  if (kind === "directory") {
    return {
      label: deriveDirectoryLabel(locator),
      tooltip: locator,
    };
  }
  if (kind === "file" || kind === "db") {
    const fallback: string = String(tab?.title || tab?.resourceRef?.kind || "Resource");
    return {
      label: deriveResourceNameLabel(locator, fallback),
      tooltip: locator,
    };
  }
  return {
    label: String(tab?.title || tab?.resourceRef?.kind || "Resource"),
    tooltip: locator,
  };
};

const toResourceRef = (value: unknown): ResourceRefLike | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    kind: typeof record.kind === "string" ? record.kind : undefined,
    locator: typeof record.locator === "string" ? record.locator : undefined,
    recordId: typeof record.recordId === "string" ? record.recordId : undefined,
  };
};

export const createResourceViewerCapabilities = ({
  defaultMetadataKeys,
  t,
  listGamesForResource,
  onOpenGameBySourceRef,
  onTabsChanged,
}: ResourceViewerDeps) => {
  // ── Closure state ──────────────────────────────────────────────────────────
  let resourceViewerTabs: ResourceTab[] = [];
  let activeResourceTabId: string | null = null;
  let resourceViewerDefaultMetadataKeys: string[] = [
    ...(defaultMetadataKeys ?? DEFAULT_RESOURCE_VIEWER_METADATA_KEYS),
  ];

  // Proxy for resource_metadata_prefs — backed by closure vars above.
  const metadataPrefsState = {
    get resourceViewerTabs(): ResourceTab[] { return resourceViewerTabs; },
    get resourceViewerDefaultMetadataKeys(): string[] { return resourceViewerDefaultMetadataKeys; },
    set resourceViewerDefaultMetadataKeys(value: string[]) { resourceViewerDefaultMetadataKeys = value; },
  };

  const metadataPrefs = createResourceMetadataPrefs({ state: metadataPrefsState });

  const toResourceTab = (tab: ResourceTabInput): ResourceTab => ({
    tabId: buildResourceTabId(tab.resourceRef),
    title: String(tab.title || tab.resourceRef?.kind || "Resource"),
    resourceRef: tab.resourceRef || { kind: "file", locator: "default" },
    rows: [],
    availableMetadataKeys: [],
    visibleMetadataKeys: Array.isArray(tab.visibleMetadataKeys)
      ? [...tab.visibleMetadataKeys]
      : [...resourceViewerDefaultMetadataKeys],
    metadataColumnOrder: ["game"],
    columnWidths: {},
    errorMessage: "",
    isLoading: false,
  });

  const getTabs = (): ResourceTab[] => resourceViewerTabs;

  // ── Notify helper ─────────────────────────────────────────────────────────
  const notifyChanged = (): void => {
    if (!onTabsChanged) return;
    const activeTab = getTabs().find((tab: ResourceTab): boolean => tab.tabId === activeResourceTabId);
    const activeRowCount = Array.isArray(activeTab?.rows) ? activeTab.rows.length : 0;
    const activeTabError = typeof activeTab?.errorMessage === "string" ? activeTab.errorMessage : "";
    onTabsChanged(getTabs(), activeResourceTabId, activeRowCount, activeTabError);
  };

  const setTabs = (tabs: ResourceTabInput[]): void => {
    const normalized: ResourceTab[] = (Array.isArray(tabs) ? tabs : []).map(
      (tab: ResourceTabInput): ResourceTab => toResourceTab(tab),
    );
    normalized.forEach((tab: ResourceTab): void => {
      metadataPrefs.initializeTab(tab);
    });
    resourceViewerTabs = normalized;
    if (!normalized.find((tab: ResourceTab): boolean => tab.tabId === activeResourceTabId)) {
      activeResourceTabId = normalized[0]?.tabId || null;
    }
    notifyChanged();
  };

  const upsertTab = ({
    title,
    resourceRef,
    select,
  }: {
    title: string;
    resourceRef: ResourceRefLike;
    select: boolean;
  }): string | null => {
    if (!resourceRef || typeof resourceRef !== "object") return null;
    const tabId: string = buildResourceTabId(resourceRef);
    const existing: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (existing) {
      if (title) existing.title = String(title);
      if (select) activeResourceTabId = existing.tabId;
      notifyChanged();
      return existing.tabId;
    }
    const nextTab: ResourceTab = toResourceTab({ title, resourceRef });
    metadataPrefs.initializeTab(nextTab);
    getTabs().push(nextTab);
    if (select || !activeResourceTabId) activeResourceTabId = nextTab.tabId;
    notifyChanged();
    return nextTab.tabId;
  };

  const selectTab = (tabId: string): void => {
    if (!tabId) return;
    const exists: boolean = getTabs().some((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (!exists) return;
    activeResourceTabId = tabId;
    notifyChanged();
  };

  const closeTab = (tabId: string): void => {
    const index: number = getTabs().findIndex((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (index < 0) return;
    getTabs().splice(index, 1);
    if (activeResourceTabId !== tabId) {
      notifyChanged();
      return;
    }
    const next: ResourceTab | undefined = getTabs()[Math.min(index, getTabs().length - 1)];
    activeResourceTabId = next?.tabId || null;
    notifyChanged();
  };

  const refreshActiveTabRows = async (): Promise<void> => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === activeResourceTabId);
    if (!active) return;
    active.isLoading = true;
    active.errorMessage = "";
    notifyChanged();
    try {
      const entries: unknown[] = await listGamesForResource(active.resourceRef);
      metadataPrefs.hydrateRowsIntoTab(active, entries, t);
    } catch (error: unknown) {
      active.rows = [];
      active.availableMetadataKeys = [];
      const msg: string = error instanceof Error ? error.message : String(error);
      active.errorMessage = msg || t("resources.error", "Unable to load resource games.");
    } finally {
      active.isLoading = false;
      notifyChanged();
    }
  };

  const getActiveResourceRef = (): ResourceRefLike | null => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === activeResourceTabId);
    return active?.resourceRef || null;
  };

  const getActiveTabId = (): string | null => activeResourceTabId;

  const openActiveRowByIndex = (rowIndex: number): void => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return;
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === activeResourceTabId);
    const row: ResourceRow | undefined = active?.rows?.[rowIndex];
    if (!row?.sourceRef) return;
    if (typeof onOpenGameBySourceRef === "function") {
      void Promise.resolve(onOpenGameBySourceRef(row.sourceRef)).catch((): void => {});
    }
  };

  const buildTabSnapshots = (): ResourceTabSnap[] =>
    getTabs().map((tab: ResourceTab): ResourceTabSnap | null => {
      const locator = typeof tab.resourceRef?.locator === "string" ? tab.resourceRef.locator : "";
      if (!locator) return null;
      return {
        tabId: tab.tabId,
        title: tab.title,
        kind: typeof tab.resourceRef?.kind === "string" ? tab.resourceRef.kind : "",
        locator,
      };
    }).filter((s): s is ResourceTabSnap => s !== null);

  return {
    buildTabSnapshots,
    closeTab,
    getActiveResourceRef,
    getActiveTabId,
    openActiveRowByIndex,
    refreshActiveTabRows,
    selectTab,
    setTabs,
    upsertTab,
  };
};

export { resolveTabTitleText, buildResourceTabId, toResourceRef };
