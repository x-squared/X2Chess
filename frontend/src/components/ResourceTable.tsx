import type { ReactElement, DragEvent, PointerEvent as ReactPointerEvent, ChangeEvent } from "react";
import { clampWidth } from "../resources_viewer/viewer_utils";
import type { TabState, ResourceRow } from "../resources_viewer/viewer_utils";

// ── Props ─────────────────────────────────────────────────────────────────────

type ResourceTableProps = {
  activeTab: TabState | null;
  columnFilters: Record<string, string>;
  supportsReorder: boolean;
  t: (key: string, fallback?: string) => string;
  onRowOpen: (rowIndex: number) => void;
  onFilterChange: (key: string, value: string) => void;
  onMoveUp: (row: ResourceRow, neighborRow: ResourceRow) => void;
  onMoveDown: (row: ResourceRow, neighborRow: ResourceRow) => void;
  onResizeStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  onDragStart: (key: string, e: DragEvent<HTMLTableCellElement>) => void;
  onDragOver: (e: DragEvent<HTMLTableCellElement>) => void;
  onDrop: (targetKey: string, e: DragEvent<HTMLTableCellElement>) => void;
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

// ── Component ─────────────────────────────────────────────────────────────────

/** Game table with resizable, reorderable columns and a per-column filter row. */
export const ResourceTable = ({
  activeTab,
  columnFilters,
  supportsReorder,
  t,
  onRowOpen,
  onFilterChange,
  onMoveUp,
  onMoveDown,
  onResizeStart,
  onDragStart,
  onDragOver,
  onDrop,
}: ResourceTableProps): ReactElement => {
  const allRows = activeTab?.rows ?? [];
  const filteredRows = allRows.filter((row: ResourceRow): boolean =>
    Object.entries(columnFilters).every(([key, val]: [string, string]): boolean => {
      if (!val) return true;
      const text = key === "game" ? row.game : String(row.metadata[key] ?? "");
      return text.toLowerCase().includes(val.toLowerCase());
    }),
  );

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
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                <th
                  key={key}
                  draggable
                  data-resource-col-key={key}
                  onDragStart={(e: DragEvent<HTMLTableCellElement>): void => {
                    onDragStart(key, e);
                  }}
                  onDragOver={onDragOver}
                  onDrop={(e: DragEvent<HTMLTableCellElement>): void => {
                    onDrop(key, e);
                  }}
                >
                  <span>
                    {key === "game"
                      ? t("resources.table.game", "Game")
                      : resolveColLabel(key, t)}
                  </span>
                  <span
                    className="resource-col-resize-handle"
                    aria-hidden="true"
                    onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>): void => {
                      onResizeStart(key, e);
                    }}
                  />
                </th>
              ))}
            </tr>
            <tr className="resource-filter-row">
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                <th key={key} className="resource-filter-cell">
                  <input
                    type="text"
                    className="resource-filter-input"
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
            {filteredRows.map((row: ResourceRow, i: number): ReactElement => (
              <tr
                key={i}
                className="resource-game-row"
                onClick={(): void => { onRowOpen(allRows.indexOf(row)); }}
                onDoubleClick={(): void => { onRowOpen(allRows.indexOf(row)); }}
                onKeyDown={(e): void => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowOpen(allRows.indexOf(row));
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
                              disabled={i === 0}
                              onClick={(e): void => {
                                e.stopPropagation();
                                onMoveUp(row, filteredRows[i - 1]);
                              }}
                            >▲</button>
                            <button
                              type="button"
                              className="resource-order-btn"
                              aria-label={t("resources.table.moveDown", "Move down")}
                              disabled={i === filteredRows.length - 1}
                              onClick={(e): void => {
                                e.stopPropagation();
                                onMoveDown(row, filteredRows[i + 1]);
                              }}
                            >▼</button>
                          </span>
                        )}
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
