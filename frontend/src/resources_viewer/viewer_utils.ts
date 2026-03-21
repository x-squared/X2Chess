/**
 * viewer_utils — shared column-preference utilities for ResourceViewer.
 *
 * Integration API:
 * - Exports: canonical `clampWidth`, `readPrefsMap`, `writePrefsMap`,
 *   `persistTabPrefs`, `reconcileColumns`, and shared types.
 *
 * Configuration API:
 * - Column-width bounds and storage key are compile-time constants.
 *
 * Communication API:
 * - `readPrefsMap` / `writePrefsMap` use `window.localStorage`.
 * - All other exports are pure functions with no I/O.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const PREFS_STORAGE_KEY = "x2chess.resourceViewerColumnPrefs.v1";
export const DEFAULT_COL_WIDTH_PX = 160;
export const MIN_COL_WIDTH_PX = 90;
export const MAX_COL_WIDTH_PX = 560;

/** Metadata columns shown when no user preference exists for a tab. */
export const DEFAULT_METADATA_KEYS: readonly string[] = ["identifier", "source", "revision"];

// ── Shared types ──────────────────────────────────────────────────────────────

export type ResourceRef = {
  kind: string;
  locator: string;
};

export type ResourceRow = {
  game: string;
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
