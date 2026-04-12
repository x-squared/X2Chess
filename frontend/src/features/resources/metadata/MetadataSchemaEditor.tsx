/**
 * MetadataSchemaEditor — dialog for creating and editing metadata schemas.
 *
 * Integration API:
 * - `<MetadataSchemaEditor schema={...} onSave={...} onClose={...} />` — modal
 *   dialog for editing a `MetadataSchema`.  Pass `null` for `schema` to create
 *   a new one.
 *
 * Configuration API:
 * - No global configuration; all state is local to the component.
 *
 * Communication API:
 * - `onSave(schema)` — called with the saved schema (new or updated).
 * - `onClose()` — called when the dialog is dismissed without saving.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";
import type {
  MetadataSchema,
  MetadataFieldDefinition,
  MetadataFieldType,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import {
  moveField,
  renumberFields,
  exportSchemaToJson,
  validateSchemaJson,
} from "../services/schema_storage";

// ── Helpers ────────────────────────────────────────────────────────────────────

const generateId = (): string =>
  `schema-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const FIELD_TYPES: MetadataFieldType[] = ["text", "date", "select", "number", "flag"];

const emptyField = (orderIndex: number): MetadataFieldDefinition => ({
  key: "",
  label: "",
  type: "text",
  required: false,
  orderIndex,
  selectValues: [],
  description: "",
});

// ── FieldRow ──────────────────────────────────────────────────────────────────

type FieldRowProps = {
  field: MetadataFieldDefinition;
  index: number;
  total: number;
  isEditing: boolean;
  t: (key: string, fallback?: string) => string;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onSaveField: (index: number, updated: MetadataFieldDefinition) => void;
  onCancelEdit: () => void;
};

const FieldRow = ({
  field,
  index,
  total,
  isEditing,
  t,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onSaveField,
  onCancelEdit,
}: FieldRowProps): ReactElement => {
  const [draft, setDraft] = useState<MetadataFieldDefinition>(field);
  const [selectInput, setSelectInput] = useState<string>("");

  useEffect((): void => { setDraft(field); }, [field]);

  if (isEditing) {
    return (
      <div className="schema-field-edit">
        <div className="schema-field-edit-row">
          <label className="schema-field-edit-label">
            <span>{t("schema.field.key", "Key:")}</span>
            <input
              className="schema-field-edit-input"
              value={draft.key}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setDraft((d) => ({ ...d, key: e.target.value }));
              }}
            />
          </label>
          <label className="schema-field-edit-label">
            <span>{t("schema.field.label", "Label:")}</span>
            <input
              className="schema-field-edit-input"
              value={draft.label}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setDraft((d) => ({ ...d, label: e.target.value }));
              }}
            />
          </label>
          <label className="schema-field-edit-label schema-field-edit-label--inline">
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setDraft((d) => ({ ...d, required: e.target.checked }));
              }}
            />
            {t("schema.field.required", "Required")}
          </label>
        </div>
        <div className="schema-field-edit-row">
          <label className="schema-field-edit-label">
            <span>{t("schema.field.type", "Type:")}</span>
            <select
              className="schema-field-edit-select"
              value={draft.type}
              onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                setDraft((d) => ({ ...d, type: e.target.value as MetadataFieldType }));
              }}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </label>
        </div>
        {draft.type === "select" && (
          <div className="schema-field-edit-row">
            <label className="schema-field-edit-label schema-field-edit-label--full">
              <span>{t("schema.field.values", "Values:")}</span>
              <div className="schema-select-values">
                {(draft.selectValues ?? []).map((v, vi) => (
                  <span key={vi} className="schema-select-pill">
                    {v}
                    <button
                      type="button"
                      className="schema-select-pill-remove"
                      onClick={(): void => {
                        setDraft((d) => ({
                          ...d,
                          selectValues: (d.selectValues ?? []).filter((_, i) => i !== vi),
                        }));
                      }}
                      aria-label={`Remove ${v}`}
                    >×</button>
                  </span>
                ))}
                <input
                  className="schema-select-values-input"
                  value={selectInput}
                  placeholder={t("schema.field.addValue", "Add value…")}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => { setSelectInput(e.target.value); }}
                  onKeyDown={(e): void => {
                    if ((e.key === "Enter" || e.key === ",") && selectInput.trim()) {
                      e.preventDefault();
                      const v = selectInput.trim();
                      setDraft((d) => ({ ...d, selectValues: [...(d.selectValues ?? []), v] }));
                      setSelectInput("");
                    }
                  }}
                />
              </div>
            </label>
          </div>
        )}
        <div className="schema-field-edit-row">
          <label className="schema-field-edit-label schema-field-edit-label--full">
            <span>{t("schema.field.description", "Description (optional):")}</span>
            <input
              className="schema-field-edit-input"
              value={draft.description ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                setDraft((d) => ({ ...d, description: e.target.value }));
              }}
            />
          </label>
        </div>
        <div className="schema-field-edit-actions">
          <button type="button" className="schema-btn schema-btn--secondary" onClick={onCancelEdit}>
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="schema-btn schema-btn--primary"
            disabled={!draft.key.trim()}
            onClick={(): void => { onSaveField(index, draft); }}
          >
            {t("schema.field.save", "Save field")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="schema-field-row">
      <span className="schema-field-handle" aria-hidden="true">≡</span>
      <span className="schema-field-key">{field.key}</span>
      <span className="schema-field-type">{field.type}</span>
      {field.required && <span className="schema-field-required">{t("schema.field.requiredBadge", "required")}</span>}
      <div className="schema-field-actions">
        <button type="button" className="schema-icon-btn" onClick={(): void => { onEdit(index); }} aria-label={t("schema.field.edit", "Edit field")}>✎</button>
        <button type="button" className="schema-icon-btn schema-icon-btn--danger" onClick={(): void => { onDelete(index); }} aria-label={t("schema.field.delete", "Delete field")}>×</button>
        <button type="button" className="schema-icon-btn" disabled={index === 0} onClick={(): void => { onMoveUp(index); }} aria-label={t("schema.field.moveUp", "Move up")}>↑</button>
        <button type="button" className="schema-icon-btn" disabled={index === total - 1} onClick={(): void => { onMoveDown(index); }} aria-label={t("schema.field.moveDown", "Move down")}>↓</button>
      </div>
    </div>
  );
};

// ── MetadataSchemaEditor ───────────────────────────────────────────────────────

type MetadataSchemaEditorProps = {
  /** Schema to edit, or `null` to create a new one. */
  schema: MetadataSchema | null;
  t: (key: string, fallback?: string) => string;
  onSave: (schema: MetadataSchema) => void;
  onClose: () => void;
};

