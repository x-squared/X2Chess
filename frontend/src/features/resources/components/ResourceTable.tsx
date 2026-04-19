/**
 * ResourceTable — game table with resizable, pointer-draggable columns,
 * per-column filter row, multi-level group-by accordion (UV3), column
 * sort (UV4), and kind badge (UV7).
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
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ChangeEvent,
} from "react";
import { clampWidth } from "../services/viewer_utils";
import type {
  TabState,
  ResourceRow,
  GroupByState,
  SortConfig,
} from "../services/viewer_utils";
import type { MetadataSchema, MetadataFieldDefinition } from "../../../../../parts/resource/src/domain/metadata_schema";
import type { TrainingBadge } from "../../../training/transcript_storage";
import { UI_IDS } from "../../../core/model/ui_ids";

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
  onMoveUp: (row: ResourceRow, neighborRow: ResourceRow) => void;
  onMoveDown: (row: ResourceRow, neighborRow: ResourceRow) => void;
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
): TableItem[] => {
  if (fields.length === 0 || depth >= fields.length) {
    return rows.map((r): TableItem => ({ kind: "row", row: r.row, originalIndex: r.originalIndex }));
  }

  const field = fields[depth];
  // Collect unique values in order of first appearance.
  const seen = new Map<string, { row: ResourceRow; originalIndex: number }[]>();
  for (const r of rows) {
    const val = field === "game" ? r.row.game : String(r.row.metadata[field] ?? "—");
    if (!seen.has(val)) seen.set(val, []);
    seen.get(val)!.push(r);
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
      items.push(...computeGroupItems(groupRows, fields, depth + 1, collapsedSet));
    }
  }
  return items;
};

// ── Kind badge (UV7) ──────────────────────────────────────────────────────────

const KindBadge = ({
  kind,
  t,
}: {
  kind: "game" | "position";
  t: (key: string, fallback?: string) => string;
}): ReactElement => (
  <span
    className={`resource-kind-badge resource-kind-badge--${kind}`}
    data-ui-id={
      kind === "position"
        ? UI_IDS.RESOURCES_TABLE_KIND_BADGE_POSITION
        : UI_IDS.RESOURCES_TABLE_KIND_BADGE_GAME
    }
    title={
      kind === "position"
        ? t("resources.kind.position", "Position")
        : t("resources.kind.game", "Game")
    }
    aria-label={
      kind === "position"
        ? t("resources.kind.position", "Position")
        : t("resources.kind.game", "Game")
    }
  >
    {kind === "position" ? "⊞" : "♟"}
  </span>
);

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

/**
 * Apply a type-aware filter to a raw cell value.
 * - number columns: supports `>N`, `<N`, `=N` prefix operators.
 * - select columns: exact match (case-insensitive) or empty = show all.
 * - date / text: substring match (case-insensitive).
 */
const applyFilter = (
  raw: string,
  filterVal: string,
  fieldDef?: MetadataFieldDefinition,
): boolean => {
  if (!filterVal) return true;
  const type = fieldDef?.type ?? "text";

  if (type === "number") {
    const trimmed = filterVal.trim();
    const op = trimmed[0];
    if (op === ">" || op === "<" || op === "=") {
      const threshold = parseFloat(trimmed.slice(1).trim());
      const cellNum = parseFloat(raw);
      if (!isFinite(threshold) || !isFinite(cellNum)) return false;
      if (op === ">") return cellNum > threshold;
      if (op === "<") return cellNum < threshold;
      return cellNum === threshold;
    }
    // No operator: substring match on the numeric string.
  }

  if (type === "select") {
    return filterVal === "" || raw.toLowerCase() === filterVal.toLowerCase();
  }

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
}: ResourceTableProps): ReactElement => {
  const allRows = activeTab?.rows ?? [];

  // Build field-definition lookup for type-aware filtering (UV2).
  const fieldDefMap = new Map<string, MetadataFieldDefinition>(
    (activeSchema?.fields ?? []).map((f) => [f.key, f]),
  );
  const hasActiveFilter = Object.values(columnFilters).some((v) => v !== "");

  // 1. Filter (UV2: type-aware operators)
  const filteredRows = allRows.filter((row: ResourceRow): boolean =>
    Object.entries(columnFilters).every(([key, val]: [string, string]): boolean => {
      if (!val) return true;
      const text = key === "game" ? row.game : String(row.metadata[key] ?? "");
      return applyFilter(text, val, fieldDefMap.get(key));
    }),
  );

  // 2. Sort (UV4)
  const sortedRows: ResourceRow[] = sortConfig
    ? [...filteredRows].sort((a: ResourceRow, b: ResourceRow): number => {
        const valA = sortConfig.key === "game" ? a.game : String(a.metadata[sortConfig.key] ?? "");
        const valB = sortConfig.key === "game" ? b.game : String(b.metadata[sortConfig.key] ?? "");
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
      ? computeGroupItems(indexedRows, groupByState.fields, 0, collapsedSet)
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
      ) : activeTab.errorMessage ? (
        <p className="resource-viewer-error" data-ui-id={UI_IDS.RESOURCES_TABLE_ERROR}>
          {activeTab.errorMessage}
        </p>
      ) : activeTab.isLoading ? (
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
                      <span className="resource-group-label">{item.label}</span>
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
                  {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                    <td key={key}>
                      {key === "game" ? (
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
                                  const neighbor = visibleRows[visibleIdx - 1];
                                  if (neighbor) onMoveUp(row, neighbor);
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
                          <KindBadge kind={row.kind} t={t} />
                          {trainingBadges && (() => {
                            const ref = rowSourceGameRef(row);
                            const badge = ref ? trainingBadges.get(ref) : undefined;
                            return badge ? <TrainingBadgeChip badge={badge} /> : null;
                          })()}
                          <button type="button" className="resource-open-button">
                            {row.game}
                          </button>
                        </span>
                      ) : (
                        String(row.metadata[key] ?? "-")
                      )}
                    </td>
                  ))}
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
