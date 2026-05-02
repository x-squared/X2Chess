/**
 * MetadataPanel — inline schema management panel for the right-panel Metadata tab.
 *
 * Replaces the MetadataSchemaManager dialog in the context of a dedicated tab,
 * showing the schema list inline and opening the MetadataSchemaEditor dialog when
 * a schema is created or edited.
 *
 * Integration API:
 * - `<MetadataPanel t={...} />` — rendered by RightPanelStack in the Metadata tab.
 *
 * Communication API:
 * - Loads / saves schemas to localStorage via `schema_storage`.
 * - Dispatches `x2chess:schemas-updated` after every write so ResourceViewer
 *   refreshes its schema chooser without a page reload.
 */

import { useState, useCallback, type ReactElement } from "react";
import {
  loadSchemas,
  saveSchemas,
  upsertSchema,
  notifySchemasUpdated,
} from "../services/schema_storage";
import { MetadataSchemaEditor } from "./MetadataSchemaEditor";
import { UI_IDS } from "../../../core/model/ui_ids";
import type { MetadataSchema } from "../../../../../parts/resource/src/domain/metadata_schema";

type MetadataPanelProps = {
  t: (key: string, fallback?: string) => string;
};

export const MetadataPanel = ({ t }: MetadataPanelProps): ReactElement => {
  const [schemas, setSchemas] = useState<MetadataSchema[]>(() => loadSchemas());
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editingSchema, setEditingSchema] = useState<MetadataSchema | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleNew = useCallback((): void => {
    setEditingSchema(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((schema: MetadataSchema): void => {
    setEditingSchema(schema);
    setEditorOpen(true);
  }, []);

  const handleDelete = useCallback((id: string): void => {
    setSchemas((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSchemas(next);
      return next;
    });
    setConfirmingId(null);
    notifySchemasUpdated();
  }, []);

  const handleSave = useCallback((saved: MetadataSchema): void => {
    setSchemas((prev) => {
      const next = upsertSchema(prev, saved);
      saveSchemas(next);
      return next;
    });
    setEditorOpen(false);
    setEditingSchema(null);
    notifySchemasUpdated();
  }, []);

  const handleEditorClose = useCallback((): void => {
    setEditorOpen(false);
    setEditingSchema(null);
  }, []);

  return (
    <div className="metadata-panel" data-ui-id={UI_IDS.METADATA_PANEL}>
      <p className="metadata-panel-title">
        {t("metadata.panel.title", "Metadata Schemas")}
      </p>
      <p className="metadata-panel-description">
        {t("metadata.panel.description", "Schemas define custom fields that can be attached to games in a resource. Each resource uses one schema.")}
      </p>

      {schemas.length === 0 ? (
        <p className="metadata-panel-empty">
          {t("schema.manager.noSchemas", "No custom schemas yet.")}
        </p>
      ) : (
        <ul className="schema-manager-list">
          {schemas.map((s) => (
            <li key={s.id} className="schema-manager-row">
              <span className="schema-manager-name">{s.name}</span>
              <span className="schema-manager-field-count">
                {t("metadata.panel.fieldCount", `${s.fields.length} field${s.fields.length === 1 ? "" : "s"}`)}
              </span>
              {confirmingId === s.id ? (
                <div className="schema-manager-actions">
                  <span className="schema-manager-confirm-label">
                    {t("schema.manager.deleteConfirmInline", "Delete?")}
                  </span>
                  <button
                    type="button"
                    className="x2-dialog-btn x2-dialog-btn--danger schema-btn schema-btn--secondary schema-btn--danger"
                    onClick={(): void => { handleDelete(s.id); }}
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
                    onClick={(): void => { handleEdit(s); }}
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

      <div className="metadata-panel-footer">
        <button
          type="button"
          className="x2-dialog-btn x2-dialog-btn--primary schema-btn schema-btn--primary"
          onClick={handleNew}
        >
          {t("schema.manager.newSchema", "New Schema…")}
        </button>
      </div>

      {editorOpen && (
        <MetadataSchemaEditor
          schema={editingSchema}
          t={t}
          onSave={handleSave}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
};
