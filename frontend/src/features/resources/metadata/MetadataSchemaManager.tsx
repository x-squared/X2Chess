/**
 * MetadataSchemaManager — dialog for listing, editing, and deleting metadata schemas.
 *
 * Integration API:
 * - `<MetadataSchemaManager schemas={...} t={...} onEdit={...} onNew={...} onDelete={...} onClose={...} />`
 *
 * Communication API:
 * - `onEdit(schema)` — user clicked Edit on a schema; caller opens the editor for it.
 * - `onNew()` — user clicked New Schema; caller opens a blank editor.
 * - `onDelete(id)` — user confirmed deletion; caller removes the schema.
 * - `onClose()` — dialog dismissed without navigating to the editor.
 */

import { useState, useRef, useEffect, useCallback, type ReactElement } from "react";
import type { MetadataSchema } from "../../../../../parts/resource/src/domain/metadata_schema";

type MetadataSchemaManagerProps = {
  schemas: MetadataSchema[];
  t: (key: string, fallback?: string) => string;
  onEdit: (schema: MetadataSchema) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export const MetadataSchemaManager = ({
  schemas,
  t,
  onEdit,
  onNew,
  onDelete,
  onClose,
}: MetadataSchemaManagerProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect((): void => { dialogRef.current?.showModal(); }, []);

  const handleClose = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="x2-dialog schema-manager-dialog" onClose={onClose}>
      <div className="x2-dialog-body schema-manager-body">
        <p className="schema-manager-title">
          {t("schema.manager.title", "Manage Schemas")}
        </p>

        {schemas.length === 0 ? (
          <p className="schema-manager-empty">
            {t("schema.manager.noSchemas", "No custom schemas yet.")}
          </p>
        ) : (
          <ul className="schema-manager-list">
            {schemas.map((s) => (
              <li key={s.id} className="schema-manager-row">
                <span className="schema-manager-name">{s.name}</span>
                {confirmingId === s.id ? (
                  <div className="schema-manager-actions">
                    <span className="schema-manager-confirm-label">
                      {t("schema.manager.deleteConfirmInline", "Delete?")}
                    </span>
                    <button
                      type="button"
                      className="x2-dialog-btn x2-dialog-btn--danger schema-btn schema-btn--secondary schema-btn--danger"
                      onClick={(): void => { onDelete(s.id); setConfirmingId(null); }}
                    >
                      {t("schema.manager.deleteYes", "Yes, delete")}
                    </button>
                    <button
                      type="button"
                      className="x2-dialog-btn schema-btn schema-btn--secondary"
                      onClick={(): void => { setConfirmingId(null); }}
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="schema-manager-actions">
                    <button
                      type="button"
                      className="x2-dialog-btn schema-btn schema-btn--secondary"
                      onClick={(): void => { onEdit(s); }}
                    >
                      {t("schema.manager.edit", "Edit")}
                    </button>
                    <button
                      type="button"
                      className="x2-dialog-btn x2-dialog-btn--danger schema-btn schema-btn--secondary schema-btn--danger"
                      onClick={(): void => { setConfirmingId(s.id); }}
                    >
                      {t("schema.manager.delete", "Delete")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="schema-manager-footer">
          <button type="button" className="x2-dialog-btn x2-dialog-btn--primary schema-btn schema-btn--primary" onClick={onNew}>
            {t("schema.manager.newSchema", "New Schema…")}
          </button>
          <button type="button" className="x2-dialog-btn schema-btn schema-btn--secondary" onClick={handleClose}>
            {t("common.close", "Close")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
