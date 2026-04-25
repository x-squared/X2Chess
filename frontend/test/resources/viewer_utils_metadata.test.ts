/**
 * Tests for resource viewer metadata column helpers (`insertMetadataColumnFromSchema`,
 * `removeMetadataColumnFromTab`).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILT_IN_SCHEMA,
  LEGACY_X2_STYLE_METADATA_KEY,
  LEGACY_XTWOCHESS_STYLE_METADATA_KEY,
  X2CHESS_STYLE_METADATA_KEY,
} from "../../../parts/resource/src/domain/metadata_schema.js";
import {
  insertMetadataColumnFromSchema,
  listAddableMetadataFields,
  reconcileColumns,
  removeMetadataColumnFromTab,
  type TabState,
} from "../../src/features/resources/services/viewer_utils.js";

const baseTab = (): TabState =>
  reconcileColumns({
    tabId: "t1",
    title: "",
    resourceRef: { kind: "file", locator: "/" },
    rows: [],
    availableMetadataKeys: [],
    visibleMetadataKeys: ["White", "Black", "Date"],
    metadataColumnOrder: ["game", "White", "Black", "Date"],
    columnWidths: {},
    errorMessage: "",
    isLoading: false,
  });

test("removeMetadataColumnFromTab leaves only game when last metadata column removed", (): void => {
  const tab: TabState = reconcileColumns({
    tabId: "t1",
    title: "",
    resourceRef: { kind: "file", locator: "/" },
    rows: [],
    availableMetadataKeys: [],
    visibleMetadataKeys: ["White"],
    metadataColumnOrder: ["game", "White"],
    columnWidths: {},
    errorMessage: "",
    isLoading: false,
  });
  const after: TabState = removeMetadataColumnFromTab(tab, "White");
  assert.deepEqual(after.metadataColumnOrder, ["game"]);
  assert.deepEqual(after.visibleMetadataKeys, []);
});

test("insertMetadataColumnFromSchema inserts before first column with higher orderIndex", (): void => {
  const tab: TabState = baseTab();
  const updated: TabState = insertMetadataColumnFromSchema(tab, "Event", BUILT_IN_SCHEMA);
  assert.deepEqual(updated.visibleMetadataKeys, ["White", "Black", "Event", "Date"]);
  assert.deepEqual(updated.metadataColumnOrder, ["game", "White", "Black", "Event", "Date"]);
});

test("insertMetadataColumnFromSchema inserts Result before ECO when both absent", (): void => {
  const tab: TabState = reconcileColumns({
    ...baseTab(),
    visibleMetadataKeys: ["White", "Black", "ECO"],
    metadataColumnOrder: ["game", "White", "Black", "ECO"],
  });
  const updated: TabState = insertMetadataColumnFromSchema(tab, "Result", BUILT_IN_SCHEMA);
  assert.deepEqual(updated.visibleMetadataKeys, ["White", "Black", "Result", "ECO"]);
});

test("insertMetadataColumnFromSchema no-op when key unknown or duplicate", (): void => {
  const tab: TabState = baseTab();
  const unknown: TabState = insertMetadataColumnFromSchema(tab, "NotATag", BUILT_IN_SCHEMA);
  assert.equal(unknown, tab);
  const dup: TabState = insertMetadataColumnFromSchema(tab, "White", BUILT_IN_SCHEMA);
  assert.equal(dup, tab);
});

test("listAddableMetadataFields exposes full built-in catalog including X2 tags", (): void => {
  const addable = listAddableMetadataFields(BUILT_IN_SCHEMA, ["game", "White", "Black"], []);
  const keys: string[] = addable.map((f) => f.key);
  assert.ok(keys.includes("Termination"));
  assert.ok(keys.includes(X2CHESS_STYLE_METADATA_KEY));
  assert.ok(keys.includes("Material"));
  assert.ok(keys.includes("Head"));
});

test("listAddableMetadataFields includes discovered custom header keys", (): void => {
  const addable = listAddableMetadataFields(
    BUILT_IN_SCHEMA,
    ["game", "White"],
    ["CustomTag", "AnotherTag"],
  );
  const keys: string[] = addable.map((f) => f.key);
  assert.ok(keys.includes("CustomTag"));
  assert.ok(keys.includes("AnotherTag"));
});

test("insertMetadataColumnFromSchema inserts a discovered-only header key", (): void => {
  const tab: TabState = baseTab();
  const upd: TabState = insertMetadataColumnFromSchema(tab, "ZetaTag", BUILT_IN_SCHEMA, ["ZetaTag"]);
  assert.ok(upd.visibleMetadataKeys.includes("ZetaTag"));
});

test("listAddableMetadataFields omits legacy style header keys and is label-sorted", (): void => {
  const addable = listAddableMetadataFields(
    BUILT_IN_SCHEMA,
    ["game"],
    ["ZTag", LEGACY_XTWOCHESS_STYLE_METADATA_KEY, LEGACY_X2_STYLE_METADATA_KEY],
  );
  const keys: string[] = addable.map((f) => f.key);
  assert.ok(!keys.includes(LEGACY_XTWOCHESS_STYLE_METADATA_KEY));
  assert.ok(!keys.includes(LEGACY_X2_STYLE_METADATA_KEY));
  assert.ok(keys.includes("ZTag"));
  assert.ok(keys.includes(X2CHESS_STYLE_METADATA_KEY));
  const labels: string[] = addable.map((f) => f.label);
  const sorted: string[] = [...labels].sort((a: string, b: string): number =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  assert.deepEqual(labels, sorted);
});
