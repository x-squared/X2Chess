/**
 * ResourceTable — game table with resizable, pointer-draggable columns,
 * per-column filter row, multi-level group-by accordion (UV3), and column
 * sort (UV4).
 *
 * Column header drag uses pointer events (not HTML5 DnD) to avoid
 * activating the browser's native file-drop machinery (UV1).
 *
 * Inspection: table regions use `data-ui-id` from `UI_IDS` in `core/model/ui_ids.ts`; each
 * data row repeats the same `data-ui-id` for the table row part with a unique
 * `data-resource-row-index` for the row’s source index.
 *
 * Metadata columns (not `game`) show a remove control (×) in the header to drop the column.
 */

import {
  useState,
  useEffect,
  useMemo,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ChangeEvent,
} from "react";
import { buildRecordIdToRowMap, clampWidth, tabRows } from "../services/viewer_utils";
import type {
  TabState,
  ResourceRow,
  GroupByState,
  SortConfig,
} from "../services/viewer_utils";
import type {
  MetadataSchema,
  MetadataFieldDefinition,
  GameRenderingProfile,
  GameRenderingDisplay,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import {
  buildRenderedGameMap,
  resolveDisplayForReferenceChip,
  renderDisplayText,
  type ReferenceChipDisplaySource,
  type RenderedGameDisplay,
} from "../services/game_rendering";
import type { TrainingBadge } from "../../../training/transcript_storage";
import { UI_IDS } from "../../../core/model/ui_ids";
import { openExternalUrl } from "../../../resources/open_url";
import { log } from "../../../logger";

// ── Props ─────────────────────────────────────────────────────────────────────

type ResourceTableProps = {
  activeTab: TabState | null;
  columnFilters: Record<string, string>;
  groupByState: GroupByState;
  sortConfig: SortConfig | null;
  /** Active metadata schema for type-aware column filters (UV2). */
  activeSchema: MetadataSchema | null;
  /** Key of the column currently being pointer-dragged (for visual feedback). */
  colDragActiveKey: string;
  supportsReorder: boolean;
  t: (key: string, fallback?: string) => string;
  onRowOpen: (rowIndex: number) => void;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  onMoveUp: (row: ResourceRow, afterRow: ResourceRow | null) => void;
  onMoveDown: (row: ResourceRow, afterRow: ResourceRow) => void;
  onResizeStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  /** Pointer-based column drag start (UV1 — replaces HTML5 DnD). */
  onColDragStart: (key: string) => void;
  /** Pointer-based column drop on a target column (UV1). */
  onColDrop: (targetKey: string) => void;
  onSortChange: (key: string) => void;
  onToggleGroup: (groupKey: string) => void;
  /** Remove a metadata column (not `game`) from the table. */
  onRemoveMetadataColumn: (key: string) => void;
  /** Training badges keyed by `"kind:locator:recordId"` composite ref (T14). */
  trainingBadges?: Map<string, TrainingBadge>;
  /** Async function resolving a game's metadata by recordId — used to populate reference-field chips. */
  onFetchMetadata?: (recordId: string) => Promise<Record<string, string> | null>;
  /** Called when the user clicks a reference chip in a table cell to open the referenced game. */
  onOpenReference?: (recordId: string) => void;
  /** Pre-resolved reference metadata cache; populated by ResourceViewer on tab load. Used for filtering. */
  resolvedRefMeta?: Map<string, Record<string, string>>;
};

// ── Internal types ────────────────────────────────────────────────────────────

type TableItem =
  | {
      kind: "groupHeader";
      groupKey: string;
      label: string;
      depth: number;
      collapsed: boolean;
      rowCount: number;
    }
  | { kind: "row"; row: ResourceRow; originalIndex: number };

// ── Reference cell ────────────────────────────────────────────────────────────

const ReferenceCell = ({
  recordId,
  /** Same `ResourceRow` object as in this tab when the reference points at a loaded game — chips match the Game column. */
  syncedRow,
  syncedRendered,
  onFetchMetadata,
  onOpen,
  renderingProfile,
  schemaFieldsForGrp,
}: {
  recordId: string;
  syncedRow: ResourceRow | null;
  syncedRendered: RenderedGameDisplay | null;
  onFetchMetadata: (id: string) => Promise<Record<string, string> | null>;
  onOpen?: (id: string) => void;
  renderingProfile?: GameRenderingProfile;
  /** Active schema fields — enables select `when` matching (case-insensitive Type, etc.). */
  schemaFieldsForGrp?: readonly MetadataFieldDefinition[];
}): ReactElement => {
  const [meta, setMeta] = useState<Record<string, string> | null>(null);

  const useTableSync: boolean = syncedRow !== null;

  useEffect((): (() => void) | void => {
    if (!recordId || useTableSync) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const result = await onFetchMetadata(recordId);
      if (!cancelled) setMeta(result);
    })();
    return (): void => {
      cancelled = true;
    };
  }, [recordId, useTableSync, onFetchMetadata]);

  const metaForDisplay: Record<string, string> | null =
    syncedRow !== null ? syncedRow.metadata : meta;

  const white = String(metaForDisplay?.White ?? "").trim();
  const black = String(metaForDisplay?.Black ?? "").trim();
  const result = String(metaForDisplay?.Result ?? "").trim();
  const date = String(metaForDisplay?.Date ?? "").trim();
  const event = String(metaForDisplay?.Event ?? "").trim();

  const chipResolution: {
    display: GameRenderingDisplay | null;
    source: ReferenceChipDisplaySource;
  } =
    metaForDisplay && renderingProfile
      ? resolveDisplayForReferenceChip(metaForDisplay, renderingProfile, schemaFieldsForGrp)
      : { display: null, source: "none" };
  const rendered =
    !useTableSync && chipResolution.display
      ? renderDisplayText(chipResolution.display, metaForDisplay!)
      : null;

  const playersLabel = white && black ? `${white} — ${black}` : white || black || recordId;
  const metaInline = [result, event, date].filter(Boolean).join(" · ");
  const tooltip = [
    white && `White: ${white}`,
    black && `Black: ${black}`,
    result && `Result: ${result}`,
    event && `Event: ${event}`,
    date && `Date: ${date}`,
  ].filter(Boolean).join("\n") || recordId;

  const primaryFromGrp = rendered?.line1 || playersLabel;
  const secondaryFromGrp = rendered?.line2 ?? metaInline;

  const primaryText: string =
    useTableSync && syncedRow
      ? (syncedRendered?.line1 ?? syncedRow.game)
      : primaryFromGrp;
  const secondaryText: string =
    useTableSync && syncedRow ? (syncedRendered?.line2 ?? "") : secondaryFromGrp;

  const unresolvedClass = metaForDisplay ? "" : "metadata-field-reference-game-chip--unresolved";
  const noOpenClass = onOpen ? "" : "metadata-field-reference-game-chip--no-open";

  if (
    metaForDisplay &&
    renderingProfile &&
    !useTableSync &&
    !rendered &&
    primaryFromGrp === recordId
  ) {
    log.warn("ResourceTable", "ReferenceCell falls back to raw record id — check GRP rules / metadata fetch", {
      recordId,
      grpSlot: chipResolution.source,
      hasWhiteBlack: Boolean(white || black),
    });
  }

  return (
    <button
      type="button"
      className={["metadata-field-reference-game-chip", unresolvedClass, noOpenClass].filter(Boolean).join(" ")}
      data-grp-reference-slot={chipResolution.source}
      title={tooltip}
      onClick={onOpen ? (e): void => { e.stopPropagation(); onOpen(recordId); } : undefined}
    >
      <span className="metadata-field-reference-game-primary">{primaryText}</span>
      {secondaryText && (
        <span className="metadata-field-reference-game-secondary"> · {secondaryText}</span>
      )}
    </button>
  );
};

