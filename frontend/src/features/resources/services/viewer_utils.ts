/**
 * viewer_utils — shared column-preference utilities for ResourceViewer.
 *
 * Integration API:
 * - Exports: `buildRecordIdToRowMap` — resolve reference-field ids to `ResourceRow`
 *   for the loaded tab (same rows as the Game column).
 * - Exports: canonical `clampWidth`, `readPrefsMap`, `writePrefsMap`,
 *   `persistTabPrefs`, `reconcileColumns`, `insertMetadataColumnFromSchema`,
 *   `listAddableMetadataFields`, `resolveMergedFieldDefinition`, `removeMetadataColumnFromTab`, `rowPrimaryRecordId`, and shared types.
 * - Exports: `GroupByState`, `SortConfig`, and their localStorage helpers.
 *
 * Configuration API:
 * - Column-width bounds and storage keys are compile-time constants.
 *
 * Communication API:
 * - `readPrefsMap` / `writePrefsMap` / `readGroupByState` / `writeGroupByState`
 *   use `globalThis.localStorage`.
 * - All other exports are pure functions with no I/O.
 */

import {
  BUILT_IN_SCHEMA,
  DEFAULT_RESOURCE_VIEWER_METADATA_KEYS,
  LEGACY_X2_STYLE_METADATA_KEY,
  LEGACY_XTWOCHESS_STYLE_METADATA_KEY,
  X2CHESS_STYLE_METADATA_KEY,
  type MetadataFieldDefinition,
  type MetadataSchema,
} from "../../../../../parts/resource/src/domain/metadata_schema";

/** Legacy style header keys omitted from resource viewer column UI (Add metadata + dialog); parsing unchanged. */
export const RESOURCE_VIEWER_OMIT_KEYS: ReadonlySet<string> = new Set<string>([
  LEGACY_XTWOCHESS_STYLE_METADATA_KEY,
  LEGACY_X2_STYLE_METADATA_KEY,
]);
import { createVersionedStore } from "../../../storage";

// ── Constants ─────────────────────────────────────────────────────────────────

export const PREFS_STORAGE_KEY = "x2chess.resourceViewerColumnPrefs.v1";
export const GROUP_BY_STORAGE_PREFIX = "x2chess.groupby.";
export const DEFAULT_COL_WIDTH_PX = 160;
export const MIN_COL_WIDTH_PX = 40;
export const MAX_COL_WIDTH_PX = 560;

/** Default width for the optional `game` (record id) column — hash icon only (~18px + minimal chrome). */
export const DEFAULT_GAME_ID_COL_WIDTH_PX = 28;
export const MIN_GAME_ID_COL_WIDTH_PX = 24;
export const MAX_GAME_ID_COL_WIDTH_PX = 40;

/** Metadata columns shown when no user preference exists for a tab (aligned with `DEFAULT_RESOURCE_VIEWER_METADATA_KEYS`). */
export const DEFAULT_METADATA_KEYS: readonly string[] = DEFAULT_RESOURCE_VIEWER_METADATA_KEYS;

/**
 * Canonical display order for metadata keys.
 *
 * Keys appear in this order first, then any remaining keys alphabetically,
 * then the system keys (identifier, revision) last.
 */
export const METADATA_CANONICAL_ORDER: readonly string[] = [
  "White",
  "Black",
  "Result",
  "ECO",
  "Opening",
  "Event",
  "Site",
  "Round",
  "Date",
  "WhiteElo",
  "BlackElo",
  "TimeControl",
  "Termination",
  "Annotator",
  X2CHESS_STYLE_METADATA_KEY,
  "Material",
  "Head",
];

/** System keys always placed last in the metadata catalog (`source` omitted — not offered as a column). */
export const METADATA_LAST_KEYS: readonly string[] = ["identifier", "revision"];

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

/**
 * Map referenced record ids to loaded table rows for the active tab.
 * Keys each row by `sourceRef.recordId` and by `identifier` (when they differ) so
 * reference-field values resolve to the same `ResourceRow` the Game column uses.
 */
