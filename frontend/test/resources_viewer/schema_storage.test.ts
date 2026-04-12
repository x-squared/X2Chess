import test from "node:test";
import assert from "node:assert/strict";
import {
  findSchema,
  upsertSchema,
  deleteSchema,
  exportSchemaToJson,
  validateSchemaJson,
  renumberFields,
  moveField,
} from "../../src/features/resources/services/schema_storage.js";
import type { MetadataSchema, MetadataFieldDefinition } from "../../../parts/resource/src/domain/metadata_schema.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeField = (key: string, orderIndex = 10): MetadataFieldDefinition => ({
  key,
  label: key,
  type: "text",
  required: false,
  orderIndex,
});

const makeSchema = (id: string, name = "Schema"): MetadataSchema => ({
  id,
  name,
  version: 1,
  fields: [makeField("Event", 10), makeField("Round", 20)],
});

// ── findSchema ─────────────────────────────────────────────────────────────────

test("findSchema — returns null for empty array", () => {
  assert.equal(findSchema([], "abc"), null);
});

test("findSchema — returns null for unknown id", () => {
  const schemas = [makeSchema("aaa"), makeSchema("bbb")];
  assert.equal(findSchema(schemas, "ccc"), null);
});

test("findSchema — returns matching schema", () => {
  const s = makeSchema("target");
  const schemas = [makeSchema("other"), s];
  assert.equal(findSchema(schemas, "target"), s);
});

// ── upsertSchema ──────────────────────────────────────────────────────────────

test("upsertSchema — inserts new schema when id not present", () => {
  const existing = [makeSchema("a")];
  const newSchema = makeSchema("b");
  const result = upsertSchema(existing, newSchema);
  assert.equal(result.length, 2);
  assert.ok(result.some((s) => s.id === "b"));
});

test("upsertSchema — replaces existing schema with same id", () => {
  const old = makeSchema("x", "Old Name");
  const updated = makeSchema("x", "New Name");
  const result = upsertSchema([old], updated);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.name, "New Name");
});

test("upsertSchema — does not mutate the input array", () => {
  const schemas = [makeSchema("a")];
  upsertSchema(schemas, makeSchema("b"));
  assert.equal(schemas.length, 1);
});

// ── deleteSchema ──────────────────────────────────────────────────────────────

test("deleteSchema — removes schema with matching id", () => {
  const schemas = [makeSchema("a"), makeSchema("b"), makeSchema("c")];
  const result = deleteSchema(schemas, "b");
  assert.equal(result.length, 2);
  assert.ok(!result.some((s) => s.id === "b"));
});

test("deleteSchema — returns unchanged array when id not found", () => {
  const schemas = [makeSchema("a")];
  const result = deleteSchema(schemas, "x");
  assert.equal(result.length, 1);
});

test("deleteSchema — does not mutate input", () => {
  const schemas = [makeSchema("a")];
  deleteSchema(schemas, "a");
  assert.equal(schemas.length, 1);
});

// ── exportSchemaToJson / validateSchemaJson ────────────────────────────────────

test("exportSchemaToJson + validateSchemaJson — round-trip preserves schema", () => {
  const schema = makeSchema("round-trip-id", "My Schema");
  const json = exportSchemaToJson(schema);
  const parsed = validateSchemaJson(json);
  assert.equal(parsed.id, schema.id);
  assert.equal(parsed.name, schema.name);
  assert.equal(parsed.fields.length, schema.fields.length);
});

test("validateSchemaJson — throws on invalid JSON", () => {
  assert.throws(() => validateSchemaJson("not json"), /Invalid JSON/);
});

test("validateSchemaJson — throws when x2chess-schema marker is missing", () => {
  const json = JSON.stringify({ schema: makeSchema("x") });
  assert.throws(() => validateSchemaJson(json), /Not a valid/);
});

test("validateSchemaJson — throws when schema is malformed", () => {
  const json = JSON.stringify({ "x2chess-schema": "1", schema: { id: 123 } });
  assert.throws(() => validateSchemaJson(json), /malformed/);
});

test("validateSchemaJson — throws when fields is not an array", () => {
  const json = JSON.stringify({ "x2chess-schema": "1", schema: { id: "x", name: "N", fields: null } });
  assert.throws(() => validateSchemaJson(json), /malformed/);
});

// ── renumberFields ─────────────────────────────────────────────────────────────

test("renumberFields — assigns 10, 20, 30, … in order", () => {
  const fields = [makeField("A", 5), makeField("B", 999), makeField("C", 1)];
  const result = renumberFields(fields);
  assert.equal(result[0]!.orderIndex, 10);
  assert.equal(result[1]!.orderIndex, 20);
  assert.equal(result[2]!.orderIndex, 30);
});

test("renumberFields — preserves key/label/type values", () => {
  const fields = [makeField("Event", 5)];
  const result = renumberFields(fields);
  assert.equal(result[0]!.key, "Event");
});

test("renumberFields — does not mutate input", () => {
  const fields = [makeField("A", 5)];
  renumberFields(fields);
  assert.equal(fields[0]!.orderIndex, 5);
});

// ── moveField ─────────────────────────────────────────────────────────────────

test("moveField — moves field from index 0 to index 2", () => {
  const fields = [makeField("A"), makeField("B"), makeField("C")];
  const result = moveField(fields, 0, 2);
  assert.equal(result[0]!.key, "B");
  assert.equal(result[1]!.key, "C");
  assert.equal(result[2]!.key, "A");
});

test("moveField — renumbers after move", () => {
  const fields = [makeField("A", 10), makeField("B", 20), makeField("C", 30)];
  const result = moveField(fields, 2, 0);
  assert.equal(result[0]!.orderIndex, 10);
  assert.equal(result[1]!.orderIndex, 20);
  assert.equal(result[2]!.orderIndex, 30);
});

test("moveField — same index returns unchanged array", () => {
  const fields = [makeField("A"), makeField("B")];
  const result = moveField(fields, 1, 1);
  assert.equal(result[0]!.key, "A");
  assert.equal(result[1]!.key, "B");
});