// ── Column-label helper ───────────────────────────────────────────────────────

const resolveColLabel = (
  key: string,
  t: (key: string, fallback?: string) => string,
): string => {
  if (key === "identifier") return t("resources.table.identifier", "Identifier");
  if (key === "source") return t("resources.table.source", "Source");
  if (key === "revision") return t("resources.table.revision", "Revision");
  return key;
};

// ── Group-by computation ──────────────────────────────────────────────────────

/**
 * Recursively compute the flat list of items to render for a given set of rows
 * grouped by `fields[depth]`. Each level prefixes its group key with `depth:`
 * to avoid conflicts across levels.
 */
const computeGroupItems = (
  rows: { row: ResourceRow; originalIndex: number }[],
  fields: string[],
  depth: number,
  collapsedSet: Set<string>,
  renderedGameMap?: Map<ResourceRow, RenderedGameDisplay> | null,
): TableItem[] => {
  if (fields.length === 0 || depth >= fields.length) {
    return rows.map((r): TableItem => ({ kind: "row", row: r.row, originalIndex: r.originalIndex }));
  }

  const field = fields[depth];
  // Collect unique values in order of first appearance.
  const seen = new Map<string, { row: ResourceRow; originalIndex: number }[]>();
  for (const r of rows) {
    const val = field === "game"
      ? (renderedGameMap?.get(r.row)?.line1 ?? r.row.game)
      : String(r.row.metadata[field] ?? "—");
    let group = seen.get(val);
    if (!group) { group = []; seen.set(val, group); }
    group.push(r);
  }

  const items: TableItem[] = [];
  for (const [val, groupRows] of seen) {
    const groupKey = `${depth}:${val}`;
    const isCollapsed = collapsedSet.has(groupKey);
    items.push({
      kind: "groupHeader",
      groupKey,
      label: val,
      depth,
      collapsed: isCollapsed,
      rowCount: groupRows.length,
    });
    if (!isCollapsed) {
      items.push(...computeGroupItems(groupRows, fields, depth + 1, collapsedSet, renderedGameMap));
    }
  }
  return items;
};

