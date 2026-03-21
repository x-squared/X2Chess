import type { ReactElement, DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { clampWidth } from "../resources_viewer/viewer_utils";
import type { TabState } from "../resources_viewer/viewer_utils";

// ── Props ─────────────────────────────────────────────────────────────────────

type ResourceTableProps = {
  activeTab: TabState | null;
  t: (key: string, fallback?: string) => string;
  onRowOpen: (rowIndex: number) => void;
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

/** Game table with resizable, reorderable columns. */
export const ResourceTable = ({
  activeTab,
  t,
  onRowOpen,
  onResizeStart,
  onDragStart,
  onDragOver,
  onDrop,
}: ResourceTableProps): ReactElement => (
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
    ) : activeTab.rows.length === 0 ? (
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
        </thead>
        <tbody>
          {activeTab.rows.map((row, i: number): ReactElement => (
            <tr
              key={i}
              className="resource-game-row"
              onClick={(): void => { onRowOpen(i); }}
              onDoubleClick={(): void => { onRowOpen(i); }}
              onKeyDown={(e): void => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowOpen(i);
                }
              }}
            >
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                <td key={key}>
                  {key === "game" ? (
                    <button type="button" className="resource-open-button">
                      {row.game}
                    </button>
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
