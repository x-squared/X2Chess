import test from "node:test";
import assert from "node:assert/strict";
import { resolveInheritedMetadata } from "../src/domain/metadata_inheritance";
import type { PgnGameEntry } from "../src/domain/game_entry";
import type { MetadataSchema } from "../src/domain/metadata_schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeEntry = (
  recordId: string,
  metadata: Record<string, string | string[]>,
): PgnGameEntry => ({
  gameRef: { kind: "db", locator: "test.x2chess", recordId },
  title: recordId,
  revisionToken: "r",
  metadata,
  availableMetadataKeys: Object.keys(metadata),
});

const schema = (fields: MetadataSchema["fields"]): MetadataSchema => ({
  id: "test",
  name: "Test",
  version: 1,
  fields,
});

// ── No-op cases ───────────────────────────────────────────────────────────────

test("returns entries unchanged when schema has no reference fields", () => {
  const entries = [makeEntry("a", { ECO: "B22" })];
  const s = schema([{ key: "ECO", label: "ECO", type: "text", required: false, orderIndex: 10, referenceable: true }]);
  const result = resolveInheritedMetadata(entries, s);
  assert.equal(result, entries);
});

test("returns entries unchanged when schema has no referenceable fields", () => {
  const entries = [makeEntry("a", { ModelFor: "b" })];
  const s = schema([{ key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 }]);
  const result = resolveInheritedMetadata(entries, s);
  assert.equal(result, entries);
});

test("returns entries unchanged when no game has a reference value set", () => {
  const entries = [
    makeEntry("a", { ECO: "" }),
    makeEntry("b", { ECO: "B22" }),
  ];
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO", label: "ECO", type: "text", required: false, orderIndex: 20, referenceable: true },
  ]);
  const result = resolveInheritedMetadata(entries, s);
  assert.equal(result, entries);
});

// ── Basic inheritance ─────────────────────────────────────────────────────────

test("inherits a missing referenceable field from the referenced game", () => {
  const opening = makeEntry("opening-1", { ECO: "B22", Opening: "Sicilian" });
  const model   = makeEntry("model-1",   { ModelFor: "opening-1" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
    { key: "Opening",  label: "Opening",   type: "text",      required: false, orderIndex: 30, referenceable: true },
  ]);
  const [resultOpening, resultModel] = resolveInheritedMetadata([opening, model], s);
  assert.equal(resultOpening, opening);
  assert.equal(resultModel!.metadata.ECO, "B22");
  assert.equal(resultModel!.metadata.Opening, "Sicilian");
});

