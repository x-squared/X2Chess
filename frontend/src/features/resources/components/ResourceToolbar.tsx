/**
 * ResourceToolbar — group-by, filter-clear, schema chooser, and new-game controls.
 *
 * Renders the toolbar row shown below the resource tab bar when a tab is active.
 * All state and callbacks are passed as props from ResourceViewer.
 *
 * Integration API:
 * - `<ResourceToolbar ... />` — rendered by ResourceViewer when an active tab exists.
 *
 * Communication API:
 * - All interactions fire callbacks: `onGroupByAdd`, `onGroupByRemove`,
 *   `onGroupByMoveUp`, `onGroupByClear`, `onClearFilters`,
 *   `onSchemaSelect`, `onSchemaManage`, `onAddMetadataField`.
 */

import type { ReactElement } from "react";
import type { GroupByState } from "../services/viewer_utils";
import {
  BUILT_IN_SCHEMA,
  type MetadataFieldDefinition,
  type MetadataSchema,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import { UI_IDS } from "../../../core/model/ui_ids";

type ResourceToolbarProps = {
  groupByState: GroupByState;
  availableGroupByFields: string[];
  hasActiveFilters: boolean;
  activeSchema: MetadataSchema;
  schemas: MetadataSchema[];
  t: (key: string, fallback?: string) => string;
  onGroupByAdd: (field: string) => void;
  onGroupByRemove: (field: string) => void;
  onGroupByMoveUp: (field: string) => void;
  onGroupByClear: () => void;
  onClearFilters: () => void;
  onSchemaSelect: (id: string) => void;
  onSchemaManage: () => void;
  /** Schema fields not yet shown as table columns (same order as schema editor). */
  addableSchemaFields: MetadataFieldDefinition[];
  onAddMetadataField: (fieldKey: string) => void;
};

export const ResourceToolbar = ({
  groupByState,
  availableGroupByFields,
  hasActiveFilters,
  activeSchema,
  schemas,
  t,
  onGroupByAdd,
  onGroupByRemove,
  onGroupByMoveUp,
  onGroupByClear,
  onClearFilters,
  onSchemaSelect,
  onSchemaManage,
  addableSchemaFields,
  onAddMetadataField,
}: ResourceToolbarProps): ReactElement => (
  <div className="resource-groupby-toolbar" data-ui-id={UI_IDS.RESOURCES_TOOLBAR}>
    <span className="resource-groupby-label">
      {t("resources.groupby.label", "Group by:")}
    </span>
    {groupByState.fields.length > 0 && (
      <span className="resource-groupby-pills">
        {groupByState.fields.map((field: string, idx: number): ReactElement => (
          <span key={field} className="resource-groupby-pill">
            <button
              type="button"
              className="resource-groupby-pill-up"
              disabled={idx === 0}
              aria-label={t("resources.groupby.moveUp", "Move level up")}
              onClick={(): void => { onGroupByMoveUp(field); }}
            >↑</button>
            <span className="resource-groupby-pill-label">{field}</span>
            <button
              type="button"
              className="resource-groupby-pill-remove"
              aria-label={t("resources.groupby.remove", "Remove group level")}
              onClick={(): void => { onGroupByRemove(field); }}
            >×</button>
          </span>
        ))}
      </span>
    )}
    {groupByState.fields.length === 0 && (
      <span className="resource-groupby-none">
        {t("resources.groupby.none", "none")}
      </span>
    )}
    {availableGroupByFields.length > 0 && (
      <select
        className="resource-groupby-add"
        value=""
        aria-label={t("resources.groupby.add", "Add group level")}
        onChange={(e): void => {
          if (e.target.value) onGroupByAdd(e.target.value);
        }}
      >
        <option value="">{t("resources.groupby.addPlaceholder", "+ Add level")}</option>
        {availableGroupByFields.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    )}
    <button
      type="button"
      className="resource-groupby-clear"
      onClick={onGroupByClear}
      disabled={groupByState.fields.length === 0}
      aria-disabled={groupByState.fields.length === 0 ? "true" : undefined}
      title={t("resources.groupby.clear", "Clear")}
    >
      {t("resources.groupby.clear", "Clear")}
    </button>
    {hasActiveFilters && (
      <button type="button" className="resource-filter-clear-all" onClick={onClearFilters}>
        {t("resources.filter.clearAll", "Clear filters")}
      </button>
    )}

    {/* Schema chooser (MD4) */}
    <span className="resource-schema-label">
      {t("resources.schema.label", "Schema:")}
    </span>
    <select
      className="resource-schema-select"
      value={activeSchema.id}
      aria-label={t("resources.schema.select", "Select metadata schema")}
      onChange={(e): void => { onSchemaSelect(e.target.value); }}
    >
      <option value={BUILT_IN_SCHEMA.id}>{BUILT_IN_SCHEMA.name}</option>
      {schemas.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
    <button type="button" className="resource-schema-manage-btn" onClick={onSchemaManage}>
      {t("resources.schema.manage", "Manage schemas…")}
    </button>

    {/* Add metadata column — fields from active schema not yet in the table */}
    {addableSchemaFields.length > 0 && (
      <select
        className="resource-metadata-add-field"
        value=""
        aria-label={t("resources.metadata.addField", "Add metadata column")}
        onChange={(e): void => {
          const sel: HTMLSelectElement = e.target;
          const v: string = sel.value;
          if (v) {
            onAddMetadataField(v);
            sel.value = "";
          }
        }}
      >
        <option value="">{t("resources.metadata.addFieldPlaceholder", "Add metadata…")}</option>
        {addableSchemaFields.map((f: MetadataFieldDefinition) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
    )}

  </div>
);
