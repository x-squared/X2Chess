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
 * Optional `game` (record id) column — narrow icon button (hover = id + GRP, click = copy);
 * removable like other columns. Column order is user-controlled (prefs), not schema order.
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
import {
  buildRecordIdToRowMap,
  clampGameIdColumnWidth,
  clampWidth,
  rowPrimaryRecordId,
  tabRows,
} from "../services/viewer_utils";
import { resolveResourceTableColumnLabel } from "../resource_column_labels";
import type {
  TabState,
  ResourceRow,
  GroupByState,
  SortConfig,
} from "../services/viewer_utils";
import type {
  MetadataSchema,
  MetadataFieldDefinition,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import {
  buildRenderedGameMap,
  type RenderedGameDisplay,
} from "../services/game_rendering";
import { applyFilter } from "../services/resource_table_filters";
import { ReferenceCell } from "./ReferenceCell";
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
  /** Header key under the cursor while dragging (drop target). */
  colDropTargetKey: string;
  supportsReorder: boolean;
  t: (key: string, fallback?: string) => string;
  onRowOpen: (rowIndex: number) => void;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  onMoveUp: (row: ResourceRow, afterRow: ResourceRow | null) => void;
  onMoveDown: (row: ResourceRow, afterRow: ResourceRow) => void;
  onResizeStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  /** Pointer-based column drag start; drop is handled globally on pointerup (UV1). */
  onColDragStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  onSortChange: (key: string) => void;
  onToggleGroup: (groupKey: string) => void;
  /** Remove a column from the table (including optional Game ID / `game`). */
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
    const val =
      field === "game"
        ? rowPrimaryRecordId(r.row) || r.row.game
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

type GameIdCopyCellProps = {
  idLabel: string;
  hoverDetail: string;
  t: (key: string, fallback?: string) => string;
};

/**
 * Icon-only game id control: title shows id and optional GRP summary; click copies id (stops row open).
 */
const GameIdCopyCell = ({ idLabel, hoverDetail, t }: GameIdCopyCellProps): ReactElement => {
  const [copied, setCopied] = useState<boolean>(false);

  useEffect((): (() => void) | void => {
    if (!copied) return;
    const timerId: number = window.setTimeout((): void => {
      setCopied(false);
    }, 1600);
    return (): void => {
      window.clearTimeout(timerId);
    };
  }, [copied]);

  const detailBlock: string = [idLabel, hoverDetail].filter(Boolean).join("\n\n");
  const title: string = copied
    ? t("resources.table.gameIdCopied", "Copied to clipboard")
    : `${detailBlock}\n\n${t("resources.table.copyGameIdHint", "Click to copy ID")}`;

  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    if (!idLabel) return;
    void (async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(idLabel);
        setCopied(true);
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        log.error("ResourceTable", "Game ID clipboard write failed", { message });
      }
    })();
  };

  const ariaCopy: string = t("resources.table.copyGameIdAria", "Copy game ID to clipboard");

  return (
    <button
      type="button"
      className="resource-game-id-btn"
      title={title}
      aria-label={`${ariaCopy}: ${idLabel || "—"}`}
      data-ui-id={UI_IDS.RESOURCES_TABLE_GAME_ID_BTN}
      onClick={handleClick}
    >
      <img
        src="/icons/toolbar/game-id.svg"
        width={16}
        height={16}
        alt=""
        aria-hidden
        className="resource-game-id-btn__icon"
      />
    </button>
  );
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

// ── Component ─────────────────────────────────────────────────────────────────

