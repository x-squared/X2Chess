/**
 * VariationSortDialog — modal editor for reordering sibling PGN variations.
 *
 * Integration API:
 * - `<VariationSortDialog variations={...} activeVariationId={...}
 *    onMoveUp={...} onMoveDown={...} onClose={...} t={...} />`
 * - Rendered by `PgnTextEditor` when a variation sort action is opened.
 *
 * Configuration API:
 * - `variations` controls render order (top entry appears first in context menus).
 *
 * Communication API:
 * - Outbound: `onMoveUp(variationId)`, `onMoveDown(variationId)`, `onClose()`.
 * - Inbound: re-renders when variation order or active variation changes.
 */

import { useEffect, useRef, type ReactElement } from "react";

export type VariationSortItem = {
  id: string;
  label: string;
};

type VariationSortDialogProps = {
  variations: readonly VariationSortItem[];
  activeVariationId: string;
  onMoveUp: (variationId: string) => void;
  onMoveDown: (variationId: string) => void;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
};

export const VariationSortDialog = ({
  variations,
  activeVariationId,
  onMoveUp,
  onMoveDown,
  onClose,
  t,
}: VariationSortDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="variation-sort-dialog"
      onClose={onClose}
    >
      <div className="variation-sort-dialog-inner">
        <p className="variation-sort-dialog-title">
          {t("editor.trunc.sortDialogTitle", "Sort sibling variations")}
        </p>
        <p className="variation-sort-dialog-desc">
          {t("editor.trunc.sortDialogDesc", "Use the arrows to reorder variation pills in tree mode.")}
        </p>

        <div className="variation-sort-dialog-list">
          {variations.map((variation, index): ReactElement => {
            const isActive: boolean = variation.id === activeVariationId;
            const isFirst: boolean = index === 0;
            const isLast: boolean = index === variations.length - 1;
            return (
              <div
                key={variation.id}
                className={`variation-sort-dialog-row${isActive ? " is-active" : ""}`}
              >
                <div className="variation-sort-dialog-row-label">
                  {variation.label}
                </div>
                <div className="variation-sort-dialog-row-actions">
                  <button
                    type="button"
                    className="variation-sort-dialog-btn"
                    disabled={isFirst}
                    onClick={(): void => { onMoveUp(variation.id); }}
                  >
                    {t("editor.trunc.moveVarUp", "Move variation up")}
                  </button>
                  <button
                    type="button"
                    className="variation-sort-dialog-btn"
                    disabled={isLast}
                    onClick={(): void => { onMoveDown(variation.id); }}
                  >
                    {t("editor.trunc.moveVarDown", "Move variation down")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="variation-sort-dialog-actions">
          <button
            type="button"
            className="variation-sort-dialog-btn-close"
            onClick={(): void => {
              dialogRef.current?.close();
              onClose();
            }}
          >
            {t("editor.anchor.close", "Close")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