// ── Training badge chip (T14) ─────────────────────────────────────────────────

/** Extract the composite `"kind:locator:recordId"` ref from a row's sourceRef. */
const rowSourceGameRef = (row: ResourceRow): string => {
  const r = row.sourceRef;
  if (!r) return "";
  const kind = typeof r["kind"] === "string" ? r["kind"] : "";
  const locator = typeof r["locator"] === "string" ? r["locator"] : "";
  const recordId = typeof r["recordId"] === "string" ? r["recordId"] : "";
  return `${kind}:${locator}:${recordId}`;
};

const TrainingBadgeChip = ({ badge }: { badge: TrainingBadge }): ReactElement => (
  <span
    className="training-badge"
    data-ui-id={UI_IDS.RESOURCES_TABLE_TRAINING_BADGE}
    title={`${badge.sessionCount} session${badge.sessionCount === 1 ? "" : "s"}, best ${badge.bestScore}%`}
  >
    <span className="training-badge__score">{badge.bestScore}%</span>
    <span className="training-badge__count">×{badge.sessionCount}</span>
  </span>
);

// ── Type-aware filter helpers (UV2) ───────────────────────────────────────────

const applyNumberFilter = (raw: string, filterVal: string): boolean => {
  const trimmed = filterVal.trim();
  const op = trimmed[0];
  if (op === ">" || op === "<" || op === "=") {
    const threshold = Number.parseFloat(trimmed.slice(1).trim());
    const cellNum = Number.parseFloat(raw);
    if (!Number.isFinite(threshold) || !Number.isFinite(cellNum)) return false;
    if (op === ">") return cellNum > threshold;
    if (op === "<") return cellNum < threshold;
    return cellNum === threshold;
  }
  return raw.toLowerCase().includes(filterVal.toLowerCase());
};

const applyReferenceFilter = (
  recordId: string,
  filterVal: string,
  resolvedRefMeta?: Map<string, Record<string, string>>,
): boolean => {
  const meta = resolvedRefMeta?.get(recordId);
  // Currently: substring on concatenated game fields from resolved metadata.
  // Future: use renderDisplayFilterText with a profile-aware display when
  // the rendering profile is threaded into this call site.
  const searchText = meta
    ? [meta["White"], meta["Black"], meta["Result"], meta["Event"], meta["Date"]]
        .filter(Boolean).join(" ")
    : recordId;
  return searchText.toLowerCase().includes(filterVal.toLowerCase());
};