/** Game table with resizable, reorderable columns, filter row, sort, group-by, and kind badge. */
export const ResourceTable = ({
  activeTab,
  columnFilters,
  groupByState,
  sortConfig,
  activeSchema,
  colDragActiveKey,
  colDropTargetKey,
  supportsReorder,
  t,
  onRowOpen,
  onFilterChange,
  onClearFilters,
  onMoveUp,
  onMoveDown,
  onResizeStart,
  onColDragStart,
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
  const tableHasGameCol: boolean = Boolean(activeTab?.metadataColumnOrder.includes("game"));

  // Build field-definition lookup for type-aware filtering (UV2).
  const fieldDefMap = new Map<string, MetadataFieldDefinition>(
    (activeSchema?.fields ?? []).map((f) => [f.key, f]),
  );
  const hasActiveFilter = Object.values(columnFilters).some((v) => v !== "");

  // Pre-compute GRP display lines (compact + detail merge — see `buildRenderedGameMap`).
  // Used for filter text, group headers, tooltips on the Game ID cell, and reference cells.
  const renderedGameMap = useMemo((): Map<ResourceRow, RenderedGameDisplay> | null => {
    const profile = activeSchema?.rendering;
    if (!profile) return null;
    return buildRenderedGameMap(allRows, profile, activeSchema?.fields);
  }, [allRows, activeSchema?.rendering, activeSchema?.fields]);

  // 1. Filter (UV2: type-aware operators)
  const filteredRows = allRows.filter((row: ResourceRow): boolean =>
    Object.entries(columnFilters).every(([key, val]: [string, string]): boolean => {
      if (!val) return true;
      const text =
        key === "game"
          ? [
              rowPrimaryRecordId(row),
              renderedGameMap?.get(row)?.filterText ?? "",
              row.game,
            ]
              .filter(Boolean)
              .join(" ")
          : String(row.metadata[key] ?? "");
      return applyFilter(text, val, fieldDefMap.get(key), resolvedRefMeta);
    }),
  );

  // 2. Sort (UV4)
  const sortedRows: ResourceRow[] = sortConfig
    ? [...filteredRows].sort((a: ResourceRow, b: ResourceRow): number => {
        const valA =
          sortConfig.key === "game"
            ? rowPrimaryRecordId(a)
            : String(a.metadata[sortConfig.key] ?? "");
        const valB =
          sortConfig.key === "game"
            ? rowPrimaryRecordId(b)
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
            {activeTab.metadataColumnOrder.map((key: string): ReactElement => {
              const w: number =
                key === "game"
                  ? clampGameIdColumnWidth(activeTab.columnWidths[key])
                  : clampWidth(activeTab.columnWidths[key]);
              return (
                <col
                  key={key}
                  data-resource-col-key={key}
                  style={{ width: `${w}px` }}
                />
              );
            })}
          </colgroup>
          <thead data-ui-id={UI_IDS.RESOURCES_TABLE_HEAD}>
            <tr>
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => {
                const isSortedAsc = sortConfig?.key === key && sortConfig.dir === "asc";
                const isSortedDesc = sortConfig?.key === key && sortConfig.dir === "desc";
                const isDragActive: boolean = colDragActiveKey === key;
                const isDropTarget: boolean =
                  Boolean(colDropTargetKey) && colDropTargetKey === key && colDropTargetKey !== colDragActiveKey;
                const colClass: string = [
                  isDragActive ? "resource-col-th--drag-source" : "",
                  isDropTarget ? "resource-col-th--drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th
                    key={key}
                    className={colClass || undefined}
                    data-resource-col-key={key}
                    data-col-drag-active={isDragActive ? "true" : undefined}
                    data-col-drop-target={isDropTarget ? "true" : undefined}
                  >
                    <div className="resource-col-header-inner">
                      {/* Drag handle — pointer-based (UV1); global pointerup commits drop */}
                      <span
                        className="resource-col-drag-handle"
                        aria-hidden="true"
                        title={t("resources.table.dragColumn", "Drag to reorder column")}
                        onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>): void => {
                          e.stopPropagation();
                          onColDragStart(key, e);
                        }}
                      >⠿</span>
                      {/* Sortable label (UV4) */}
                      <button
                        type="button"
                        className={`resource-col-sort-btn${key === "game" ? " resource-col-sort-btn--game-id" : ""}`}
                        onClick={(): void => { onSortChange(key); }}
                        aria-label={`Sort by ${resolveResourceTableColumnLabel(key, t)}`}
                      >
                        {key === "game" ? (
                          <>
                            <img
                              src="/icons/toolbar/game-id.svg"
                              width={16}
                              height={16}
                              alt=""
                              aria-hidden
                              className="resource-col-sort-icon"
                            />
                            <span className="resource-sr-only">{resolveResourceTableColumnLabel(key, t)}</span>
                          </>
                        ) : (
                          resolveResourceTableColumnLabel(key, t)
                        )}
                        {isSortedAsc && <span className="resource-sort-indicator" aria-hidden="true">↑</span>}
                        {isSortedDesc && <span className="resource-sort-indicator" aria-hidden="true">↓</span>}
                      </button>
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
                    <th key={key} className={cellClass} data-resource-col-key={key}>
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
                  <th key={key} className={cellClass} data-resource-col-key={key}>
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
                  {activeTab.metadataColumnOrder.map((key: string, colIdx: number): ReactElement => {
                    const isFirstCol: boolean = colIdx === 0;
                    const showReorderInCell: boolean =
                      supportsReorder && (key === "game" || (!tableHasGameCol && isFirstCol));
                    const showTrainingInCell: boolean = key === "game" || (!tableHasGameCol && isFirstCol);
                    const reorderBtns: ReactElement | null = showReorderInCell ? (
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
                    ) : null;
                    const trainingChip: ReactElement | null =
                      showTrainingInCell && trainingBadges
                        ? ((): ReactElement | null => {
                            const ref: string = rowSourceGameRef(row);
                            const badge = ref ? trainingBadges.get(ref) : undefined;
                            return badge ? <TrainingBadgeChip badge={badge} /> : null;
                          })()
                        : null;

                    let cellContent: ReactElement | string;
                    if (key === "game") {
                      const idLabel: string = rowPrimaryRecordId(row) || row.identifier;
                      const rendered: RenderedGameDisplay | null | undefined = renderedGameMap?.get(row);
                      const hoverDetail: string =
                        rendered?.line1 || rendered?.line2
                          ? [rendered.line1, rendered.line2].filter(Boolean).join("\n")
                          : row.game;
                      cellContent = (
                        <span className="resource-game-cell">
                          {reorderBtns}
                          {trainingChip}
                          <GameIdCopyCell idLabel={idLabel} hoverDetail={hoverDetail} t={t} />
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
                    if (!tableHasGameCol && isFirstCol && (reorderBtns || trainingChip)) {
                      cellContent = (
                        <span className="resource-meta-cell-with-lead">
                          {reorderBtns}
                          {trainingChip}
                          {cellContent}
                        </span>
                      );
                    }
                    return (
                      <td key={key} data-resource-col-key={key}>
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
