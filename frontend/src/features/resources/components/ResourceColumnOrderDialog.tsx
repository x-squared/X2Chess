/**
 * ResourceColumnOrderDialog — modal to reorder resource table columns without drag-and-drop.
 *
 * Integration API:
 * - `<ResourceColumnOrderDialog isOpen={…} columnKeys={…} getColumnLabel={…} onApply={…} onClose={…} t={…} />`
 *   — controlled by `isOpen`; `columnKeys` mirrors `TabState.metadataColumnOrder`.
 *
 * Configuration API:
 * - `getColumnLabel` — same labelling as the table header (`resolveResourceTableColumnLabel` + schema field labels optional).
 *
 * Communication API:
 * - Outbound: `onApply(newOrder)` then caller persists; `onClose()` dismisses without applying pending edits if user cancels.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from "react";
import { UI_IDS } from "../../../core/model/ui_ids";

export type ResourceColumnOrderDialogProps = {
  isOpen: boolean;
  /** Current column keys (left-to-right). */
  columnKeys: readonly string[];
  /** Label shown for each key (header text). */
  getColumnLabel: (key: string) => string;
  t: (key: string, fallback?: string) => string;
  onApply: (newOrder: string[]) => void;
  onClose: () => void;
};

export const ResourceColumnOrderDialog = ({
  isOpen,
  columnKeys,
  getColumnLabel,
  t,
  onApply,
  onClose,
}: ResourceColumnOrderDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [workingOrder, setWorkingOrder] = useState<string[]>([]);

  useEffect((): void => {
    const el: HTMLDialogElement | null = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      setWorkingOrder([...columnKeys]);
      el.showModal();
    } else {
      el.close();
    }
  }, [isOpen, columnKeys]);

  const move = (index: number, delta: number): void => {
    const next: number = index + delta;
    if (next < 0 || next >= workingOrder.length) return;
    setWorkingOrder((prev: string[]): string[] => {
      const copy: string[] = [...prev];
      const tmp: string | undefined = copy[index];
      const swap: string | undefined = copy[next];
      if (tmp === undefined || swap === undefined) return prev;
      copy[index] = swap;
      copy[next] = tmp;
      return copy;
    });
  };

  const handleCancel = (): void => {
    onClose();
  };

  const handleApply = (): void => {
    onApply(workingOrder);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="resource-column-order-dialog"
      data-ui-id={UI_IDS.RESOURCE_COLUMN_ORDER_DIALOG}
      onCancel={(e: SyntheticEvent<HTMLDialogElement>): void => {
        e.preventDefault();
        handleCancel();
      }}
    >
      <div className="resource-column-order-dialog__panel">
        <h2 className="resource-column-order-dialog__title">
          {t("resources.table.columnOrderTitle", "Column order")}
        </h2>
        <p className="resource-column-order-dialog__hint">
          {t(
            "resources.table.columnOrderHint",
            "Move columns up or down. You can also drag columns by the handle (⠿) in the table header.",
          )}
        </p>
        <ul className="resource-column-order-dialog__list">
          {workingOrder.map((key: string, index: number): ReactElement => {
            const label: string = getColumnLabel(key);
            return (
              <li key={key} className="resource-column-order-dialog__row">
                <span className="resource-column-order-dialog__label" title={key}>
                  {label}
                </span>
                <span className="resource-column-order-dialog__actions">
                  <button
                    type="button"
                    className="resource-column-order-dialog__btn"
                    disabled={index === 0}
                    aria-label={t("resources.table.columnOrderMoveUp", "Move this column up")}
                    onClick={(): void => { move(index, -1); }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="resource-column-order-dialog__btn"
                    disabled={index >= workingOrder.length - 1}
                    aria-label={t("resources.table.columnOrderMoveDown", "Move this column down")}
                    onClick={(): void => { move(index, 1); }}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="resource-column-order-dialog__footer">
          <button
            type="button"
            className="resource-column-order-dialog__cancel"
            onClick={handleCancel}
          >
            {t("resources.table.columnOrderCancel", "Cancel")}
          </button>
          <button
            type="button"
            className="resource-column-order-dialog__apply"
            onClick={handleApply}
          >
            {t("resources.table.columnOrderApply", "Apply")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
