/**
 * viewer_utils — shared column-preference utilities for ResourceViewer.
 *
 * Integration API:
 * - Exports: canonical `clampWidth`, `readPrefsMap`, `writePrefsMap`,
 *   `persistTabPrefs`, `reconcileColumns`, and shared types.
 * - Exports: `GroupByState`, `SortConfig`, and their localStorage helpers.
 *
 * Configuration API:
 * - Column-width bounds and storage keys are compile-time constants.
 *
 * Communication API:
 * - `readPrefsMap` / `writePrefsMap` / `readGroupByState` / `writeGroupByState`
 *   use `window.localStorage`.
 * - All other exports are pure functions with no I/O.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const PREFS_STORAGE_KEY = "x2chess.resourceViewerColumnPrefs.v1";
export const GROUP_BY_STORAGE_PREFIX = "x2chess.groupby.";
export const DEFAULT_COL_WIDTH_PX = 160;
export const MIN_COL_WIDTH_PX = 90;
export const MAX_COL_WIDTH_PX = 560;

/** Metadata columns shown when no user preference exists for a tab. */
export const DEFAULT_METADATA_KEYS: readonly string[] = ["White", "Black", "Result", "Opening", "ECO", "Date"];

/**
 * Canonical display order for metadata keys.
 *
 * Keys appear in this order first, then any remaining keys alphabetically,
 * then the system keys (identifier, source, revision) last.
 */
export const METADATA_CANONICAL_ORDER: readonly string[] = [
  "White", "WhiteElo", "Black", "BlackElo", "Result", "Opening", "ECO", "Event", "Date",
];

/** System keys always placed last in the metadata catalog. */
export const METADATA_LAST_KEYS: readonly string[] = ["identifier", "source", "revision"];

// ── Shared types ──────────────────────────────────────────────────────────────

export type ResourceRef = {
  kind: string;
  locator: string;
};

export type ResourceRow = {
  game: string;
  kind: "game" | "position";
  identifier: string;
  source: string;
  revision: string;
  metadata: Record<string, string>;
  sourceRef: Record<string, unknown> | null;
};

export type TabState = {
  tabId: string;
  title: string;
  resourceRef: ResourceRef;
  rows: ResourceRow[];
  availableMetadataKeys: string[];
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
  errorMessage: string;
  isLoading: boolean;
};

export type TabPrefs = {
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
};

export type GroupByState = {
  /** Ordered list of metadata keys to group by (first = outermost level). */
  fields: string[];
  /** Composite group keys that are collapsed. Format: `"depth:value"`. */
  collapsedKeys: string[];
};

export type SortConfig = {
  key: string;
  dir: "asc" | "desc";
};

// ── Column-width clamp ────────────────────────────────────────────────────────

export const clampWidth = (value: unknown): number => {
  const n: number = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_COL_WIDTH_PX;
  return Math.max(MIN_COL_WIDTH_PX, Math.min(MAX_COL_WIDTH_PX, Math.round(n)));
};

// ── Column-prefs localStorage helpers ────────────────────────────────────────

export const readPrefsMap = (): Record<string, TabPrefs> => {
  try {
    const raw: string | null = window.localStorage?.getItem(PREFS_STORAGE_KEY) ?? null;
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, TabPrefs>;
  } catch {
    return {};
  }
};

export const writePrefsMap = (map: Record<string, TabPrefs>): void => {
  try {
    window.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable — keep UI functional.
  }
};

export const persistTabPrefs = (tab: TabState): void => {
  const map: Record<string, TabPrefs> = readPrefsMap();
  map[tab.tabId] = {
    visibleMetadataKeys: [...tab.visibleMetadataKeys],
    metadataColumnOrder: [...tab.metadataColumnOrder],
    columnWidths: { ...tab.columnWidths },
  };
  writePrefsMap(map);
};

// ── Group-by localStorage helpers ─────────────────────────────────────────────

export const readGroupByState = (tabId: string): GroupByState => {
  try {
    const raw: string | null =
      window.localStorage?.getItem(`${GROUP_BY_STORAGE_PREFIX}${tabId}`) ?? null;
    if (!raw) return { fields: [], collapsedKeys: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { fields: [], collapsedKeys: [] };
    const obj = parsed as Record<string, unknown>;
    return {
      fields: Array.isArray(obj.fields)
        ? (obj.fields as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      collapsedKeys: Array.isArray(obj.collapsedKeys)
        ? (obj.collapsedKeys as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
    };
  } catch {
    return { fields: [], collapsedKeys: [] };
  }
};

export const writeGroupByState = (tabId: string, state: GroupByState): void => {
  try {
    window.localStorage?.setItem(
      `${GROUP_BY_STORAGE_PREFIX}${tabId}`,
      JSON.stringify(state),
    );
  } catch {
    // Storage unavailable.
  }
};

// ── Column-order reconciliation ───────────────────────────────────────────────

/**
 * Ensure `tab.visibleMetadataKeys`, `metadataColumnOrder`, and `columnWidths`
 * are internally consistent and clamped to valid ranges.
 *
 * @param tab Source tab state.
 * @returns New tab state with reconciled column fields.
 */
export const reconcileColumns = <T extends TabState>(tab: T): T => {
  const visible: string[] =
    tab.visibleMetadataKeys.length > 0
      ? [...tab.visibleMetadataKeys]
      : [...DEFAULT_METADATA_KEYS];
  const allowed: string[] = ["game", ...visible];
  const seen = new Set<string>();
  const order: string[] = [];
  [...tab.metadataColumnOrder, ...allowed].forEach((k: string): void => {
    if (k && !seen.has(k) && allowed.includes(k)) {
      seen.add(k);
      order.push(k);
    }
  });
  const widths: Record<string, number> = {};
  order.forEach((k: string): void => {
    widths[k] = clampWidth(tab.columnWidths[k] ?? DEFAULT_COL_WIDTH_PX);
  });
  return { ...tab, visibleMetadataKeys: visible, metadataColumnOrder: order, columnWidths: widths };
};
