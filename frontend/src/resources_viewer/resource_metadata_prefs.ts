import { DEFAULT_PGN_METADATA_KEYS, DEFAULT_RESOURCE_VIEWER_KEYS } from "../resources/sources/types.js";

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

const PGN_METADATA_FIELDS = [...DEFAULT_PGN_METADATA_KEYS];

const BUILTIN_METADATA_FIELDS = Object.freeze([
  { key: "identifier", label: "Identifier" },
  { key: "source", label: "Source" },
  { key: "revision", label: "Revision" },
  ...PGN_METADATA_FIELDS.map((field: any): any => ({ key: field, label: field })),
]);

const normalizeMetadataSelection = (
  rawKeys: any,
  fallbackKeys: any = [...DEFAULT_RESOURCE_VIEWER_KEYS],
): any => {
  const source = Array.isArray(rawKeys) ? rawKeys : fallbackKeys;
  const out: string[] = [];
  source.forEach((value: any): any => {
    const key = String(value || "").trim();
    if (!key || out.includes(key) || key === "game") return;
    out.push(key);
  });
  if (!out.length) return [...fallbackKeys];
  return out;
};

const normalizeColumnOrder = (order: any, allowedKeys: any): any => {
  const allowed = Array.isArray(allowedKeys) ? allowedKeys.map((key: any): any => String(key || "")) : [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  (Array.isArray(order) ? order : []).forEach((key: any): any => {
    const cleanKey = String(key || "");
    if (!cleanKey || seen.has(cleanKey) || !allowed.includes(cleanKey)) return;
    seen.add(cleanKey);
    normalized.push(cleanKey);
  });
  allowed.forEach((key: any): any => {
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
};

const clampColumnWidth = (value: any): any => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_COLUMN_WIDTH_PX;
  return Math.max(MIN_COLUMN_WIDTH_PX, Math.min(MAX_COLUMN_WIDTH_PX, Math.round(parsed)));
};

const readColumnPrefsMap = (): any => {
  try {
    const raw = window.localStorage?.getItem(RESOURCE_COLUMN_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeColumnPrefsMap = (prefsMap: any): any => {
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
export const createResourceMetadataPrefs = ({ state }: any): any => {
  const columnPrefsByTabId = readColumnPrefsMap();

  const getPersistedPrefs = (tabId: any): any => {
    const prefs = columnPrefsByTabId[String(tabId || "")];
    if (!prefs || typeof prefs !== "object") return null;
    return prefs;
  };

  const reconcileTabColumnState = (tab: any): any => {
    if (!tab) return [];
    const visibleMetadataKeys = normalizeMetadataSelection(
      tab.visibleMetadataKeys,
      state.resourceViewerDefaultMetadataKeys,
    );
    tab.visibleMetadataKeys = [...visibleMetadataKeys];
    const allowedColumnKeys = ["game", ...visibleMetadataKeys];
    tab.metadataColumnOrder = normalizeColumnOrder(tab.metadataColumnOrder, allowedColumnKeys);
    if (!tab.columnWidths || typeof tab.columnWidths !== "object") tab.columnWidths = {};
    tab.metadataColumnOrder.forEach((columnKey: any): any => {
      if (tab.columnWidths[columnKey] == null) tab.columnWidths[columnKey] = DEFAULT_COLUMN_WIDTH_PX;
      tab.columnWidths[columnKey] = clampColumnWidth(tab.columnWidths[columnKey]);
    });
    return tab.metadataColumnOrder;
  };

  const applyPersistedPrefsToTab = (tab: any): any => {
    if (!tab?.tabId) return;
    const prefs = getPersistedPrefs(tab.tabId);
    if (!prefs) return;
    if (Array.isArray(prefs.visibleMetadataKeys)) {
      tab.visibleMetadataKeys = normalizeMetadataSelection(
        prefs.visibleMetadataKeys,
        state.resourceViewerDefaultMetadataKeys,
      );
    }
    if (prefs.columnWidths && typeof prefs.columnWidths === "object") {
      tab.columnWidths = Object.fromEntries(
        Object.entries(prefs.columnWidths).map(([key, value]: any): any => [String(key), clampColumnWidth(value)]),
      );
    }
    if (Array.isArray(prefs.metadataColumnOrder)) {
      tab.metadataColumnOrder = prefs.metadataColumnOrder.map((key: any): any => String(key || "")).filter(Boolean);
    }
  };

  const persistTabPrefs = (tab: any): any => {
    if (!tab?.tabId) return;
    columnPrefsByTabId[tab.tabId] = {
      visibleMetadataKeys: normalizeMetadataSelection(
        tab.visibleMetadataKeys,
        state.resourceViewerDefaultMetadataKeys,
      ),
      metadataColumnOrder: Array.isArray(tab.metadataColumnOrder) ? [...tab.metadataColumnOrder] : ["game"],
      columnWidths: Object.fromEntries(
        Object.entries(tab.columnWidths || {}).map(([key, value]: any): any => [String(key), clampColumnWidth(value)]),
      ),
    };
    writeColumnPrefsMap(columnPrefsByTabId);
  };

  const clearPersistedPrefsForTab = (tabId: any): any => {
    const key = String(tabId || "");
    if (!key) return;
    delete columnPrefsByTabId[key];
    writeColumnPrefsMap(columnPrefsByTabId);
  };

  /**
   * Initialize one resource tab with persisted/default metadata preferences.
   *
   * @param tab Mutable resource tab object.
   */
  const initializeTab = (tab: any): any => {
    if (!tab) return;
    applyPersistedPrefsToTab(tab);
    reconcileTabColumnState(tab);
  };

  /**
   * Hydrate UI rows and discovered metadata keys for one tab.
   *
   * @param tab Target mutable tab object.
   * @param entries Raw resource rows from source gateway.
   * @param t Translation callback for fallback labels.
   */
  const hydrateRowsIntoTab = (tab: any, entries: any, t: any): any => {
    const discoveredKeys = new Set();
    const rows = (Array.isArray(entries) ? entries : []).map((entry: any): any => {
      const sourceRef = entry?.sourceRef || {};
      const identifier = String(sourceRef.recordId || entry?.identifier || "");
      const metadata: Record<string, unknown> = {};
      metadata.identifier = identifier;
      metadata.source = String(sourceRef.kind || tab?.resourceRef?.kind || "");
      metadata.revision = String(entry?.revisionToken || "");
      if (entry?.metadata && typeof entry.metadata === "object") {
        Object.entries(entry.metadata).forEach(([key, value]: any): any => {
          const cleanKey = String(key || "").trim();
          if (!cleanKey || cleanKey === "game") return;
          metadata[cleanKey] = value == null ? "" : String(value);
          discoveredKeys.add(cleanKey);
        });
      }
      if (Array.isArray(entry?.availableMetadataKeys)) {
        entry.availableMetadataKeys.forEach((fieldKey: any): any => {
          const cleanKey = String(fieldKey || "").trim();
          if (!cleanKey || cleanKey === "game") return;
          discoveredKeys.add(cleanKey);
        });
      }
      return {
        game: String(entry?.titleHint || identifier || t("resources.table.unknown", "Untitled")),
        identifier,
        source: metadata.source,
        revision: metadata.revision,
        metadata,
        sourceRef: sourceRef && typeof sourceRef === "object" ? sourceRef : null,
      };
    });
    tab.rows = rows;
    tab.availableMetadataKeys = [...discoveredKeys];
    reconcileTabColumnState(tab);
  };

  /**
   * Build metadata-field catalog shown in metadata selection dialog.
   *
   * @param tab Resource tab object.
   * @returns Ordered catalog entries (`key`, `label`).
   */
  const buildAvailableMetadataCatalog = (tab: any): any => {
    const catalog = [...BUILTIN_METADATA_FIELDS];
    const known = new Set(catalog.map((field: any): any => field.key));
    const dynamicKeys = new Set();
    (tab?.availableMetadataKeys || []).forEach((fieldKey: any): any => dynamicKeys.add(String(fieldKey || "")));
    (tab?.rows || []).forEach((row: any): any => {
      if (!row?.metadata || typeof row.metadata !== "object") return;
      Object.keys(row.metadata).forEach((fieldKey: any): any => dynamicKeys.add(String(fieldKey || "")));
    });
    [...dynamicKeys]
      .map((fieldKey: any): any => String(fieldKey || "").trim())
      .filter((fieldKey: any): any => fieldKey && fieldKey !== "game" && !known.has(fieldKey))
      .sort((left: any, right: any): any => left.localeCompare(right))
      .forEach((fieldKey: any): any => {
        catalog.push({ key: fieldKey, label: fieldKey });
      });
    return catalog;
  };

  /**
   * Apply selected metadata columns to one tab (optionally all tabs).
   *
   * @param tab Target resource tab.
   * @param selectedKeys Selected metadata keys.
   * @param applyToAll Whether to apply the selection to all tabs and defaults.
   */
  const applySelection = (tab: any, selectedKeys: any, applyToAll: any = false): any => {
    if (!tab) return;
    const normalized = normalizeMetadataSelection(selectedKeys, state.resourceViewerDefaultMetadataKeys);
    tab.visibleMetadataKeys = normalized;
    reconcileTabColumnState(tab);
    persistTabPrefs(tab);
    if (!applyToAll) return;
    state.resourceViewerDefaultMetadataKeys = [...normalized];
    state.resourceViewerTabs.forEach((candidate: any): any => {
      candidate.visibleMetadataKeys = [...normalized];
      reconcileTabColumnState(candidate);
      persistTabPrefs(candidate);
    });
  };

  /**
   * Reset one tab metadata-column preferences to current defaults.
   *
   * @param tab Target resource tab.
   */
  const resetTabToDefaults = (tab: any): any => {
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

