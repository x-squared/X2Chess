import { DEFAULT_PGN_METADATA_KEYS } from "../resources/sources/types.js";

/**
 * Resource metadata preference service for Resource-Viewer tabs.
 *
 * Integration API:
 * - Create once via `createResourceMetadataPrefs({ state })`.
 * - Call `initializeTab(tab)` when tabs are created/restored.
 * - Call `hydrateRowsIntoTab(tab, entries, t)` after resource rows are listed.
 * - Use `persistTabPrefs(tab)`, `applySelection(tab, keys, applyToAll)`, and
 *   `resetTabToDefaults(tab)` from metadata-dialog and column interaction flows.
 *
 * Configuration API:
 * - Uses `state.resourceViewerDefaultMetadataKeys` as default/fallback selection.
 * - Persists per-tab prefs into localStorage key
 *   `x2chess.resourceViewerColumnPrefs.v1`.
 * - Width constraints: min 90px, max 560px, default 160px.
 *
 * Communication API:
 * - Mutates tab objects in place (`visibleMetadataKeys`, `metadataColumnOrder`,
 *   `columnWidths`, `rows`, `availableMetadataKeys`).
 * - May update `state.resourceViewerDefaultMetadataKeys` when apply-to-all is used.
 * - No DOM access; pure state/persistence operations.
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
  ...PGN_METADATA_FIELDS.map((field) => ({ key: field, label: field })),
]);

const normalizeMetadataSelection = (
  rawKeys,
  fallbackKeys = ["White", "Black", "Date", "Event", "ECO", "Opening", "Result"],
) => {
  const source = Array.isArray(rawKeys) ? rawKeys : fallbackKeys;
  const out: string[] = [];
  source.forEach((value) => {
    const key = String(value || "").trim();
    if (!key || out.includes(key) || key === "game") return;
    out.push(key);
  });
  if (!out.length) return [...fallbackKeys];
  return out;
};

const normalizeColumnOrder = (order, allowedKeys) => {
  const allowed = Array.isArray(allowedKeys) ? allowedKeys.map((key) => String(key || "")) : [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  (Array.isArray(order) ? order : []).forEach((key) => {
    const cleanKey = String(key || "");
    if (!cleanKey || seen.has(cleanKey) || !allowed.includes(cleanKey)) return;
    seen.add(cleanKey);
    normalized.push(cleanKey);
  });
  allowed.forEach((key) => {
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
};

const clampColumnWidth = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_COLUMN_WIDTH_PX;
  return Math.max(MIN_COLUMN_WIDTH_PX, Math.min(MAX_COLUMN_WIDTH_PX, Math.round(parsed)));
};

const readColumnPrefsMap = () => {
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

const writeColumnPrefsMap = (prefsMap) => {
  try {
    window.localStorage?.setItem(RESOURCE_COLUMN_PREFS_STORAGE_KEY, JSON.stringify(prefsMap || {}));
  } catch {
    // Keep UI usable when storage is unavailable.
  }
};

export const createResourceMetadataPrefs = ({ state }) => {
  const columnPrefsByTabId = readColumnPrefsMap();

  const getPersistedPrefs = (tabId) => {
    const prefs = columnPrefsByTabId[String(tabId || "")];
    if (!prefs || typeof prefs !== "object") return null;
    return prefs;
  };

  const reconcileTabColumnState = (tab) => {
    if (!tab) return [];
    const visibleMetadataKeys = normalizeMetadataSelection(
      tab.visibleMetadataKeys,
      state.resourceViewerDefaultMetadataKeys,
    );
    tab.visibleMetadataKeys = [...visibleMetadataKeys];
    const allowedColumnKeys = ["game", ...visibleMetadataKeys];
    tab.metadataColumnOrder = normalizeColumnOrder(tab.metadataColumnOrder, allowedColumnKeys);
    if (!tab.columnWidths || typeof tab.columnWidths !== "object") tab.columnWidths = {};
    tab.metadataColumnOrder.forEach((columnKey) => {
      if (tab.columnWidths[columnKey] == null) tab.columnWidths[columnKey] = DEFAULT_COLUMN_WIDTH_PX;
      tab.columnWidths[columnKey] = clampColumnWidth(tab.columnWidths[columnKey]);
    });
    return tab.metadataColumnOrder;
  };

  const applyPersistedPrefsToTab = (tab) => {
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
        Object.entries(prefs.columnWidths).map(([key, value]) => [String(key), clampColumnWidth(value)]),
      );
    }
    if (Array.isArray(prefs.metadataColumnOrder)) {
      tab.metadataColumnOrder = prefs.metadataColumnOrder.map((key) => String(key || "")).filter(Boolean);
    }
  };

  const persistTabPrefs = (tab) => {
    if (!tab?.tabId) return;
    columnPrefsByTabId[tab.tabId] = {
      visibleMetadataKeys: normalizeMetadataSelection(
        tab.visibleMetadataKeys,
        state.resourceViewerDefaultMetadataKeys,
      ),
      metadataColumnOrder: Array.isArray(tab.metadataColumnOrder) ? [...tab.metadataColumnOrder] : ["game"],
      columnWidths: Object.fromEntries(
        Object.entries(tab.columnWidths || {}).map(([key, value]) => [String(key), clampColumnWidth(value)]),
      ),
    };
    writeColumnPrefsMap(columnPrefsByTabId);
  };

  const clearPersistedPrefsForTab = (tabId) => {
    const key = String(tabId || "");
    if (!key) return;
    delete columnPrefsByTabId[key];
    writeColumnPrefsMap(columnPrefsByTabId);
  };

  const initializeTab = (tab) => {
    if (!tab) return;
    applyPersistedPrefsToTab(tab);
    reconcileTabColumnState(tab);
  };

  const hydrateRowsIntoTab = (tab, entries, t) => {
    const discoveredKeys = new Set();
    const rows = (Array.isArray(entries) ? entries : []).map((entry) => {
      const sourceRef = entry?.sourceRef || {};
      const identifier = String(sourceRef.recordId || entry?.identifier || "");
      const metadata: Record<string, unknown> = {};
      metadata.identifier = identifier;
      metadata.source = String(sourceRef.kind || tab?.resourceRef?.kind || "");
      metadata.revision = String(entry?.revisionToken || "");
      if (entry?.metadata && typeof entry.metadata === "object") {
        Object.entries(entry.metadata).forEach(([key, value]) => {
          const cleanKey = String(key || "").trim();
          if (!cleanKey || cleanKey === "game") return;
          metadata[cleanKey] = value == null ? "" : String(value);
          discoveredKeys.add(cleanKey);
        });
      }
      if (Array.isArray(entry?.availableMetadataKeys)) {
        entry.availableMetadataKeys.forEach((fieldKey) => {
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

  const buildAvailableMetadataCatalog = (tab) => {
    const catalog = [...BUILTIN_METADATA_FIELDS];
    const known = new Set(catalog.map((field) => field.key));
    const dynamicKeys = new Set();
    (tab?.availableMetadataKeys || []).forEach((fieldKey) => dynamicKeys.add(String(fieldKey || "")));
    (tab?.rows || []).forEach((row) => {
      if (!row?.metadata || typeof row.metadata !== "object") return;
      Object.keys(row.metadata).forEach((fieldKey) => dynamicKeys.add(String(fieldKey || "")));
    });
    [...dynamicKeys]
      .map((fieldKey) => String(fieldKey || "").trim())
      .filter((fieldKey) => fieldKey && fieldKey !== "game" && !known.has(fieldKey))
      .sort((left, right) => left.localeCompare(right))
      .forEach((fieldKey) => {
        catalog.push({ key: fieldKey, label: fieldKey });
      });
    return catalog;
  };

  const applySelection = (tab, selectedKeys, applyToAll = false) => {
    if (!tab) return;
    const normalized = normalizeMetadataSelection(selectedKeys, state.resourceViewerDefaultMetadataKeys);
    tab.visibleMetadataKeys = normalized;
    reconcileTabColumnState(tab);
    persistTabPrefs(tab);
    if (!applyToAll) return;
    state.resourceViewerDefaultMetadataKeys = [...normalized];
    state.resourceViewerTabs.forEach((candidate) => {
      candidate.visibleMetadataKeys = [...normalized];
      reconcileTabColumnState(candidate);
      persistTabPrefs(candidate);
    });
  };

  const resetTabToDefaults = (tab) => {
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

