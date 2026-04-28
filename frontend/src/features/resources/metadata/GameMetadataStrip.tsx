/**
 * GameMetadataStrip — custom schema field editor for the active game.
 *
 * Integration API:
 * - `<GameMetadataStrip />` — mount inside `GameInfoEditor`; no props required.
 * - Reads `pgnModel` and `activeSessionId` from `AppStoreState` context.
 * - Reads the active resource's schema from localStorage via
 *   `getResourceSchemaId` + `loadSchemas`.
 *
 * Configuration API:
 * - No props.  Data flows through service and app contexts.
 *
 * Communication API:
 * - Reads: current field values from `pgnModel` via `getHeaderValue`.
 * - Writes: field changes via `services.updateGameInfoHeader`.
 * - Inherited values: fetched from the referenced game via
 *   `services.fetchGameMetadataByRecordId`; shown as ghost hints.
 *   Not written to storage.
 * - Renders nothing if no schema is active for the current resource, or if
 *   the schema has no custom fields (non-standard PGN header keys).
 */

import { useState, useEffect, useMemo, type ReactElement } from "react";
import type { MetadataSchema } from "../../../../../parts/resource/src/domain/metadata_schema";
import { getHeaderValue } from "../../../model";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import { selectActiveSessionId, selectPgnModel } from "../../../core/state/selectors";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import { useTranslator } from "../../../app/hooks/useTranslator";
import { GAME_INFO_HEADER_FIELDS } from "../../editor/model/game_info";
import { loadSchemas, getResourceSchemaId } from "../services/schema_storage";
import { MetadataFieldInput } from "./MetadataFieldInput";
import { log } from "../../../logger";

// Keys shown in the standard GameInfoEditor form — exclude from this strip.
const STANDARD_KEYS: ReadonlySet<string> = new Set(
  GAME_INFO_HEADER_FIELDS.map((f) => f.key),
);

/** Renders editable custom metadata fields (schema-defined) for the active game. */
export const GameMetadataStrip = (): ReactElement | null => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const pgnModel = selectPgnModel(state);
  const activeSessionId: string | null = selectActiveSessionId(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  // ── Schema resolution ──────────────────────────────────────────────────────

  const resourceRef = useMemo(
    () => services.getActiveSessionResourceRef(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, activeSessionId],
  );

  const [schema, setSchema] = useState<MetadataSchema | null>(null);

  useEffect(() => {
    if (!resourceRef) { setSchema(null); return; }
    const schemaId = getResourceSchemaId(resourceRef);
    if (!schemaId) { setSchema(null); return; }
    const found = loadSchemas().find((s) => s.id === schemaId) ?? null;
    setSchema(found);
  }, [resourceRef]);

  // ── Field list ─────────────────────────────────────────────────────────────

  const customFields = useMemo(
    () => (schema ? schema.fields.filter((f) => !STANDARD_KEYS.has(f.key)) : []),
    [schema],
  );

  // ── Inherited value resolution ─────────────────────────────────────────────

  const refTargetId: string = useMemo(() => {
    if (!schema || !pgnModel) return "";
    const refField = schema.fields.find((f) => f.type === "reference");
    if (!refField) return "";
    return getHeaderValue(pgnModel, refField.key, "");
  }, [schema, pgnModel]);

  const [inheritedMeta, setInheritedMeta] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!refTargetId) { setInheritedMeta({}); return; }
    let cancelled = false;
    services
      .fetchGameMetadataByRecordId(refTargetId)
      .then((meta) => {
        if (!cancelled) setInheritedMeta(meta ?? {});
      })
      .catch(() => { if (!cancelled) setInheritedMeta({}); });
    return (): void => { cancelled = true; };
  }, [refTargetId, services]);

  const referenceableKeys: ReadonlySet<string> = useMemo(
    () => new Set((schema?.fields ?? []).filter((f) => f.referenceable).map((f) => f.key)),
    [schema],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!schema || customFields.length === 0) return null;

  return (
    <div className="game-metadata-strip">
      {customFields.map((field): ReactElement => {
        const value: string = pgnModel ? getHeaderValue(pgnModel, field.key, "") : "";
        const inheritedValue: string | undefined = referenceableKeys.has(field.key)
          ? (inheritedMeta[field.key] ?? "")
          : undefined;

        return (
          <div key={field.key} className="game-info-editor-field game-metadata-strip-field">
            <span>{field.label}</span>
            <MetadataFieldInput
              field={field}
              value={value}
              onChange={(newValue: string): void => {
                if (!activeSessionId) return;
                // [log: may downgrade to debug once reference-clear flow is stable]
                log.info("GameMetadataStrip", "field change forwarded to updateGameInfoHeader", {
                  fieldKey: field.key,
                  sessionId: activeSessionId,
                  isEmpty: newValue.trim() === "",
                });
                services.updateGameInfoHeader(activeSessionId, field.key, newValue);
              }}
              resourceRef={resourceRef ?? undefined}
              t={t}
              onFetchMetadata={services.fetchGameMetadataByRecordId}
              onOpen={(recordId: string): void => { void services.openGameFromRecordId(recordId); }}
              inheritedValue={inheritedValue}
            />
          </div>
        );
      })}
    </div>
  );
};