export const buildRecordIdToRowMap = (rows: readonly ResourceRow[]): Map<string, ResourceRow> => {
  const m: Map<string, ResourceRow> = new Map();
  for (const row of rows) {
    const sr: Record<string, unknown> | null = row.sourceRef;
    const fromRef: string =
      sr && typeof sr["recordId"] === "string" ? String(sr["recordId"]).trim() : "";
    const id: string = fromRef || String(row.identifier ?? "").trim();
    if (id) m.set(id, row);
    const ident: string = String(row.identifier ?? "").trim();
    if (ident && ident !== id) m.set(ident, row);
  }
  return m;
};

/**
 * Canonical stable id for a loaded row: `sourceRef.recordId` when present, otherwise `identifier`.
 * Matches keys used in `buildRecordIdToRowMap` and the resource table “Game ID” column.
 *
 * @param row Loaded resource row.
 * @returns Non-empty id string, or empty when neither field is set.
 */
export const rowPrimaryRecordId = (row: ResourceRow): string => {
  const sr: Record<string, unknown> | null = row.sourceRef;
  const fromRef: string =
    sr && typeof sr["recordId"] === "string" ? String(sr["recordId"]).trim() : "";
  return fromRef || String(row.identifier ?? "").trim();
};

export type TabLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; rows: ResourceRow[]; availableMetadataKeys: string[] }
  | { status: "error"; errorMessage: string };

export type TabState = {
  tabId: string;
  title: string;
  resourceRef: ResourceRef;
  loadState: TabLoadState;
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
};

export const tabRows = (tab: TabState | null | undefined): ResourceRow[] =>
  tab?.loadState.status === "loaded" ? tab.loadState.rows : [];

export const tabAvailableKeys = (tab: TabState | null | undefined): string[] =>
  tab?.loadState.status === "loaded" ? tab.loadState.availableMetadataKeys : [];

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

/**
 * Clamp width for the Game ID (`game`) column — intentionally narrow for icon cells.
 *
 * @param value Stored width from prefs or pixel delta during resize.
 */
export const clampGameIdColumnWidth = (value: unknown): number => {
  const n: number = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_GAME_ID_COL_WIDTH_PX;
  return Math.max(MIN_GAME_ID_COL_WIDTH_PX, Math.min(MAX_GAME_ID_COL_WIDTH_PX, Math.round(n)));
};

// ── Column-prefs localStorage helpers ────────────────────────────────────────

const columnPrefsStore = createVersionedStore<Record<string, TabPrefs>>({
  key: PREFS_STORAGE_KEY,
  version: 1,
  defaultValue: {},
  // v0 (raw legacy payload) → v1: pass through if it's a plain object, else reset.
  migrations: [(raw) => (raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {})],
});

export const readPrefsMap = (): Record<string, TabPrefs> => columnPrefsStore.read();

export const writePrefsMap = (map: Record<string, TabPrefs>): void => columnPrefsStore.write(map);

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
      globalThis.localStorage?.getItem(`${GROUP_BY_STORAGE_PREFIX}${tabId}`) ?? null;
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
    globalThis.localStorage?.setItem(
      `${GROUP_BY_STORAGE_PREFIX}${tabId}`,
      JSON.stringify(state),
    );
  } catch {
    // Storage unavailable.
  }
};

// ── Column-order reconciliation ───────────────────────────────────────────────

/**
 * Built-in PGN + X2 field definitions overlaid with the active schema; optional
 * resource-discovered header keys (tags seen in games but not in any schema) get
 * a high `orderIndex` so they sort after known tags.
 *
 * @param schema Currently selected metadata schema.
 * @param discoveredKeys Header keys reported by the resource loader for this tab (may include custom tags).
 */
