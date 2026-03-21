import { createResourceMetadataPrefs } from "./resource_metadata_prefs.js";
import type { SourceRefLike } from "../runtime/bootstrap_shared";

/**
 * Index module.
 *
 * Integration API:
 * - Primary exports from this module: `createResourceViewerCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 * - All rendering is the responsibility of the caller (`ResourceViewer.tsx`).
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

type ResourceViewerState = {
  resourceViewerTabs: unknown[];
  resourceViewerDefaultMetadataKeys: string[];
  activeResourceTabId: string | null;
};

type ResourceTabInput = {
  title?: string;
  resourceRef: ResourceRefLike;
  visibleMetadataKeys?: string[];
};

type ResourceViewerDeps = {
  state: ResourceViewerState;
  t: (key: string, fallback?: string) => string;
  listGamesForResource: (resourceRef: ResourceRefLike) => Promise<unknown[]>;
  onRequestOpenResource?: () => void | Promise<void>;
  onOpenGameBySourceRef?: (sourceRef: ResourceRefLike) => void | Promise<void>;
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

const toResourceTab = (tab: ResourceTabInput, state: ResourceViewerState): ResourceTab => ({
  tabId: buildResourceTabId(tab.resourceRef),
  title: String(tab.title || tab.resourceRef?.kind || "Resource"),
  resourceRef: tab.resourceRef || { kind: "file", locator: "default" },
  rows: [],
  availableMetadataKeys: [],
  visibleMetadataKeys: Array.isArray(tab.visibleMetadataKeys)
    ? [...tab.visibleMetadataKeys]
    : [...state.resourceViewerDefaultMetadataKeys],
  metadataColumnOrder: ["game"],
  columnWidths: {},
  errorMessage: "",
  isLoading: false,
});

export const createResourceViewerCapabilities = ({
  state,
  t,
  listGamesForResource,
  onOpenGameBySourceRef,
}: ResourceViewerDeps) => {
  const metadataPrefs = createResourceMetadataPrefs({
    state: state as Parameters<typeof createResourceMetadataPrefs>[0]["state"],
  });

  const getTabs = (): ResourceTab[] =>
    (Array.isArray(state.resourceViewerTabs) ? state.resourceViewerTabs : []) as ResourceTab[];

  const setTabs = (tabs: ResourceTabInput[]): void => {
    const normalized: ResourceTab[] = (Array.isArray(tabs) ? tabs : []).map((tab: ResourceTabInput): ResourceTab =>
      toResourceTab(tab, state),
    );
    normalized.forEach((tab: ResourceTab): void => {
      metadataPrefs.initializeTab(tab);
    });
    state.resourceViewerTabs = normalized;
    if (!normalized.find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId)) {
      state.activeResourceTabId = normalized[0]?.tabId || null;
    }
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
      if (select) state.activeResourceTabId = existing.tabId;
      return existing.tabId;
    }
    const nextTab: ResourceTab = toResourceTab({ title, resourceRef }, state);
    metadataPrefs.initializeTab(nextTab);
    getTabs().push(nextTab);
    if (select || !state.activeResourceTabId) state.activeResourceTabId = nextTab.tabId;
    return nextTab.tabId;
  };

  const selectTab = (tabId: string): void => {
    if (!tabId) return;
    const exists: boolean = getTabs().some((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (!exists) return;
    state.activeResourceTabId = tabId;
  };

  const closeTab = (tabId: string): void => {
    const index: number = getTabs().findIndex((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (index < 0) return;
    getTabs().splice(index, 1);
    if (state.activeResourceTabId !== tabId) return;
    const next: ResourceTab | undefined = getTabs()[Math.min(index, getTabs().length - 1)];
    state.activeResourceTabId = next?.tabId || null;
  };

  const refreshActiveTabRows = async (): Promise<void> => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    if (!active) return;
    active.isLoading = true;
    active.errorMessage = "";
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
    }
  };

  const getActiveResourceRef = (): ResourceRefLike | null => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    return active?.resourceRef || null;
  };

  const openActiveRowByIndex = (rowIndex: number): void => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return;
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    const row: ResourceRow | undefined = active?.rows?.[rowIndex];
    if (!row?.sourceRef) return;
    if (typeof onOpenGameBySourceRef === "function") {
      void Promise.resolve(onOpenGameBySourceRef(row.sourceRef)).catch((): void => {});
    }
  };

  return {
    closeTab,
    getActiveResourceRef,
    openActiveRowByIndex,
    refreshActiveTabRows,
    selectTab,
    setTabs,
    upsertTab,
  };
};

export { resolveTabTitleText, buildResourceTabId, toResourceRef };
