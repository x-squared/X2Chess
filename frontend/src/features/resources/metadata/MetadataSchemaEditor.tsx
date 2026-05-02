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
import { UI_IDS } from "../../../core/model/ui_ids";
import type {
  MetadataSchema,
  MetadataFieldDefinition,
  MetadataFieldType,
  MetadataValueCardinality,
  GameRenderingProfile,
  GameRenderingRule,
  GameRenderingDisplay,
  GameRenderingLine,
  GameRenderingRef,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import {
  moveField,
  renumberFields,
  exportSchemaToJson,
  validateSchemaJson,
} from "../services/schema_storage";
import { BUILT_IN_SCHEMA } from "../../../../../parts/resource/src/domain/metadata_schema";
import { log } from "../../../logger";

// ── Helpers ────────────────────────────────────────────────────────────────────

const generateId = (): string =>
  `schema-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const FIELD_TYPES: MetadataFieldType[] = ["text", "date", "select", "number", "flag", "reference", "link"];

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
        {/* Reference note / referenceable toggle */}
        {draft.type === "reference" && (
          <p className="schema-field-reference-note">
            {t("schema.field.referenceNote", "When set on a game, activates inheritance for all referenceable fields.")}
          </p>
        )}
        {draft.type !== "reference" && (
          <div className="schema-field-edit-row">
            <label className="schema-field-edit-label schema-field-edit-label--inline">
              <input
                type="checkbox"
                checked={draft.referenceable === true}
                onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                  setDraft((d) => ({ ...d, referenceable: e.target.checked ? true : undefined }));
                }}
              />
              {t("schema.field.referenceable", "Available for inheritance")}
            </label>
          </div>
        )}
        {draft.type !== "reference" && draft.type !== "flag" && (
          <div className="schema-field-edit-row">
            <label className="schema-field-edit-label schema-field-edit-label--inline">
              <input
                type="checkbox"
                checked={draft.cardinality === "many"}
                onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                  const cardinality: MetadataValueCardinality | undefined = e.target.checked ? "many" : undefined;
                  setDraft((d) => ({ ...d, cardinality }));
                }}
              />
              {t("schema.field.many", "Allow multiple values")}
            </label>
          </div>
        )}
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
          <button type="button" className="x2-dialog-btn schema-btn schema-btn--secondary" onClick={onCancelEdit}>
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="x2-dialog-btn x2-dialog-btn--primary schema-btn schema-btn--primary"
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
      {field.referenceable && <span className="schema-field-referenceable">{t("schema.field.referenceableBadge", "referenceable")}</span>}
      {field.cardinality === "many" && <span className="schema-field-many">{t("schema.field.manyBadge", "multiple")}</span>}
      <div className="schema-field-actions">
        <button type="button" className="schema-icon-btn" onClick={(): void => { onEdit(index); }} aria-label={t("schema.field.edit", "Edit field")}>✎</button>
        <button type="button" className="schema-icon-btn schema-icon-btn--danger" onClick={(): void => { onDelete(index); }} aria-label={t("schema.field.delete", "Delete field")}>×</button>
        <button type="button" className="schema-icon-btn" disabled={index === 0} onClick={(): void => { onMoveUp(index); }} aria-label={t("schema.field.moveUp", "Move up")}>↑</button>
        <button type="button" className="schema-icon-btn" disabled={index === total - 1} onClick={(): void => { onMoveDown(index); }} aria-label={t("schema.field.moveDown", "Move down")}>↓</button>
      </div>
    </div>
  );
};

// ── Rendering editor: ref serialization ──────────────────────────────────────

const encodeRef = (ref: GameRenderingRef): string => {
  if (ref.kind === "players") return "players";
  if (ref.kind === "date") return `date:${ref.key}:${ref.format}`;
  return `field:${ref.key}`;
};

const decodeRef = (s: string): GameRenderingRef | null => {
  if (!s) return null;
  if (s === "players") return { kind: "players" };
  if (s.startsWith("date:")) {
    const [, key, fmt] = s.split(":");
    if (!key) return null;
    const format = (fmt === "month-year" || fmt === "year") ? fmt : "full";
    return { kind: "date", key, format };
  }
  if (s.startsWith("field:")) {
    const key = s.slice(6);
    return key ? { kind: "field", key } : null;
  }
  return null;
};

// ── Rendering editor: draft types ─────────────────────────────────────────────

type RenderingLineDraft = { item1: string; item2: string; separator: string };
type RenderingDisplayDraft = { line1: RenderingLineDraft; line2: RenderingLineDraft | null };
type RenderingRuleDraft = { when: Record<string, string>; display1: RenderingDisplayDraft; display2: RenderingDisplayDraft | null };

const emptyLineDraft = (): RenderingLineDraft => ({ item1: "", item2: "", separator: " · " });
const emptyDisplayDraft = (): RenderingDisplayDraft => ({ line1: emptyLineDraft(), line2: null });
const emptyRuleDraft = (): RenderingRuleDraft => ({ when: {}, display1: emptyDisplayDraft(), display2: null });

const lineDraftFromLine = (l: GameRenderingLine): RenderingLineDraft => ({
  item1: encodeRef(l.items[0]),
  item2: l.items[1] ? encodeRef(l.items[1]) : "",
  separator: l.separator,
});

const displayDraftFromDisplay = (d: GameRenderingDisplay): RenderingDisplayDraft => ({
  line1: lineDraftFromLine(d.line1),
  line2: d.line2 ? lineDraftFromLine(d.line2) : null,
});

const ruleDraftFromRule = (r: GameRenderingRule): RenderingRuleDraft => ({
  when: { ...r.when },
  display1: r.display1 ? displayDraftFromDisplay(r.display1) : emptyDisplayDraft(),
  display2: r.display2 ? displayDraftFromDisplay(r.display2) : null,
});

const lineDraftToLine = (d: RenderingLineDraft): GameRenderingLine | null => {
  const ref1 = decodeRef(d.item1);
  if (!ref1) return null;
  const ref2 = decodeRef(d.item2);
  return { items: ref2 ? [ref1, ref2] : [ref1], separator: d.separator || " · " };
};

const displayDraftToDisplay = (d: RenderingDisplayDraft): GameRenderingDisplay | null => {
  const line1 = lineDraftToLine(d.line1);
  if (!line1) return null;
  const line2 = d.line2 ? lineDraftToLine(d.line2) : null;
  return { line1, ...(line2 ? { line2 } : {}) };
};

const ruleDraftToRule = (d: RenderingRuleDraft): GameRenderingRule => ({
  when: d.when,
  display1: displayDraftToDisplay(d.display1) ?? undefined,
  display2: d.display2 ? (displayDraftToDisplay(d.display2) ?? undefined) : undefined,
});

// ── RenderingRefPicker ────────────────────────────────────────────────────────

const DATE_FORMATS = [
  { value: "full" as const,       label: "Full date" },
  { value: "month-year" as const, label: "Month & year" },
  { value: "year" as const,       label: "Year only" },
];

const RenderingRefPicker = ({
  value,
  fields,
  slotLabel,
  onChange,
}: {
  value: string;
  fields: MetadataFieldDefinition[];
  slotLabel: string;
  onChange: (v: string) => void;
}): ReactElement => {
  const isDate = value.startsWith("date:");
  const parts = value.split(":");
  const baseValue = isDate ? `date:${parts[1] ?? ""}` : value;
  const fmt = (parts[2] ?? "full") as "full" | "month-year" | "year";

  return (
    <span className="rendering-ref-picker">
      <span className="rendering-ref-picker-label">{slotLabel}</span>
      <select
        className="rendering-ref-select"
        value={isDate ? baseValue : value}
        onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
          const v = e.target.value;
          onChange(v.startsWith("date:") ? `${v}:full` : v);
        }}
      >
        <option value="">— none —</option>
        <option value="players">Players (White — Black)</option>
        {fields.map((f) => (
          <option key={f.key} value={f.type === "date" ? `date:${f.key}` : `field:${f.key}`}>
            {f.label || f.key}
          </option>
        ))}
      </select>
      {isDate && (
        <select
          className="rendering-ref-format-select"
          value={fmt}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
            onChange(`${baseValue}:${e.target.value}`);
          }}
        >
          {DATE_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      )}
    </span>
  );
};

// ── RenderingLineEditor ───────────────────────────────────────────────────────

const RenderingLineEditor = ({
  draft,
  fields,
  onChange,
}: {
  draft: RenderingLineDraft;
  fields: MetadataFieldDefinition[];
  onChange: (d: RenderingLineDraft) => void;
}): ReactElement => (
  <span className="rendering-line-editor">
    <RenderingRefPicker value={draft.item1} fields={fields} slotLabel="1st:" onChange={(v): void => onChange({ ...draft, item1: v })} />
    <RenderingRefPicker value={draft.item2} fields={fields} slotLabel="2nd:" onChange={(v): void => onChange({ ...draft, item2: v })} />
    {draft.item2 && (
      <label className="rendering-sep-label">
        Sep:
        <input
          className="rendering-sep-input"
          value={draft.separator}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => onChange({ ...draft, separator: e.target.value })}
        />
      </label>
    )}
  </span>
);

// ── RenderingDisplayEditor ────────────────────────────────────────────────────

const RenderingDisplayEditor = ({
  draft,
  fields,
  onChange,
}: {
  draft: RenderingDisplayDraft;
  fields: MetadataFieldDefinition[];
  onChange: (d: RenderingDisplayDraft) => void;
}): ReactElement => (
  <div className="rendering-display-editor">
    <div className="rendering-display-line">
      <span className="rendering-line-label rendering-line-label--bold">Primary line:</span>
      <RenderingLineEditor draft={draft.line1} fields={fields} onChange={(l): void => onChange({ ...draft, line1: l })} />
    </div>
    {draft.line2 !== null ? (
      <div className="rendering-display-line">
        <span className="rendering-line-label">Secondary line (optional):</span>
        <RenderingLineEditor draft={draft.line2} fields={fields} onChange={(l): void => onChange({ ...draft, line2: l })} />
        <button type="button" className="rendering-remove-btn" onClick={(): void => onChange({ ...draft, line2: null })}>Remove secondary</button>
      </div>
    ) : (
      <button type="button" className="rendering-add-btn" onClick={(): void => onChange({ ...draft, line2: emptyLineDraft() })}>+ Secondary line</button>
    )}
  </div>
);

// ── RenderingRuleEditor ───────────────────────────────────────────────────────

const RenderingRuleEditor = ({
  draft,
  conditionFields,
  displayFields,
  canDelete,
  onChange,
  onDelete,
}: {
  draft: RenderingRuleDraft;
  conditionFields: MetadataFieldDefinition[];
  displayFields: MetadataFieldDefinition[];
  canDelete: boolean;
  onChange: (d: RenderingRuleDraft) => void;
  onDelete: () => void;
}): ReactElement => {
  const isDefault = conditionFields.every((f) => !draft.when[f.key]);
  return (
    <div className="rendering-rule">
      <div className="rendering-rule-header">
        <span className="rendering-rule-when-label">
          {conditionFields.length === 0 || isDefault ? "Default (fallback):" : "When:"}
        </span>
        {conditionFields.map((f) => (
          <label key={f.key} className="rendering-rule-condition">
            <span className="rendering-rule-condition-key">{f.label || f.key} =</span>
            <select
              className="rendering-rule-condition-select"
              value={draft.when[f.key] ?? ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                const when = { ...draft.when };
                if (e.target.value) { when[f.key] = e.target.value; } else { delete when[f.key]; }
                onChange({ ...draft, when });
              }}
            >
              <option value="">— any —</option>
              {(f.selectValues ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        ))}
        {canDelete && (
          <button type="button" className="rendering-rule-delete" aria-label="Remove rule" onClick={onDelete}>×</button>
        )}
      </div>
      <div className="rendering-rule-displays">
        <div className="rendering-rule-display-slot">
          <span className="rendering-display-slot-label">Table / compact:</span>
          <RenderingDisplayEditor
            draft={draft.display1}
            fields={displayFields}
            onChange={(d): void => onChange({ ...draft, display1: d })}
          />
        </div>
        {draft.display2 !== null ? (
          <div className="rendering-rule-display-slot">
            <span className="rendering-display-slot-label">Full / detail:</span>
            <RenderingDisplayEditor draft={draft.display2} fields={displayFields} onChange={(d): void => onChange({ ...draft, display2: d })} />
            <button type="button" className="rendering-remove-btn" onClick={(): void => onChange({ ...draft, display2: null })}>Remove full view</button>
          </div>
        ) : (
          <button type="button" className="rendering-add-btn" onClick={(): void => onChange({ ...draft, display2: emptyDisplayDraft() })}>+ Full / detail view</button>
        )}
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

  // ── Rendering profile draft ────────────────────────────────────────────
  const [conditionKeys, setConditionKeys] = useState<string[]>(
    schema?.rendering?.conditionKeys ?? [],
  );
  const [ruleDrafts, setRuleDrafts] = useState<RenderingRuleDraft[]>(
    schema?.rendering?.rules?.length
      ? schema.rendering.rules.map(ruleDraftFromRule)
      : [emptyRuleDraft()],
  );

  useEffect((): void => {
    dialogRef.current?.showModal();
    log.debug("MetadataSchemaEditor", () => `mounted — editing=${schema?.id ?? "new"}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback((): void => {
    if (!name.trim()) return;
    const rules = ruleDrafts.map(ruleDraftToRule);
    const nonEmptyRules = rules.filter((r) => r.display1 ?? r.display2);
    const rendering: GameRenderingProfile | undefined = nonEmptyRules.length > 0
      ? { conditionKeys, rules: nonEmptyRules }
      : undefined;
    const saved: MetadataSchema = {
      id: schema?.id ?? generateId(),
      name: name.trim(),
      version: (schema?.version ?? 0) + 1,
      fields: renumberFields(fields),
      rendering,
    };
    onSave(saved);
    dialogRef.current?.close();
  }, [name, fields, schema, conditionKeys, ruleDrafts, onSave]);

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
    log.debug("MetadataSchemaEditor", () => `export — schemaId=${schema.id}`);
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
        log.info("MetadataSchemaEditor", `import succeeded — schemaId=${imported.id}`, { schemaId: imported.id });
      } catch (err) {
        const message = String(err instanceof Error ? err.message : err);
        log.error("MetadataSchemaEditor", "import failed", { message });
        setImportError(message);
      }
    };
    reader.readAsText(file);
    // Reset so same file can be imported again.
    e.target.value = "";
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="x2-dialog schema-editor-dialog"
      data-ui-id={UI_IDS.METADATA_SCHEMA_EDITOR_DIALOG}
      onClose={onClose}
    >
      <div className="x2-dialog-body schema-editor-form">
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
          <button type="button" className="x2-dialog-btn schema-btn schema-btn--secondary" onClick={handleAddField}>
            {t("schema.editor.addField", "+ Add Field")}
          </button>
        </div>

        {importError && (
          <p className="schema-editor-import-error">{importError}</p>
        )}

        {/* ── Rendering profile (GRP) ──────────────────────────────────── */}
        <details className="rendering-profile-section">
          <summary className="rendering-profile-summary">
            {t("schema.rendering.title", "Game rendering")}
          </summary>
          {(() => {
            const selectFields = fields.filter((f) => f.type === "select");
            // Merge built-in PGN fields with schema fields; exclude select-type from the
            // display picker (they are condition inputs, not display values).
            const mergedDisplayFields: MetadataFieldDefinition[] = (() => {
              const byKey = new Map<string, MetadataFieldDefinition>();
              for (const f of BUILT_IN_SCHEMA.fields) {
                if (f.type !== "select") byKey.set(f.key, f);
              }
              for (const f of fields) {
                if (f.type !== "select") byKey.set(f.key, f);
              }
              return [...byKey.values()];
            })();
            return (
              <div className="rendering-profile-body">
                <p className="rendering-profile-hint">
                  {t("schema.rendering.hint",
                    "Pick select fields for conditions. Table/compact sets the resource table and session tabs (primary line plus optional secondary). Full/detail is an alternate layout for reference chips."
                  )}
                </p>

                {/* Condition fields */}
                <div className="rendering-condition-fields">
                  <span className="rendering-condition-label">
                    {t("schema.rendering.conditionFields", "Condition fields (select type):")}
                  </span>
                  {selectFields.length === 0 ? (
                    <span className="rendering-no-select-fields">
                      {t("schema.rendering.noSelectFields", "No select-type fields in this schema.")}
                    </span>
                  ) : (
                    selectFields.map((f) => (
                      <label key={f.key} className="rendering-condition-check">
                        <input
                          type="checkbox"
                          checked={conditionKeys.includes(f.key)}
                          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                            setConditionKeys((prev) =>
                              e.target.checked
                                ? [...prev, f.key]
                                : prev.filter((k) => k !== f.key),
                            );
                          }}
                        />
                        {f.label || f.key}
                      </label>
                    ))
                  )}
                </div>

                {/* Rules */}
                <div className="rendering-rules-list">
                  {ruleDrafts.map((rd, ri) => (
                    <RenderingRuleEditor
                      key={ri}
                      draft={rd}
                      conditionFields={selectFields.filter((f) => conditionKeys.includes(f.key))}
                      displayFields={mergedDisplayFields}
                      canDelete={ruleDrafts.length > 1}
                      onChange={(updated): void => {
                        setRuleDrafts((prev) => prev.map((r, i) => i === ri ? updated : r));
                      }}
                      onDelete={(): void => {
                        setRuleDrafts((prev) => prev.filter((_, i) => i !== ri));
                      }}
                    />
                  ))}
                </div>

                <div className="rendering-rules-actions">
                  <button
                    type="button"
                    className="x2-dialog-btn schema-btn schema-btn--secondary"
                    onClick={(): void => setRuleDrafts((prev) => [...prev, emptyRuleDraft()])}
                  >
                    {t("schema.rendering.addRule", "+ Add rule")}
                  </button>
                  {!ruleDrafts.some((r) => Object.keys(r.when).length === 0) && (
                    <button
                      type="button"
                      className="x2-dialog-btn schema-btn schema-btn--secondary"
                      onClick={(): void => setRuleDrafts((prev) => [...prev, emptyRuleDraft()])}
                    >
                      {t("schema.rendering.addDefault", "+ Default rule")}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </details>

        <div className="schema-editor-footer">
          <div className="schema-editor-footer-left">
            {schema && (
              <button type="button" className="x2-dialog-btn x2-dialog-btn--ghost schema-btn schema-btn--ghost" onClick={handleExport}>
                {t("schema.editor.export", "Export…")}
              </button>
            )}
            <button type="button" className="x2-dialog-btn x2-dialog-btn--ghost schema-btn schema-btn--ghost" onClick={handleImportClick}>
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
            <button type="button" className="x2-dialog-btn schema-btn schema-btn--secondary" onClick={handleClose}>
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="button"
              className="x2-dialog-btn x2-dialog-btn--primary schema-btn schema-btn--primary"
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