const buildMergedFieldMap = (
  schema: MetadataSchema,
  discoveredKeys?: readonly string[],
): Map<string, MetadataFieldDefinition> => {
  const merged: Map<string, MetadataFieldDefinition> = new Map<string, MetadataFieldDefinition>();
  for (const f of BUILT_IN_SCHEMA.fields) {
    merged.set(f.key, f);
  }
  for (const f of schema.fields) {
    if (RESOURCE_VIEWER_OMIT_KEYS.has(f.key)) continue;
    merged.set(f.key, f);
  }
  for (const dk of discoveredKeys ?? []) {
    const key: string = String(dk || "").trim();
    if (!key || key === "game" || key === "source" || RESOURCE_VIEWER_OMIT_KEYS.has(key) || merged.has(key))
      continue;
    merged.set(key, {
      key,
      label: key,
      type: "text",
      required: false,
      orderIndex: 50_000,
    });
  }
  return merged;
};

/**
 * Resolve a column definition for sorting and labels: active schema overrides built-in;
 * unknown keys fall back to a text column at the end of canonical order.
 *
 * @param schema Active metadata schema.
 * @param key Header tag name.
 * @param discoveredKeys Optional keys observed on loaded records for this resource tab.
 * @returns Field definition used for table ordering and type-aware filters.
 */
export const resolveMergedFieldDefinition = (
  schema: MetadataSchema,
  key: string,
  discoveredKeys?: readonly string[],
): MetadataFieldDefinition => {
  const merged: Map<string, MetadataFieldDefinition> = buildMergedFieldMap(schema, discoveredKeys);
  const hit: MetadataFieldDefinition | undefined = merged.get(key);
  if (hit) return hit;
  return {
    key,
    label: key,
    type: "text",
    required: false,
    orderIndex: 50_000,
  };
};

/**
 * Every metadata column that can still be added to the table: full built-in catalog
 * merged with the active schema, plus tags discovered on rows but not yet listed.
 * Sorted **alphabetically by label** (then key).
 *
 * @param schema Active metadata schema.
 * @param metadataColumnOrder Current column keys (`game` when the Game ID column is visible).
 * @param discoveredKeys Keys reported for this tab’s games.
 */
export const listAddableMetadataFields = (
  schema: MetadataSchema,
  metadataColumnOrder: readonly string[],
  discoveredKeys?: readonly string[],
): MetadataFieldDefinition[] => {
  const merged: Map<string, MetadataFieldDefinition> = buildMergedFieldMap(schema, discoveredKeys);
  const shown: Set<string> = new Set(
    metadataColumnOrder.filter((k: string): boolean => k !== "game"),
  );
  const out: MetadataFieldDefinition[] = [...merged.values()].filter(
    (f: MetadataFieldDefinition): boolean =>
      !shown.has(f.key) && !RESOURCE_VIEWER_OMIT_KEYS.has(f.key),
  );
  out.sort((a: MetadataFieldDefinition, b: MetadataFieldDefinition): number => {
    const byLabel: number = a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    if (byLabel === 0) {
      return a.key.localeCompare(b.key);
    }
    return byLabel;
  });
  if (!metadataColumnOrder.includes("game")) {
    out.unshift({
      key: "game",
      label: "Game ID",
      type: "text",
      required: false,
      orderIndex: -1,
    });
  }
  return out;
};

/**
 * Insert a metadata column key using merged canonical + schema `orderIndex` relative to
 * keys already visible, without reshuffling unrelated columns.
 *
 * @param tab Current tab state.
 * @param fieldKey Header tag to add.
 * @param schema Active metadata schema.
 * @param discoveredKeys Optional keys from loaded rows (must match `listAddableMetadataFields` merge).
 * @returns Updated tab with the column appended or unchanged if already present or unknown key.
 */