export const MetadataSchemaEditor = ({
  schema,
  t,
  onSave,
  onClose,
}: MetadataSchemaEditorProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState<string>(schema?.name ?? "");
  const [fields, setFields] = useState<MetadataFieldDefinition[]>(
    schema?.fields ? [...schema.fields] : [],
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect((): void => { dialogRef.current?.showModal(); }, []);

  const handleSave = useCallback((): void => {
    if (!name.trim()) return;
    const saved: MetadataSchema = {
      id: schema?.id ?? generateId(),
      name: name.trim(),
      version: (schema?.version ?? 0) + 1,
      fields: renumberFields(fields),
    };
    onSave(saved);
    dialogRef.current?.close();
  }, [name, fields, schema, onSave]);

  const handleClose = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const handleAddField = useCallback((): void => {
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.orderIndex), 0);
    const newField = emptyField(maxOrder + 10);
    setFields((prev) => [...prev, newField]);
    setEditingIndex(fields.length);
  }, [fields]);

  const handleDeleteField = useCallback((index: number): void => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  }, []);

  const handleSaveField = useCallback((index: number, updated: MetadataFieldDefinition): void => {
    setFields((prev) => prev.map((f, i) => (i === index ? updated : f)));
    setEditingIndex(null);
  }, []);

  const handleMoveUp = useCallback((index: number): void => {
    setFields((prev) => moveField(prev, index, index - 1));
  }, []);

  const handleMoveDown = useCallback((index: number): void => {
    setFields((prev) => moveField(prev, index, index + 1));
  }, []);

  const handleExport = useCallback((): void => {
    if (!schema) return;
    const json = exportSchemaToJson(schema);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.name.replace(/[^a-z0-9]/gi, "_")}_schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [schema]);

  const handleImportClick = useCallback((): void => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (): void => {
      try {
        const imported = validateSchemaJson(reader.result as string);
        setName(imported.name);
        setFields([...imported.fields]);
        setImportError(null);
      } catch (err) {
        setImportError(String(err instanceof Error ? err.message : err));
      }
    };
    reader.readAsText(file);
    // Reset so same file can be imported again.
    e.target.value = "";
  }, []);

  return (
    <dialog ref={dialogRef} className="schema-editor-dialog" onClose={onClose}>
      <div className="schema-editor-form">
        <p className="schema-editor-title">
          {schema
            ? t("schema.editor.editTitle", "Edit Schema")
            : t("schema.editor.newTitle", "New Metadata Schema")}
        </p>

        <label className="schema-editor-name-label">
          <span>{t("schema.editor.name", "Schema name:")}</span>
          <input
            className="schema-editor-name-input"
            value={name}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(e: ChangeEvent<HTMLInputElement>): void => { setName(e.target.value); }}
          />
        </label>

        <p className="schema-editor-fields-heading">{t("schema.editor.fields", "Fields:")}</p>

        <div className="schema-field-list">
          {fields.map((f, i) => (
            <FieldRow
              key={`${f.key}_${i}`}
              field={f}
              index={i}
              total={fields.length}
              isEditing={editingIndex === i}
              t={t}
              onEdit={setEditingIndex}
              onDelete={handleDeleteField}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onSaveField={handleSaveField}
              onCancelEdit={(): void => { setEditingIndex(null); }}
            />
          ))}
        </div>

        <div className="schema-editor-add-row">
          <button type="button" className="schema-btn schema-btn--secondary" onClick={handleAddField}>
            {t("schema.editor.addField", "+ Add Field")}
          </button>
        </div>

        {importError && (
          <p className="schema-editor-import-error">{importError}</p>
        )}

        <div className="schema-editor-footer">
          <div className="schema-editor-footer-left">
            {schema && (
              <button type="button" className="schema-btn schema-btn--ghost" onClick={handleExport}>
                {t("schema.editor.export", "Export…")}
              </button>
            )}
            <button type="button" className="schema-btn schema-btn--ghost" onClick={handleImportClick}>
              {t("schema.editor.import", "Import…")}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </div>
          <div className="schema-editor-footer-right">
            <button type="button" className="schema-btn schema-btn--secondary" onClick={handleClose}>
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="button"
              className="schema-btn schema-btn--primary"
              disabled={!name.trim()}
              onClick={handleSave}
            >
              {t("common.save", "Save")}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};
