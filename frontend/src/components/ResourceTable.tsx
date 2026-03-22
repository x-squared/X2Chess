/**
 * ResourceTable — game table with resizable, pointer-draggable columns,
 * per-column filter row, multi-level group-by accordion (UV3), column
 * sort (UV4), and kind badge (UV7).
 *
 * Column header drag uses pointer events (not HTML5 DnD) to avoid
 * activating the browser's native file-drop machinery (UV1).
 */

import {
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  type ChangeEvent,
} from "react";
import { clampWidth } from "../resources_viewer/viewer_utils";
import type {
  TabState,
  ResourceRow,
  GroupByState,
  SortConfig,
} from "../resources_viewer/viewer_utils";

// ── Props ─────────────────────────────────────────────────────────────────────

type ResourceTableProps = {
  activeTab: TabState | null;
  columnFilters: Record<string, string>;
  groupByState: GroupByState;
  sortConfig: SortConfig | null;
  /** Key of the column currently being pointer-dragged (for visual feedback). */
  colDragActiveKey: string;
  supportsReorder: boolean;
  t: (key: string, fallback?: string) => string;
  onRowOpen: (rowIndex: number) => void;
  onFilterChange: (key: string, value: string) => void;
  onMoveUp: (row: ResourceRow, neighborRow: ResourceRow) => void;
  onMoveDown: (row: ResourceRow, neighborRow: ResourceRow) => void;
  onResizeStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  /** Pointer-based column drag start (UV1 — replaces HTML5 DnD). */
  onColDragStart: (key: string) => void;
  /** Pointer-based column drop on a target column (UV1). */
  onColDrop: (targetKey: string) => void;
  onSortChange: (key: string) => void;
  onToggleGroup: (groupKey: string) => void;
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

// ── Component ─────────────────────────────────────────────────────────────────

/** Game table with resizable, reorderable columns, filter row, sort, group-by, and kind badge. */
export const ResourceTable = ({
  activeTab,
  columnFilters,
  groupByState,
  sortConfig,
  colDragActiveKey,
  supportsReorder,
  t,
  onRowOpen,
  onFilterChange,
  onMoveUp,
  onMoveDown,
  onResizeStart,
  onColDragStart,
  onColDrop,
  onSortChange,
  onToggleGroup,
}: ResourceTableProps): ReactElement => {
  const allRows = activeTab?.rows ?? [];

  // 1. Filter
  const filteredRows = allRows.filter((row: ResourceRow): boolean =>
    Object.entries(columnFilters).every(([key, val]: [string, string]): boolean => {
      if (!val) return true;
      const text = key === "game" ? row.game : String(row.metadata[key] ?? "");
      return text.toLowerCase().includes(val.toLowerCase());
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
    <div className="resource-table-wrap">
      {!activeTab ? (
        <p className="resource-viewer-empty">
          {t("resources.noTabs", "No resource tab is open.")}
        </p>
      ) : activeTab.errorMessage ? (
        <p className="resource-viewer-error">{activeTab.errorMessage}</p>
      ) : activeTab.isLoading ? (
        <p className="resource-viewer-empty">
          {t("resources.loading", "Loading resource games...")}
        </p>
      ) : allRows.length === 0 ? (
        <p className="resource-viewer-empty">
          {t("resources.empty", "No games found in this resource.")}
        </p>
      ) : (
        <table className="resource-games-table">
          <colgroup>
            {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
              <col
                key={key}
                data-resource-col-key={key}
                style={{ width: `${clampWidth(activeTab.columnWidths[key])}px` }}
              />
            ))}
          </colgroup>
          <thead>
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
                    <span
                      className="resource-col-resize-handle"
                      aria-hidden="true"
                      onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>): void => {
                        onResizeStart(key, e);
                      }}
                    />
                  </th>
                );
              })}
            </tr>
            <tr className="resource-filter-row">
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                <th key={key} className="resource-filter-cell">
                  <input
                    type="text"
                    className={`resource-filter-input${columnFilters[key] ? " resource-filter-input--active" : ""}`}
                    aria-label={`Filter ${key}`}
                    value={columnFilters[key] ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      onFilterChange(key, e.target.value);
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableItems.map((item: TableItem, i: number): ReactElement => {
              if (item.kind === "groupHeader") {
                return (
                  <tr
                    key={`group-${item.groupKey}`}
                    className={`resource-group-header resource-group-header--depth${item.depth}`}
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
      )}
    </div>
  );
};