/**
 * Apply a type-aware filter to a raw cell value.
 * - number: supports `>N`, `<N`, `=N` prefix operators.
 * - select: exact match (case-insensitive) or empty = show all.
 * - reference: substring on concatenated game fields from resolvedRefMeta;
 *   falls back to the raw recordId when not yet resolved.
 * - date / text: substring match (case-insensitive).
 */
const applyFilter = (
  raw: string,
  filterVal: string,
  fieldDef?: MetadataFieldDefinition,
  resolvedRefMeta?: Map<string, Record<string, string>>,
): boolean => {
  if (!filterVal) return true;
  const type = fieldDef?.type ?? "text";
  if (type === "number") return applyNumberFilter(raw, filterVal);
  if (type === "select") return raw.toLowerCase() === filterVal.toLowerCase();
  if (type === "reference") return applyReferenceFilter(raw, filterVal, resolvedRefMeta);
  return raw.toLowerCase().includes(filterVal.toLowerCase());
};

// ── Component ─────────────────────────────────────────────────────────────────

/** Game table with resizable, reorderable columns, filter row, sort, group-by, and kind badge. */
export const ResourceTable = ({
  activeTab,
  columnFilters,
  groupByState,
  sortConfig,
  activeSchema,
  colDragActiveKey,
  supportsReorder,
  t,
  onRowOpen,
  onFilterChange,
  onClearFilters,
  onMoveUp,
  onMoveDown,
  onResizeStart,
  onColDragStart,
  onColDrop,
  onSortChange,
  onToggleGroup,
  onRemoveMetadataColumn,
  trainingBadges,
  onFetchMetadata,
  onOpenReference,
  resolvedRefMeta,
}: ResourceTableProps): ReactElement => {
  const allRows = tabRows(activeTab);
  const recordIdToRow = useMemo((): Map<string, ResourceRow> => buildRecordIdToRowMap(allRows), [allRows]);

  // Build field-definition lookup for type-aware filtering (UV2).
  const fieldDefMap = new Map<string, MetadataFieldDefinition>(
    (activeSchema?.fields ?? []).map((f) => [f.key, f]),
  );
  const hasActiveFilter = Object.values(columnFilters).some((v) => v !== "");

  // Pre-compute rendered display strings for all rows (display1 slot).
  // Used for filter, sort, group-by labels, and cell display.
  const renderedGameMap = useMemo((): Map<ResourceRow, RenderedGameDisplay> | null => {
    const profile = activeSchema?.rendering;
    if (!profile) return null;
    return buildRenderedGameMap(allRows, profile, "display1", activeSchema?.fields);
  }, [allRows, activeSchema?.rendering, activeSchema?.fields]);

  // 1. Filter (UV2: type-aware operators)
  const filteredRows = allRows.filter((row: ResourceRow): boolean =>
    Object.entries(columnFilters).every(([key, val]: [string, string]): boolean => {
      if (!val) return true;
      const text = key === "game"
        ? (renderedGameMap?.get(row)?.filterText ?? row.game)
        : String(row.metadata[key] ?? "");
      return applyFilter(text, val, fieldDefMap.get(key), resolvedRefMeta);
    }),
  );

  // 2. Sort (UV4)
  const sortedRows: ResourceRow[] = sortConfig
    ? [...filteredRows].sort((a: ResourceRow, b: ResourceRow): number => {
        const valA = sortConfig.key === "game"
          ? (renderedGameMap?.get(a)?.line1 ?? a.game)
          : String(a.metadata[sortConfig.key] ?? "");
        const valB = sortConfig.key === "game"
          ? (renderedGameMap?.get(b)?.line1 ?? b.game)
          : String(b.metadata[sortConfig.key] ?? "");
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return sortConfig.dir === "asc" ? cmp : -cmp;
      })
    : filteredRows;

  // 3. Group-by (UV3) — build flat render list
  const collapsedSet = new Set(groupByState.collapsedKeys);
  const indexedRows = sortedRows.map((row) => ({
    row,
    originalIndex: allRows.indexOf(row),
  }));

  const tableItems: TableItem[] =
    groupByState.fields.length > 0
      ? computeGroupItems(indexedRows, groupByState.fields, 0, collapsedSet, renderedGameMap)
      : indexedRows.map((r): TableItem => ({ kind: "row", row: r.row, originalIndex: r.originalIndex }));

  // Flat list of visible rows (for ▲▼ reorder buttons)
  const visibleRows: ResourceRow[] = tableItems
    .filter((item): item is Extract<TableItem, { kind: "row" }> => item.kind === "row")
    .map((item) => item.row);

  return (
    <div className="resource-table-wrap" data-ui-id={UI_IDS.RESOURCES_TABLE}>
      {!activeTab ? (
        <p className="resource-viewer-empty" data-ui-id={UI_IDS.RESOURCES_TABLE_EMPTY}>
          {t("resources.noTabs", "No resource tab is open.")}
        </p>
      ) : activeTab.loadState.status === "error" ? (
        <p className="resource-viewer-error" data-ui-id={UI_IDS.RESOURCES_TABLE_ERROR}>
          {activeTab.loadState.errorMessage}
        </p>
      ) : activeTab.loadState.status === "loading" ? (
        <p className="resource-viewer-empty" data-ui-id={UI_IDS.RESOURCES_TABLE_LOADING}>
          {t("resources.loading", "Loading resource games...")}
        </p>
      ) : allRows.length === 0 ? (
        <p className="resource-viewer-empty" data-ui-id={UI_IDS.RESOURCES_TABLE_EMPTY}>
          {t("resources.empty", "No games found in this resource.")}
        </p>
      ) : (
        <div className="resource-table-scroll" data-ui-id={UI_IDS.RESOURCES_TABLE_SCROLL}>
          <table className="resource-games-table" data-ui-id={UI_IDS.RESOURCES_TABLE_GRID}>
          <colgroup data-ui-id={UI_IDS.RESOURCES_TABLE_COLGROUP}>
            {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
              <col
                key={key}
                data-resource-col-key={key}
                style={{ width: `${clampWidth(activeTab.columnWidths[key])}px` }}
              />
            ))}
          </colgroup>
          <thead data-ui-id={UI_IDS.RESOURCES_TABLE_HEAD}>
            <tr>
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => {
                const isSortedAsc = sortConfig?.key === key && sortConfig.dir === "asc";
                const isSortedDesc = sortConfig?.key === key && sortConfig.dir === "desc";
                const isDragActive = colDragActiveKey === key;
                return (
                  <th
                    key={key}
                    data-resource-col-key={key}
                    data-col-drag-active={isDragActive ? "true" : undefined}
                    onPointerUp={(): void => {
                      if (colDragActiveKey && colDragActiveKey !== key) {
                        onColDrop(key);
                      }
                    }}
                  >
                    <div className="resource-col-header-inner">
                      {/* Drag handle — pointer-based (UV1) */}
                      <span
                        className="resource-col-drag-handle"
                        aria-hidden="true"
                        title={t("resources.table.dragColumn", "Drag to reorder column")}
                        onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>): void => {
                          e.stopPropagation();
                          onColDragStart(key);
                        }}
                      >⠿</span>
                      {/* Sortable label (UV4) */}
                      <button
                        type="button"
                        className="resource-col-sort-btn"
                        onClick={(): void => { onSortChange(key); }}
                        aria-label={`Sort by ${resolveColLabel(key, t)}`}
                      >
                        {key === "game"
                          ? t("resources.table.game", "Game")
                          : resolveColLabel(key, t)}
                        {isSortedAsc && <span className="resource-sort-indicator" aria-hidden="true">↑</span>}
                        {isSortedDesc && <span className="resource-sort-indicator" aria-hidden="true">↓</span>}
                      </button>
                      {key !== "game" && (
                        <button
                          type="button"
                          className="resource-col-remove-btn"
                          data-ui-id={`${UI_IDS.RESOURCES_TABLE_HEAD}.remove.${key}`}
                          aria-label={t("resources.table.removeColumn", "Remove column")}
                          title={t("resources.table.removeColumn", "Remove column")}
                          onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>): void => {
                            e.stopPropagation();
                          }}
                          onClick={(e: ReactMouseEvent<HTMLButtonElement>): void => {
                            e.stopPropagation();
                            onRemoveMetadataColumn(key);
                          }}
                        >
                          ×
                        </button>
                      )}
                      <span
                        className="resource-col-resize-handle"
                        aria-hidden="true"
                        onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>): void => {
                          onResizeStart(key, e);
                        }}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr className="resource-filter-row" data-ui-id={UI_IDS.RESOURCES_TABLE_FILTER_ROW}>
              {activeTab.metadataColumnOrder.map((key: string, idx: number): ReactElement => {
                const fieldDef = fieldDefMap.get(key);
                const filterVal = columnFilters[key] ?? "";
                const isActive = Boolean(filterVal);
                const isLastColumn = idx === activeTab.metadataColumnOrder.length - 1;
                const hasInlineClear = hasActiveFilter && isLastColumn;
                const cellClass = `resource-filter-cell${isActive ? " resource-filter-cell--active" : ""}${
                  hasInlineClear ? " resource-filter-cell--clear" : ""
                }`;

                // Select columns get a dropdown of allowed values (UV2).
                if (fieldDef?.type === "select" && fieldDef.selectValues?.length) {
                  return (
                    <th key={key} className={cellClass}>
                      <div className="resource-filter-cell-inner">
                        <select
                          className={`resource-filter-select${isActive ? " resource-filter-input--active" : ""}`}
                          aria-label={`Filter ${key}`}
                          value={filterVal}
                          onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                            onFilterChange(key, e.target.value);
                          }}
                        >
                          <option value="">—</option>
                          {fieldDef.selectValues.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        {hasInlineClear && (
                          <button
                            type="button"
                            className="resource-filter-clear-btn"
                            title={t("resources.table.clearFilters", "Clear all filters")}
                            onClick={onClearFilters}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </th>
                  );
                }

                // Number columns show a placeholder hint for operators (UV2).
                const placeholder =
                  fieldDef?.type === "number"
                    ? ">2000"
                    : fieldDef?.type === "date"
                      ? "2024"
                      : "";

                return (
                  <th key={key} className={cellClass}>
                    <div className="resource-filter-cell-inner">
                      <input
                        type="text"
                        className={`resource-filter-input${isActive ? " resource-filter-input--active" : ""}`}
                        aria-label={`Filter ${key}`}
                        placeholder={placeholder}
                        value={filterVal}
                        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                          onFilterChange(key, e.target.value);
                        }}
                      />
                      {hasInlineClear && (
                        <button
                          type="button"
                          className="resource-filter-clear-btn"
                          title={t("resources.table.clearFilters", "Clear all filters")}
                          onClick={onClearFilters}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody data-ui-id={UI_IDS.RESOURCES_TABLE_BODY}>
            {tableItems.map((item: TableItem, i: number): ReactElement => {
              if (item.kind === "groupHeader") {
                return (
                  <tr
                    key={`group-${item.groupKey}`}
                    className={`resource-group-header resource-group-header--depth${item.depth}`}
                    data-ui-id={UI_IDS.RESOURCES_TABLE_GROUP_ROW}
                    data-resource-group-key={item.groupKey}
                    onClick={(): void => { onToggleGroup(item.groupKey); }}
                  >
                    <td
                      colSpan={activeTab.metadataColumnOrder.length}
                      className="resource-group-header-cell"
                    >
                      <span className="resource-group-toggle" aria-hidden="true">
                        {item.collapsed ? "▶" : "▼"}
                      </span>
                      {(() => {
                        const groupField = groupByState.fields[item.depth];
                        if (
                          groupField &&
                          fieldDefMap.get(groupField)?.type === "reference" &&
                          item.label !== "—" &&
                          onFetchMetadata
                        ) {
                          const rid: string = item.label;
                          const syncRow: ResourceRow | null = recordIdToRow.get(rid) ?? null;
                          const syncRendered: RenderedGameDisplay | null =
                            syncRow && renderedGameMap ? renderedGameMap.get(syncRow) ?? null : null;
                          return (
                            <ReferenceCell
                              recordId={rid}
                              syncedRow={syncRow}
                              syncedRendered={syncRendered}
                              onFetchMetadata={onFetchMetadata}
                              onOpen={onOpenReference}
                              renderingProfile={activeSchema?.rendering}
                              schemaFieldsForGrp={activeSchema?.fields}
                            />
                          );
                        }
                        return <span className="resource-group-label">{item.label}</span>;
                      })()}
                      <span className="resource-group-count">({item.rowCount})</span>
                    </td>
                  </tr>
                );
              }

              // Regular row
              const row = item.row;
              const visibleIdx = visibleRows.indexOf(row);
              return (
                <tr
                  key={i}
                  className="resource-game-row"
                  data-ui-id={UI_IDS.RESOURCES_TABLE_ROW}
                  data-resource-row-index={String(item.originalIndex)}
                  onClick={(): void => { onRowOpen(item.originalIndex); }}
                  onDoubleClick={(): void => { onRowOpen(item.originalIndex); }}
                  onKeyDown={(e): void => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowOpen(item.originalIndex);
                    }
                  }}
                >
                  {activeTab.metadataColumnOrder.map((key: string): ReactElement => {
                    let cellContent: ReactElement | string;
                    if (key === "game") {
                      cellContent = (
                        <span className="resource-game-cell">
                          {supportsReorder && (
                            <span className="resource-row-order-btns">
                              <button
                                type="button"
                                className="resource-order-btn"
                                aria-label={t("resources.table.moveUp", "Move up")}
                                disabled={visibleIdx === 0}
                                onClick={(e): void => {
                                  e.stopPropagation();
                                  const afterRow = visibleRows[visibleIdx - 2] ?? null;
                                  onMoveUp(row, afterRow);
                                }}
                              >▲</button>
                              <button
                                type="button"
                                className="resource-order-btn"
                                aria-label={t("resources.table.moveDown", "Move down")}
                                disabled={visibleIdx === visibleRows.length - 1}
                                onClick={(e): void => {
                                  e.stopPropagation();
                                  const neighbor = visibleRows[visibleIdx + 1];
                                  if (neighbor) onMoveDown(row, neighbor);
                                }}
                              >▼</button>
                            </span>
                          )}
                          {trainingBadges && (() => {
                            const ref = rowSourceGameRef(row);
                            const badge = ref ? trainingBadges.get(ref) : undefined;
                            return badge ? <TrainingBadgeChip badge={badge} /> : null;
                          })()}
                          <button type="button" className="resource-open-button">
                            {(() => {
                              const rendered = renderedGameMap?.get(row);
                              if (!rendered) return row.game;
                              return (
                                <span className="resource-game-rendered">
                                  <span className="resource-game-line1">{rendered.line1}</span>
                                  {rendered.line2 && <span className="resource-game-line2">{rendered.line2}</span>}
                                </span>
                              );
                            })()}
                          </button>
                        </span>
                      );
                    } else if (fieldDefMap.get(key)?.type === "reference" && row.metadata[key] && onFetchMetadata) {
                      const refRecordId = String(row.metadata[key]);
                      const syncRow: ResourceRow | null = recordIdToRow.get(refRecordId) ?? null;
                      const syncRendered: RenderedGameDisplay | null =
                        syncRow && renderedGameMap ? renderedGameMap.get(syncRow) ?? null : null;
                      cellContent = (
                        <ReferenceCell
                          recordId={refRecordId}
                          syncedRow={syncRow}
                          syncedRendered={syncRendered}
                          onFetchMetadata={onFetchMetadata}
                          onOpen={onOpenReference}
                          renderingProfile={activeSchema?.rendering}
                          schemaFieldsForGrp={activeSchema?.fields}
                        />
                      );
                    } else if (fieldDefMap.get(key)?.type === "link" && row.metadata[key]) {
                      const url = String(row.metadata[key]);
                      cellContent = (
                        <button
                          type="button"
                          className="resource-table-link"
                          title={url}
                          onClick={(e: ReactMouseEvent): void => {
                            e.stopPropagation();
                            void openExternalUrl(url);
                          }}
                        >↗ {url}</button>
                      );
                    } else {
                      cellContent = String(row.metadata[key] ?? "-");
                    }
                    return (
                      <td key={key}>
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
};
