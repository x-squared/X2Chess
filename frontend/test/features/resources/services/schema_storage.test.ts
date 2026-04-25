/**
 * Tests for schema_storage pure utilities and per-resource schema persistence.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  findSchema,
  upsertSchema,
  deleteSchema,
  renumberFields,
  moveField,
  validateSchemaJson,
  getResourceSchemaId,
  setResourceSchemaId,
  type SchemaExportFile,
} from "../../../../src/features/resources/services/schema_storage.js";
import type { MetadataSchema } from "../../../../../../parts/resource/src/domain/metadata_schema.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSchema = (id: string, name = `Schema ${id}`): MetadataSchema => ({
  id,
  name,
  version: 1,
  fields: [
    { key: "ECO",  label: "ECO",  type: "text", required: false, orderIndex: 10 },
    { key: "Site", label: "Site", type: "text", required: false, orderIndex: 20 },
  ],
});

const makeRef = (kind = "db", locator = "test.x2chess") => ({ kind, locator });

// ── findSchema ────────────────────────────────────────────────────────────────

test("findSchema returns the schema when id matches", () => {
  const schemas = [makeSchema("a"), makeSchema("b")];
  assert.deepEqual(findSchema(schemas, "b"), makeSchema("b"));
});

test("findSchema returns null when id is not found", () => {
  assert.equal(findSchema([makeSchema("a")], "missing"), null);
});

test("findSchema returns null on empty list", () => {
  assert.equal(findSchema([], "any"), null);
});

// ── upsertSchema ──────────────────────────────────────────────────────────────

test("upsertSchema inserts a schema that does not yet exist", () => {
  const result = upsertSchema([], makeSchema("x"));
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "x");
});

test("upsertSchema replaces an existing schema with the same id", () => {
  const original = [makeSchema("a"), makeSchema("b")];
  const updated: MetadataSchema = { ...makeSchema("b"), name: "Updated B", version: 2 };
  const result = upsertSchema(original, updated);
  assert.equal(result.length, 2);
  assert.equal(result[1]!.name, "Updated B");
  assert.equal(result[1]!.version, 2);
});

test("upsertSchema does not mutate the input array", () => {
  const original = [makeSchema("a")];
  upsertSchema(original, makeSchema("b"));
  assert.equal(original.length, 1);
});

// ── deleteSchema ──────────────────────────────────────────────────────────────

test("deleteSchema removes the schema with the given id", () => {
  const schemas = [makeSchema("a"), makeSchema("b"), makeSchema("c")];
  const result = deleteSchema(schemas, "b");
  assert.equal(result.length, 2);
  assert.equal(result.find((s) => s.id === "b"), undefined);
});

test("deleteSchema preserves order of remaining schemas", () => {
  const schemas = [makeSchema("a"), makeSchema("b"), makeSchema("c")];
  const result = deleteSchema(schemas, "b");
  assert.equal(result[0]!.id, "a");
  assert.equal(result[1]!.id, "c");
});

test("deleteSchema is a no-op when id is not found", () => {
  const schemas = [makeSchema("a")];
  const result = deleteSchema(schemas, "missing");
  assert.equal(result.length, 1);
});

test("deleteSchema does not mutate the input array", () => {
  const schemas = [makeSchema("a"), makeSchema("b")];
  deleteSchema(schemas, "a");
  assert.equal(schemas.length, 2);
});

// ── renumberFields ────────────────────────────────────────────────────────────

test("renumberFields assigns 10, 20, 30, … to fields in order", () => {
  const fields = makeSchema("s").fields;
  const renumbered = renumberFields(fields);
  assert.equal(renumbered[0]!.orderIndex, 10);
  assert.equal(renumbered[1]!.orderIndex, 20);
});

test("renumberFields does not mutate input fields", () => {
  const fields = makeSchema("s").fields;
  const original = fields[0]!.orderIndex;
  renumberFields(fields);
  assert.equal(fields[0]!.orderIndex, original);
});

test("renumberFields returns empty array for empty input", () => {
  assert.deepEqual(renumberFields([]), []);
});

// ── moveField ─────────────────────────────────────────────────────────────────

test("moveField moves a field forward and renumbers", () => {
  const fields = [
    { key: "A", label: "A", type: "text" as const, required: false, orderIndex: 10 },
    { key: "B", label: "B", type: "text" as const, required: false, orderIndex: 20 },
    { key: "C", label: "C", type: "text" as const, required: false, orderIndex: 30 },
  ];
  const result = moveField(fields, 0, 2); // A → last
  assert.equal(result[0]!.key, "B");
  assert.equal(result[1]!.key, "C");
  assert.equal(result[2]!.key, "A");
  assert.equal(result[0]!.orderIndex, 10);
  assert.equal(result[2]!.orderIndex, 30);
});

test("moveField moves a field backward", () => {
  const fields = [
    { key: "A", label: "A", type: "text" as const, required: false, orderIndex: 10 },
    { key: "B", label: "B", type: "text" as const, required: false, orderIndex: 20 },
    { key: "C", label: "C", type: "text" as const, required: false, orderIndex: 30 },
  ];
  const result = moveField(fields, 2, 0); // C → first
  assert.equal(result[0]!.key, "C");
  assert.equal(result[1]!.key, "A");
  assert.equal(result[2]!.key, "B");
});

test("moveField returns unchanged array when fromIndex equals toIndex", () => {
  const fields = makeSchema("s").fields;
  const result = moveField(fields, 1, 1);
  assert.equal(result, fields);
});

// ── validateSchemaJson ────────────────────────────────────────────────────────

const validExport: SchemaExportFile = {
  "x2chess-schema": "1",
  schema: makeSchema("valid"),
};

test("validateSchemaJson accepts a valid export object", () => {
  const schema = validateSchemaJson(JSON.stringify(validExport));
  assert.equal(schema.id, "valid");
});

test("validateSchemaJson throws on invalid JSON", () => {
  assert.throws(() => validateSchemaJson("{bad json"), /Invalid JSON/);
});

test("validateSchemaJson throws when marker is missing", () => {
  const obj = { schema: makeSchema("x") };
  assert.throws(() => validateSchemaJson(JSON.stringify(obj)), /x2chess-schema/);
});

test("validateSchemaJson throws when marker has wrong value", () => {
  const obj = { "x2chess-schema": "2", schema: makeSchema("x") };
  assert.throws(() => validateSchemaJson(JSON.stringify(obj)), /x2chess-schema/);
});

test("validateSchemaJson throws when schema id is missing", () => {
  const obj = { "x2chess-schema": "1", schema: { name: "No ID", version: 1, fields: [] } };
  assert.throws(() => validateSchemaJson(JSON.stringify(obj)), /malformed/);
});

test("validateSchemaJson throws when fields is not an array", () => {
  const obj = { "x2chess-schema": "1", schema: { id: "x", name: "X", version: 1, fields: null } };
  assert.throws(() => validateSchemaJson(JSON.stringify(obj)));
});

// ── getResourceSchemaId / setResourceSchemaId ─────────────────────────────────

const makeMockStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => { store.set(key, value); },
    removeItem: (key: string): void => { store.delete(key); },
    clear: (): void => { store.clear(); },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
};

test("getResourceSchemaId returns null before any value is set", () => {
  const storage = makeMockStorage();
  const original = globalThis.localStorage;
  (globalThis as Record<string, unknown>)["localStorage"] = storage;
  try {
    assert.equal(getResourceSchemaId(makeRef()), null);
  } finally {
    (globalThis as Record<string, unknown>)["localStorage"] = original;
  }
});

test("setResourceSchemaId persists a schema id retrievable by getResourceSchemaId", () => {
  const storage = makeMockStorage();
  const original = globalThis.localStorage;
  (globalThis as Record<string, unknown>)["localStorage"] = storage;
  try {
    const ref = makeRef();
    setResourceSchemaId(ref, "schema-42");
    assert.equal(getResourceSchemaId(ref), "schema-42");
  } finally {
    (globalThis as Record<string, unknown>)["localStorage"] = original;
  }
});

test("setResourceSchemaId removes the entry when passed null", () => {
  const storage = makeMockStorage();
  const original = globalThis.localStorage;
  (globalThis as Record<string, unknown>)["localStorage"] = storage;
  try {
    const ref = makeRef();
    setResourceSchemaId(ref, "schema-42");
    setResourceSchemaId(ref, null);
    assert.equal(getResourceSchemaId(ref), null);
  } finally {
    (globalThis as Record<string, unknown>)["localStorage"] = original;
  }
});

test("different resource refs are stored under independent keys", () => {
  const storage = makeMockStorage();
  const original = globalThis.localStorage;
  (globalThis as Record<string, unknown>)["localStorage"] = storage;
  try {
    const refA = makeRef("db", "a.x2chess");
    const refB = makeRef("db", "b.x2chess");
    setResourceSchemaId(refA, "schema-a");
    setResourceSchemaId(refB, "schema-b");
    assert.equal(getResourceSchemaId(refA), "schema-a");
    assert.equal(getResourceSchemaId(refB), "schema-b");
  } finally {
    (globalThis as Record<string, unknown>)["localStorage"] = original;
  }
});
