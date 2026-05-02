/**
 * Regression: reference chips resolve loaded rows by record id / identifier
 * so they can reuse the same GRP output as the Game column.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecordIdToRowMap, type ResourceRow } from "../../../../src/features/resources/services/viewer_utils";

const makeRow = (id: string, recordId: string, white: string): ResourceRow => ({
  game: `${white} – X`,
  kind: "game",
  identifier: id,
  source: "db",
  revision: "1",
  metadata: { White: white, Type: "study" },
  sourceRef: { kind: "db", locator: "/a", recordId },
});

test("buildRecordIdToRowMap: lookup by sourceRef.recordId", () => {
  const a: ResourceRow = makeRow("i1", "r-99", "A");
  const m: Map<string, ResourceRow> = buildRecordIdToRowMap([a]);
  assert.equal(m.get("r-99"), a);
  assert.equal(m.get("i1"), a);
});

test("buildRecordIdToRowMap: distinct identifier and recordId both map to row", () => {
  const a: ResourceRow = makeRow("i1", "r-2", "B");
  const m: Map<string, ResourceRow> = buildRecordIdToRowMap([a]);
  assert.equal(m.get("r-2"), a);
  assert.equal(m.get("i1"), a);
});
