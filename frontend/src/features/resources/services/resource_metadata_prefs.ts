import {
  PGN_STANDARD_METADATA_KEYS as DEFAULT_PGN_METADATA_KEYS,
  DEFAULT_RESOURCE_VIEWER_METADATA_KEYS as DEFAULT_RESOURCE_VIEWER_KEYS,
} from "../../../../../parts/resource/src/domain/metadata";

/**
 * Resource Metadata Prefs module.
 *
 * Integration API:
 * - Primary exports from this module: `createResourceMetadataPrefs`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, browser storage; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

const RESOURCE_COLUMN_PREFS_STORAGE_KEY = "x2chess.resourceViewerColumnPrefs.v1";
const DEFAULT_COLUMN_WIDTH_PX = 160;
const MIN_COLUMN_WIDTH_PX = 90;
const MAX_COLUMN_WIDTH_PX = 560;

const PGN_METADATA_FIELDS: string[] = [...DEFAULT_PGN_METADATA_KEYS];

type MetadataCatalogEntry = { key: string; label: string };

type ResourceRow = {
  game: string;
  identifier: string;
  source: string;
  revision: string;
  metadata: Record<string, unknown>;
  sourceRef: Record<string, unknown> | null;
};

type ResourceTab = {
  tabId: string;
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
  rows: ResourceRow[];
  availableMetadataKeys: string[];
  resourceRef?: {
    kind?: string;
  } | null;
};

type ResourceViewerState = {
  resourceViewerTabs: ResourceTab[];
  resourceViewerDefaultMetadataKeys: string[];
};

type PersistedTabPrefs = {
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
};

type PersistedPrefsMap = Record<string, PersistedTabPrefs>;

const BUILTIN_METADATA_FIELDS: ReadonlyArray<MetadataCatalogEntry> = Object.freeze([
  { key: "identifier", label: "Identifier" },
  { key: "source", label: "Source" },
  { key: "revision", label: "Revision" },
  ...PGN_METADATA_FIELDS.map((field: string): MetadataCatalogEntry => ({ key: field, label: field })),
]);

const toStringKey = (value: unknown): string => String(value || "").trim();

const normalizeMetadataSelection = (
  rawKeys: unknown,
  fallbackKeys: string[] = [...DEFAULT_RESOURCE_VIEWER_KEYS],
): string[] => {
  const source: unknown[] = Array.isArray(rawKeys) ? rawKeys : fallbackKeys;
  const out: string[] = [];
  source.forEach((value: unknown): void => {
    const key: string = toStringKey(value);
    if (!key || out.includes(key) || key === "game") return;
    out.push(key);
  });
  if (!out.length) return [...fallbackKeys];
  return out;
};

const normalizeColumnOrder = (order: unknown, allowedKeys: unknown): string[] => {
  const allowed: string[] = Array.isArray(allowedKeys)
    ? allowedKeys.map((key: unknown): string => toStringKey(key)).filter(Boolean)
    : [];
  const seen: Set<string> = new Set<string>();
  const normalized: string[] = [];
  (Array.isArray(order) ? order : []).forEach((key: unknown): void => {
    const cleanKey: string = toStringKey(key);
    if (!cleanKey || seen.has(cleanKey) || !allowed.includes(cleanKey)) return;
    seen.add(cleanKey);
    normalized.push(cleanKey);
  });
  allowed.forEach((key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
};

const clampColumnWidth = (value: unknown): number => {
  const parsed: number = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_COLUMN_WIDTH_PX;
  return Math.max(MIN_COLUMN_WIDTH_PX, Math.min(MAX_COLUMN_WIDTH_PX, Math.round(parsed)));
};

const toPersistedPrefs = (value: unknown): PersistedTabPrefs | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const visibleMetadataKeys: string[] = normalizeMetadataSelection(record.visibleMetadataKeys, [...DEFAULT_RESOURCE_VIEWER_KEYS]);
  const metadataColumnOrder: string[] = Array.isArray(record.metadataColumnOrder)
    ? record.metadataColumnOrder.map((key: unknown): string => toStringKey(key)).filter(Boolean)
    : ["game", ...visibleMetadataKeys];
  const rawWidths = record.columnWidths;
  const columnWidths: Record<string, number> = {};
  if (rawWidths && typeof rawWidths === "object") {
    Object.entries(rawWidths as Record<string, unknown>).forEach(([key, widthValue]: [string, unknown]): void => {
      const cleanKey: string = toStringKey(key);
      if (!cleanKey) return;
      columnWidths[cleanKey] = clampColumnWidth(widthValue);
    });
  }
  return {
    visibleMetadataKeys,
    metadataColumnOrder,
    columnWidths,
  };
};

const readColumnPrefsMap = (): PersistedPrefsMap => {
  try {
    const raw: string | null = window.localStorage?.getItem(RESOURCE_COLUMN_PREFS_STORAGE_KEY) || null;
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: PersistedPrefsMap = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([tabId, value]: [string, unknown]): void => {
      const cleanTabId: string = toStringKey(tabId);
      if (!cleanTabId) return;
      const prefs: PersistedTabPrefs | null = toPersistedPrefs(value);
      if (!prefs) return;
      out[cleanTabId] = prefs;
    });
    return out;
  } catch {
    return {};
  }
};

const writeColumnPrefsMap = (prefsMap: PersistedPrefsMap): void => {
  try {
    window.localStorage?.setItem(RESOURCE_COLUMN_PREFS_STORAGE_KEY, JSON.stringify(prefsMap || {}));
  } catch {
    // Keep UI usable when storage is unavailable.
  }
};

/**
 * Create metadata preference helpers for resource viewer tabs.
 *
 * @param deps Factory dependencies.
 * @param deps.state Shared resource-viewer state containing tabs and defaults.
 * @returns Methods that initialize tab metadata columns, hydrate row metadata, persist
 * column preferences, and apply/reset selections.
 */
