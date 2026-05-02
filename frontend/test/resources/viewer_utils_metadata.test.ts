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
  clampGameIdColumnWidth,
  insertMetadataColumnFromSchema,
  listAddableMetadataFields,
  MAX_GAME_ID_COL_WIDTH_PX,
  MIN_GAME_ID_COL_WIDTH_PX,
  reconcileColumns,
  removeMetadataColumnFromTab,
  type TabState,
} from "../../src/features/resources/services/viewer_utils.js";

const loadedTab = (partial: Partial<TabState> & Pick<TabState, "visibleMetadataKeys" | "metadataColumnOrder">): TabState =>
  reconcileColumns({
    tabId: "t1",
    title: "",
    resourceRef: { kind: "file", locator: "/" },
    loadState: { status: "loaded", rows: [], availableMetadataKeys: [] },
    columnWidths: {},
    ...partial,
  });

const baseTab = (): TabState =>
  loadedTab({
    visibleMetadataKeys: ["White", "Black", "Date"],
    metadataColumnOrder: ["game", "White", "Black", "Date"],
  });

test("clampGameIdColumnWidth keeps game id column narrow", (): void => {
  assert.equal(clampGameIdColumnWidth(500), MAX_GAME_ID_COL_WIDTH_PX);
  assert.equal(clampGameIdColumnWidth(10), MIN_GAME_ID_COL_WIDTH_PX);
});

test("removeMetadataColumnFromTab leaves only game when last metadata column removed", (): void => {
  const tab: TabState = loadedTab({
    visibleMetadataKeys: ["White"],
    metadataColumnOrder: ["game", "White"],
  });
  const after: TabState = removeMetadataColumnFromTab(tab, "White");
  assert.deepEqual(after.metadataColumnOrder, ["game"]);
  assert.deepEqual(after.visibleMetadataKeys, []);
});

test("removeMetadataColumnFromTab can remove optional game column", (): void => {
  const tab: TabState = loadedTab({
    visibleMetadataKeys: ["White"],
    metadataColumnOrder: ["game", "White"],
  });
  const after: TabState = removeMetadataColumnFromTab(tab, "game");
  assert.deepEqual(after.metadataColumnOrder, ["White"]);
  assert.deepEqual(after.visibleMetadataKeys, ["White"]);
});

test("insertMetadataColumnFromSchema inserts before first column with higher orderIndex", (): void => {
  const tab: TabState = baseTab();
  const updated: TabState = insertMetadataColumnFromSchema(tab, "Event", BUILT_IN_SCHEMA);
  assert.deepEqual(updated.visibleMetadataKeys, ["White", "Black", "Event", "Date"]);
  assert.deepEqual(updated.metadataColumnOrder, ["game", "White", "Black", "Event", "Date"]);
});

test("insertMetadataColumnFromSchema does not add game when tab had no game column", (): void => {
  const tab: TabState = loadedTab({
    visibleMetadataKeys: ["Black"],
    metadataColumnOrder: ["Black"],
  });
  const updated: TabState = insertMetadataColumnFromSchema(tab, "White", BUILT_IN_SCHEMA);
  assert.ok(!updated.metadataColumnOrder.includes("game"));
});

test("insertMetadataColumnFromSchema inserts Result before ECO when both absent", (): void => {
  const tab: TabState = loadedTab({
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

test("insertMetadataColumnFromSchema can restore game column", (): void => {
  const tab: TabState = loadedTab({
    visibleMetadataKeys: ["White"],
    metadataColumnOrder: ["White"],
  });
  const updated: TabState = insertMetadataColumnFromSchema(tab, "game", BUILT_IN_SCHEMA);
  assert.deepEqual(updated.metadataColumnOrder[0], "game");
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

test("listAddableMetadataFields includes game when column hidden", (): void => {
  const addable = listAddableMetadataFields(BUILT_IN_SCHEMA, ["White", "Black"], []);
  assert.equal(addable[0]?.key, "game");
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