export const insertMetadataColumnFromSchema = <T extends TabState>(
  tab: T,
  fieldKey: string,
  schema: MetadataSchema,
  discoveredKeys?: readonly string[],
): T => {
  if (fieldKey === "source") return tab;
  if (fieldKey === "game") {
    if (tab.metadataColumnOrder.includes("game")) return tab;
    return reconcileColumns({
      ...tab,
      metadataColumnOrder: ["game", ...tab.metadataColumnOrder],
    });
  }
  if (tab.visibleMetadataKeys.includes(fieldKey)) return tab;

  const merged: Map<string, MetadataFieldDefinition> = buildMergedFieldMap(schema, discoveredKeys);
  if (!merged.has(fieldKey)) return tab;

  const newIdx: number = merged.get(fieldKey)?.orderIndex ?? 50_000;
  const rank = (k: string): number => {
    const d: MetadataFieldDefinition | undefined = merged.get(k);
    if (d) return d.orderIndex;
    return resolveMergedFieldDefinition(schema, k, discoveredKeys).orderIndex;
  };

  const nextVisible: string[] = [...tab.visibleMetadataKeys];
  let insertPos: number = nextVisible.length;
  for (let i = 0; i < nextVisible.length; i++) {
    const keyAt: string | undefined = nextVisible[i];
    if (keyAt === undefined) continue;
    if (rank(keyAt) > newIdx) {
      insertPos = i;
      break;
    }
  }
  nextVisible.splice(insertPos, 0, fieldKey);

  const includeGame: boolean = tab.metadataColumnOrder.includes("game");
  const nextOrder: string[] = includeGame ? ["game", ...nextVisible] : [...nextVisible];
  return reconcileColumns({ ...tab, visibleMetadataKeys: nextVisible, metadataColumnOrder: nextOrder });
};

/**
 * Remove one column from prefs (including optional `game` / Game ID). Applies `reconcileColumns`.
 *
 * @param tab Current tab.
 * @param fieldKey Metadata / system column key to remove.
 * @returns Updated tab state.
 */
export const removeMetadataColumnFromTab = <T extends TabState>(
  tab: T,
  fieldKey: string,
): T => {
  const visible: string[] =
    fieldKey === "game"
      ? [...tab.visibleMetadataKeys]
      : tab.visibleMetadataKeys.filter((k: string): boolean => k !== fieldKey);
  const order: string[] = tab.metadataColumnOrder.filter((k: string): boolean => k !== fieldKey);
  const columnWidths: Record<string, number> = { ...tab.columnWidths };
  delete columnWidths[fieldKey];
  return reconcileColumns({
    ...tab,
    visibleMetadataKeys: visible,
    metadataColumnOrder: order,
    columnWidths,
  });
};

/**
 * Ensure `tab.visibleMetadataKeys`, `metadataColumnOrder`, and `columnWidths`
 * are internally consistent and clamped to valid ranges. When
 * `visibleMetadataKeys` is empty and the order is only `game`, no default
 * metadata columns are implied (user removed all).
 *
 * @param tab Source tab state.
 * @returns New tab state with reconciled column fields.
 */
export const reconcileColumns = <T extends TabState>(tab: T): T => {
  const nonGameCols: string[] = tab.metadataColumnOrder.filter((k: string): boolean => k !== "game");
  let rawVisible: string[] = [];
  if (tab.visibleMetadataKeys.length > 0) {
    rawVisible = [...tab.visibleMetadataKeys].filter((k: string): boolean => k !== "source");
  } else if (nonGameCols.length > 0) {
    rawVisible = [...DEFAULT_METADATA_KEYS];
  }
  const visible: string[] = rawVisible.filter((k: string): boolean => k !== "source");
  const includeGame: boolean = tab.metadataColumnOrder.includes("game");
  const allowed: string[] = includeGame ? ["game", ...visible] : [...visible];
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
    widths[k] =
      k === "game"
        ? clampGameIdColumnWidth(tab.columnWidths[k])
        : clampWidth(tab.columnWidths[k] ?? DEFAULT_COL_WIDTH_PX);
  });
  return { ...tab, visibleMetadataKeys: visible, metadataColumnOrder: order, columnWidths: widths };
};
