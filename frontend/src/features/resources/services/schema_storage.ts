/**
 * schema_storage — read/write user-defined metadata schemas from localStorage.
 *
 * Integration API:
 * - Exports: `loadSchemas`, `saveSchemas`, `findSchema`, `upsertSchema`,
 *   `deleteSchema`, `validateSchemaJson`.
 *
 * Configuration API:
 * - Schemas are persisted under the key `x2chess.metadata-schemas` in
 *   `localStorage`.  No other configuration is required.
 *
 * Communication API:
 * - Pure functions except for `loadSchemas` / `saveSchemas` which access
 *   `localStorage`.
 */

import type { MetadataSchema, MetadataFieldDefinition } from "../../../../../parts/resource/src/domain/metadata_schema";
import { createVersionedStore } from "../../../storage";

const STORAGE_KEY = "x2chess.metadata-schemas";

// ── Versioned store ────────────────────────────────────────────────────────────

const schemasStore = createVersionedStore<MetadataSchema[]>({
  key: STORAGE_KEY,
  version: 2,
  defaultValue: [],
  migrations: [
    // v0→v1: legacy payload was `{ schemas: MetadataSchema[] }` (container object).
    // Unwrap the container, or return an empty array for unrecognised shapes.
    (raw): unknown => {
      if (Array.isArray(raw)) return raw;
      if (raw !== null && typeof raw === "object") {
        const container = raw as Record<string, unknown>;
        if (Array.isArray(container["schemas"])) return container["schemas"];
      }
      return [];
    },
    // v1→v2: add `cardinality: "one"` to every existing field definition that
    // lacks the property. Introduced when multi-valued fields were added.
    (raw): unknown => {
      if (!Array.isArray(raw)) return raw;
      return (raw as MetadataSchema[]).map((schema) => ({
        ...schema,
        fields: Array.isArray(schema.fields)
          ? schema.fields.map((f) => ({ cardinality: "one" as const, ...f }))
          : schema.fields,
      }));
    },
  ],
});

// ── Read ───────────────────────────────────────────────────────────────────────

/** Load all user-defined schemas from localStorage. Returns `[]` if none saved. */
export const loadSchemas = (): MetadataSchema[] => schemasStore.read();

// ── Write ──────────────────────────────────────────────────────────────────────

/** Persist the full schemas list to localStorage. */
export const saveSchemas = (schemas: MetadataSchema[]): void => schemasStore.write(schemas);

// ── Lookup ─────────────────────────────────────────────────────────────────────

/** Find a schema by id, or `null` if not found. */
export const findSchema = (
  schemas: MetadataSchema[],
  id: string,
): MetadataSchema | null =>
  schemas.find((s) => s.id === id) ?? null;

// ── Upsert / delete ────────────────────────────────────────────────────────────

/**
 * Insert or replace a schema in the list.
 * Returns a new array (does not mutate the input).
 */
export const upsertSchema = (
  schemas: MetadataSchema[],
  schema: MetadataSchema,
): MetadataSchema[] => {
  const existing = schemas.findIndex((s) => s.id === schema.id);
  if (existing === -1) return [...schemas, schema];
  return schemas.map((s, i) => (i === existing ? schema : s));
};

/**
 * Remove a schema by id.
 * Returns a new array (does not mutate the input).
 */
export const deleteSchema = (
  schemas: MetadataSchema[],
  id: string,
): MetadataSchema[] => schemas.filter((s) => s.id !== id);

// ── Export / import ────────────────────────────────────────────────────────────

export type SchemaExportFile = {
  "x2chess-schema": "1";
  schema: MetadataSchema;
};

/** Serialize a schema to the export JSON format. */
export const exportSchemaToJson = (schema: MetadataSchema): string =>
  JSON.stringify({ "x2chess-schema": "1", schema }, null, 2);

/**
 * Parse and validate an import JSON string.
 * Returns the schema, or throws with a descriptive message on error.
 */
export const validateSchemaJson = (json: string): MetadataSchema => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj["x2chess-schema"] !== "1") {
    throw new Error("Not a valid X2Chess schema file (missing x2chess-schema: \"1\")");
  }
  const schema = obj.schema as MetadataSchema | undefined;
  if (!schema || typeof schema.id !== "string" || typeof schema.name !== "string") {
    throw new Error("Schema file is malformed: missing id or name");
  }
  if (!Array.isArray(schema.fields)) {
    throw new TypeError("Schema file is malformed: fields must be an array");
  }
  return schema;
};

// ── Per-resource schema association ──────────────────────────────────────────

const resourceSchemaKey = (ref: { kind: string; locator: string }): string =>
  `x2chess.resource-schema.${ref.kind}:${ref.locator}`;

/**
 * Return the schema ID associated with a resource, or `null` if none is set.
 * Used outside `ResourceViewer` (e.g. `GameMetadataStrip`) to load the right
 * schema without needing access to the viewer's local state.
 */
export const getResourceSchemaId = (ref: { kind: string; locator: string }): string | null => {
  try {
    return globalThis.localStorage?.getItem(resourceSchemaKey(ref)) ?? null;
  } catch {
    return null;
  }
};

/**
 * Persist (or clear) the schema ID associated with a resource.
 * Called by `ResourceViewer` whenever the user picks a schema for a tab.
 */
export const setResourceSchemaId = (
  ref: { kind: string; locator: string },
  schemaId: string | null,
): void => {
  try {
    const key = resourceSchemaKey(ref);
    if (schemaId === null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, schemaId);
    }
  } catch {
    // Storage unavailable.
  }
};

// ── Reorder helpers ────────────────────────────────────────────────────────────

/**
 * Renumber field `orderIndex` values to 10, 20, 30, … preserving their
 * current order. Leaves gaps for future insertions.
 */
export const renumberFields = (
  fields: MetadataFieldDefinition[],
): MetadataFieldDefinition[] =>
  fields.map((f, i) => ({ ...f, orderIndex: (i + 1) * 10 }));

/**
 * Move the field at `fromIndex` to `toIndex`.
 * Returns a new array with renumbered `orderIndex` values.
 */
export const moveField = (
  fields: MetadataFieldDefinition[],
  fromIndex: number,
  toIndex: number,
): MetadataFieldDefinition[] => {
  if (fromIndex === toIndex) return fields;
  const arr = [...fields];
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, item);
  return renumberFields(arr);
};