test("local value takes precedence over inherited value", () => {
  const opening = makeEntry("opening-1", { ECO: "B22" });
  const model   = makeEntry("model-1",   { ModelFor: "opening-1", ECO: "A00" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const [, resultModel] = resolveInheritedMetadata([opening, model], s);
  assert.equal(resultModel!.metadata.ECO, "A00");
});

test("entry with all referenceable fields set locally is returned unchanged", () => {
  const opening = makeEntry("opening-1", { ECO: "B22" });
  const model   = makeEntry("model-1",   { ModelFor: "opening-1", ECO: "A00" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const [, resultModel] = resolveInheritedMetadata([opening, model], s);
  assert.equal(resultModel, model);
});

test("broken reference (target not in entries) leaves fields blank", () => {
  const model = makeEntry("model-1", { ModelFor: "no-such-id" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const [resultModel] = resolveInheritedMetadata([model], s);
  assert.equal(resultModel, model);
});

// ── Chain traversal ───────────────────────────────────────────────────────────

test("follows a two-hop chain when first hop is missing the field", () => {
  const root       = makeEntry("root",   { ECO: "B22" });
  const middle     = makeEntry("middle", { ModelFor: "root" });        // no ECO
  const leaf       = makeEntry("leaf",   { ModelFor: "middle" });      // no ECO
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const results = resolveInheritedMetadata([root, middle, leaf], s);
  assert.equal(results[1]!.metadata.ECO, "B22");  // middle inherits from root
  assert.equal(results[2]!.metadata.ECO, "B22");  // leaf follows middle → root
});

test("stops at MAX_INHERITANCE_DEPTH (3) and does not resolve beyond", () => {
  // chain: hop4 → hop3 → hop2 → hop1 → root; hop4 is 4 hops from root
  const root = makeEntry("root", { ECO: "B22" });
  const hop1 = makeEntry("hop1", { ModelFor: "root" });
  const hop2 = makeEntry("hop2", { ModelFor: "hop1" });
  const hop3 = makeEntry("hop3", { ModelFor: "hop2" });
  const hop4 = makeEntry("hop4", { ModelFor: "hop3" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const results = resolveInheritedMetadata([root, hop1, hop2, hop3, hop4], s);
  assert.equal(results[1]!.metadata.ECO, "B22");  // hop1 (depth 1) — resolved
  assert.equal(results[2]!.metadata.ECO, "B22");  // hop2 (depth 2) — resolved
  assert.equal(results[3]!.metadata.ECO, "B22");  // hop3 (depth 3) — resolved
  assert.equal(results[4]!.metadata.ECO, undefined); // hop4 (depth 4) — truncated
});

// ── Cycle detection ───────────────────────────────────────────────────────────

test("direct self-reference does not loop", () => {
  const game = makeEntry("a", { ModelFor: "a" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const [result] = resolveInheritedMetadata([game], s);
  assert.equal(result, game);
});

test("mutual cycle (a → b → a) does not loop", () => {
  const a = makeEntry("a", { ModelFor: "b" });
  const b = makeEntry("b", { ModelFor: "a" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  assert.doesNotThrow(() => resolveInheritedMetadata([a, b], s));
});

// ── Multi-valued fields ───────────────────────────────────────────────────────

test("inherits a string-array referenceable field from the referenced game", () => {
  const opening = makeEntry("opening-1", { Tags: ["sicilian", "open"] });
  const model   = makeEntry("model-1",   { ModelFor: "opening-1" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "Tags",     label: "Tags",      type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const [, resultModel] = resolveInheritedMetadata([opening, model], s);
  assert.deepEqual(resultModel.metadata.Tags, ["sicilian", "open"]);
});

test("empty-array referenceable field is treated as missing and inherits", () => {
  const opening = makeEntry("opening-1", { Tags: ["sicilian"] });
  const model   = makeEntry("model-1",   { ModelFor: "opening-1", Tags: [] });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "Tags",     label: "Tags",      type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const [, resultModel] = resolveInheritedMetadata([opening, model], s);
  assert.deepEqual(resultModel.metadata.Tags, ["sicilian"]);
});

// ── Multiple reference fields ─────────────────────────────────────────────────

test("first reference field with a value is followed when multiple reference fields exist", () => {
  const opening   = makeEntry("opening-1", { ECO: "B22" });
  const variation = makeEntry("var-1",     { ECO: "B23" });
  const model     = makeEntry("model-1",   { ModelFor: "opening-1", AltRef: "var-1" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "AltRef",   label: "Alt ref",   type: "reference", required: false, orderIndex: 20 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 30, referenceable: true },
  ]);
  const results = resolveInheritedMetadata([opening, variation, model], s);
  assert.equal(results[2]!.metadata.ECO, "B22");
});

test("falls back to second reference field when first is empty", () => {
  const variation = makeEntry("var-1",   { ECO: "B23" });
  const model     = makeEntry("model-1", { ModelFor: "", AltRef: "var-1" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "AltRef",   label: "Alt ref",   type: "reference", required: false, orderIndex: 20 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 30, referenceable: true },
  ]);
  const results = resolveInheritedMetadata([variation, model], s);
  assert.equal(results[1]!.metadata.ECO, "B23");
});

// ── Entry without recordId ────────────────────────────────────────────────────

test("entry with empty recordId is excluded from the metaMap and treated as a broken reference", () => {
  const noId = makeEntry("", { ECO: "B22" });
  const model = makeEntry("model-1", { ModelFor: "" });
  const s = schema([
    { key: "ModelFor", label: "Model for", type: "reference", required: false, orderIndex: 10 },
    { key: "ECO",      label: "ECO",       type: "text",      required: false, orderIndex: 20, referenceable: true },
  ]);
  const entries = [noId, model];
  const result = resolveInheritedMetadata(entries, s);
  assert.equal(result, entries);
});