export const createResourceMetadataPrefs = ({ state }: { state: ResourceViewerState }) => {
  const columnPrefsByTabId: PersistedPrefsMap = readColumnPrefsMap();

  const getPersistedPrefs = (tabId: string): PersistedTabPrefs | null => {
    const key: string = toStringKey(tabId);
    if (!key) return null;
    return columnPrefsByTabId[key] || null;
  };

  const reconcileTabColumnState = (tab: ResourceTab): string[] => {
    const visibleMetadataKeys: string[] = normalizeMetadataSelection(
      tab.visibleMetadataKeys,
      state.resourceViewerDefaultMetadataKeys,
    );
    tab.visibleMetadataKeys = [...visibleMetadataKeys];
    const allowedColumnKeys: string[] = ["game", ...visibleMetadataKeys];
    tab.metadataColumnOrder = normalizeColumnOrder(tab.metadataColumnOrder, allowedColumnKeys);
    if (!tab.columnWidths || typeof tab.columnWidths !== "object") tab.columnWidths = {};
    tab.metadataColumnOrder.forEach((columnKey: string): void => {
      if (tab.columnWidths[columnKey] == null) tab.columnWidths[columnKey] = DEFAULT_COLUMN_WIDTH_PX;
      tab.columnWidths[columnKey] = clampColumnWidth(tab.columnWidths[columnKey]);
    });
    return tab.metadataColumnOrder;
  };

  const applyPersistedPrefsToTab = (tab: ResourceTab): void => {
    const prefs: PersistedTabPrefs | null = getPersistedPrefs(tab.tabId);
    if (!prefs) return;
    tab.visibleMetadataKeys = normalizeMetadataSelection(
      prefs.visibleMetadataKeys,
      state.resourceViewerDefaultMetadataKeys,
    );
    tab.columnWidths = Object.fromEntries(
      Object.entries(prefs.columnWidths).map(([key, value]: [string, number]): [string, number] => [String(key), clampColumnWidth(value)]),
    );
    tab.metadataColumnOrder = prefs.metadataColumnOrder.map((key: string): string => toStringKey(key)).filter(Boolean);
  };

  const persistTabPrefs = (tab: ResourceTab): void => {
    if (!tab?.tabId) return;
    columnPrefsByTabId[tab.tabId] = {
      visibleMetadataKeys: normalizeMetadataSelection(
        tab.visibleMetadataKeys,
        state.resourceViewerDefaultMetadataKeys,
      ),
      metadataColumnOrder: Array.isArray(tab.metadataColumnOrder) ? [...tab.metadataColumnOrder] : ["game"],
      columnWidths: Object.fromEntries(
        Object.entries(tab.columnWidths || {}).map(([key, value]: [string, unknown]): [string, number] => [String(key), clampColumnWidth(value)]),
      ),
    };
    writeColumnPrefsMap(columnPrefsByTabId);
  };

  const clearPersistedPrefsForTab = (tabId: string): void => {
    const key: string = toStringKey(tabId);
    if (!key) return;
    delete columnPrefsByTabId[key];
    writeColumnPrefsMap(columnPrefsByTabId);
  };

  const initializeTab = (tab: ResourceTab | null | undefined): void => {
    if (!tab) return;
    applyPersistedPrefsToTab(tab);
    reconcileTabColumnState(tab);
  };

  const hydrateRowsIntoTab = (
    tab: ResourceTab,
    entries: unknown,
    t: (key: string, fallback?: string) => string,
  ): void => {
    const discoveredKeys: Set<string> = new Set<string>();
    const rows: ResourceRow[] = (Array.isArray(entries) ? entries : []).map((entry: unknown): ResourceRow => {
      const entryRecord: Record<string, unknown> = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const sourceRefRaw: unknown = entryRecord.sourceRef;
      const sourceRef: Record<string, unknown> =
        sourceRefRaw && typeof sourceRefRaw === "object" ? (sourceRefRaw as Record<string, unknown>) : {};
      const identifier: string = toStringKey(sourceRef.recordId || entryRecord.identifier);
      const metadata: Record<string, unknown> = {};
      metadata.identifier = identifier;
      metadata.source = toStringKey(sourceRef.kind || tab?.resourceRef?.kind);
      metadata.revision = toStringKey(entryRecord.revisionToken);

      const metadataRaw: unknown = entryRecord.metadata;
      if (metadataRaw && typeof metadataRaw === "object") {
        Object.entries(metadataRaw as Record<string, unknown>).forEach(([key, value]: [string, unknown]): void => {
          const cleanKey: string = toStringKey(key);
          if (!cleanKey || cleanKey === "game") return;
          metadata[cleanKey] = value == null ? "" : String(value);
          discoveredKeys.add(cleanKey);
        });
      }

      const availableMetadataKeysRaw: unknown = entryRecord.availableMetadataKeys;
      if (Array.isArray(availableMetadataKeysRaw)) {
        availableMetadataKeysRaw.forEach((fieldKey: unknown): void => {
          const cleanKey: string = toStringKey(fieldKey);
          if (!cleanKey || cleanKey === "game") return;
          discoveredKeys.add(cleanKey);
        });
      }

      return {
        game: toStringKey(entryRecord.titleHint || identifier || t("resources.table.unknown", "Untitled")),
        identifier,
        source: String(metadata.source || ""),
        revision: String(metadata.revision || ""),
        metadata,
        sourceRef: sourceRefRaw && typeof sourceRefRaw === "object" ? (sourceRefRaw as Record<string, unknown>) : null,
      };
    });

    tab.rows = rows;
    tab.availableMetadataKeys = [...discoveredKeys];
    reconcileTabColumnState(tab);
  };

  const buildAvailableMetadataCatalog = (tab: ResourceTab): MetadataCatalogEntry[] => {
    const catalog: MetadataCatalogEntry[] = [...BUILTIN_METADATA_FIELDS];
    const known: Set<string> = new Set<string>(catalog.map((field: MetadataCatalogEntry): string => field.key));
    const dynamicKeys: Set<string> = new Set<string>();

    (tab?.availableMetadataKeys || []).forEach((fieldKey: string): void => {
      dynamicKeys.add(toStringKey(fieldKey));
    });

    (tab?.rows || []).forEach((row: ResourceRow): void => {
      if (!row?.metadata || typeof row.metadata !== "object") return;
      Object.keys(row.metadata).forEach((fieldKey: string): void => {
        dynamicKeys.add(toStringKey(fieldKey));
      });
    });

    [...dynamicKeys]
      .map((fieldKey: string): string => toStringKey(fieldKey))
      .filter((fieldKey: string): boolean => fieldKey.length > 0 && fieldKey !== "game" && !known.has(fieldKey))
      .sort((left: string, right: string): number => left.localeCompare(right))
      .forEach((fieldKey: string): void => {
        catalog.push({ key: fieldKey, label: fieldKey });
      });

    return catalog;
  };

  const applySelection = (
    tab: ResourceTab | null | undefined,
    selectedKeys: unknown,
    applyToAll: boolean = false,
  ): void => {
    if (!tab) return;
    const normalized: string[] = normalizeMetadataSelection(selectedKeys, state.resourceViewerDefaultMetadataKeys);
    tab.visibleMetadataKeys = normalized;
    reconcileTabColumnState(tab);
    persistTabPrefs(tab);
    if (!applyToAll) return;
    state.resourceViewerDefaultMetadataKeys = [...normalized];
    state.resourceViewerTabs.forEach((candidate: ResourceTab): void => {
      candidate.visibleMetadataKeys = [...normalized];
      reconcileTabColumnState(candidate);
      persistTabPrefs(candidate);
    });
  };

  const resetTabToDefaults = (tab: ResourceTab | null | undefined): void => {
    if (!tab) return;
    clearPersistedPrefsForTab(tab.tabId);
    tab.visibleMetadataKeys = normalizeMetadataSelection(null, state.resourceViewerDefaultMetadataKeys);
    tab.metadataColumnOrder = ["game", ...tab.visibleMetadataKeys];
    tab.columnWidths = {};
    reconcileTabColumnState(tab);
  };

  return {
    buildAvailableMetadataCatalog,
    clampColumnWidth,
    hydrateRowsIntoTab,
    initializeTab,
    persistTabPrefs,
    reconcileTabColumnState,
    applySelection,
    resetTabToDefaults,
  };
};
