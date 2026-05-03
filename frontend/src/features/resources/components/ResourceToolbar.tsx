/**
 * ResourceToolbar — schema chooser, metadata-field visibility, and group-by controls.
 *
 * Control order (left → right):
 *   [Schema label + chooser/locked display]
 *   [Metadata columns icon] [Arrange columns icon]
 *   [Group by: label + pills + add dropdown + clear]
 *   [Clear filters]
 *
 * Schema chooser lock: once a custom schema is assigned to the active resource,
 * the chooser is replaced by a locked display.  The user must click "Change…"
 * to unlock it and acknowledge the stale-metadata warning before selecting a
 * different schema.
 *
 * Integration API:
 * - `<ResourceToolbar ... />` — rendered by ResourceViewer when an active tab exists.
 *
 * Communication API:
 * - All interactions fire callbacks: `onGroupByAdd`, `onGroupByRemove`,
 *   `onGroupByMoveUp`, `onGroupByClear`, `onClearFilters`,
 *   `onSchemaSelect`, `onAddMetadataField`.
 */

import { useState, type ReactElement } from "react";
import type { GroupByState } from "../services/viewer_utils";
import {
  BUILT_IN_SCHEMA,
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
  /** Opens the metadata columns dialog. */
  onMetadataOpen: () => void;
  /** Opens the column order dialog (Move up / down). */
  onOpenColumnOrder: () => void;
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
  onMetadataOpen,
  onOpenColumnOrder,
}: ResourceToolbarProps): ReactElement => {
  const [isChangingSchema, setIsChangingSchema] = useState<boolean>(false);

  const isCustomSchema: boolean = activeSchema.id !== BUILT_IN_SCHEMA.id;
  const showLocked: boolean = isCustomSchema && !isChangingSchema;

  return (
    <div className="resource-groupby-toolbar" data-ui-id={UI_IDS.RESOURCES_TOOLBAR}>

      {/* ── Schema chooser ─────────────────────────────────────────────── */}
      <span className="resource-schema-label">
        {t("resources.schema.label", "Schema:")}
      </span>

      {showLocked ? (
        <>
          <span className="resource-schema-locked-name">{activeSchema.name}</span>
          <button
            type="button"
            className="resource-schema-change-btn"
            onClick={(): void => { setIsChangingSchema(true); }}
          >
            {t("resources.schema.change", "Change…")}
          </button>
        </>
      ) : (
        <>
          <select
            className="resource-schema-select"
            value={activeSchema.id}
            aria-label={t("resources.schema.select", "Select metadata schema")}
            onChange={(e): void => {
              onSchemaSelect(e.target.value);
              setIsChangingSchema(false);
            }}
          >
            <option value={BUILT_IN_SCHEMA.id}>{BUILT_IN_SCHEMA.name}</option>
            {schemas.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {isChangingSchema && (
            <>
              <span className="resource-schema-change-warning">
                {t("resources.schema.changeWarning", "Changing schema may leave existing game metadata stale.")}
              </span>
              <button
                type="button"
                className="resource-schema-change-cancel"
                onClick={(): void => { setIsChangingSchema(false); }}
              >
                {t("common.cancel", "Cancel")}
              </button>
            </>
          )}
        </>
      )}

      {/* ── Column controls ────────────────────────────────────────────── */}
      <button
        type="button"
        className="resource-toolbar-icon-btn"
        data-ui-id={`${UI_IDS.RESOURCES_TOOLBAR}.metadataColumns`}
        aria-label={t("resources.metadata.button", "Choose metadata columns")}
        title={t("resources.metadata.button", "Choose metadata columns")}
        onClick={onMetadataOpen}
      >
        <img src="/icons/toolbar/metadata-columns.svg" alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="resource-toolbar-icon-btn"
        data-ui-id={`${UI_IDS.RESOURCES_TOOLBAR}.arrangeColumns`}
        aria-label={t("resources.table.arrangeColumns", "Arrange columns")}
        title={t("resources.table.arrangeColumns", "Arrange columns")}
        onClick={onOpenColumnOrder}
      >
        <img src="/icons/toolbar/arrange-columns.svg" alt="" aria-hidden="true" />
      </button>

      {/* ── Group by ───────────────────────────────────────────────────── */}
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

      {/* ── Clear filters ──────────────────────────────────────────────── */}
      {hasActiveFilters && (
        <button type="button" className="resource-filter-clear-all" onClick={onClearFilters}>
          {t("resources.filter.clearAll", "Clear filters")}
        </button>
      )}

    </div>
  );
};
