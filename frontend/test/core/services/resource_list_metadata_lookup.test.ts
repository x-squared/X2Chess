/**
 * Tests for list-row metadata lookup by record id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findResourceRowMetadataByRecordId, normalizeResourceMetadataRow } from "../../../src/core/services/resource_list_metadata_lookup";

test("findResourceRowMetadataByRecordId matches sourceRef.recordId", () => {
  const rows: unknown[] = [
    {
      sourceRef: { kind: "db", locator: "/x.x2chess", recordId: "a" },
      metadata: { Type: "Opening", Opening: "A from row" },
    },
    {
      sourceRef: { kind: "db", locator: "/x.x2chess", recordId: "b" },
      metadata: { Type: "Model Game" },
    },
  ];
  const m: Record<string, string> | null = findResourceRowMetadataByRecordId(rows, "a");
  assert.equal(m?.Type, "Opening");
  assert.equal(m?.Opening, "A from row");
});

test("findResourceRowMetadataByRecordId matches identifier", () => {
  const rows: unknown[] = [
    { sourceRef: { recordId: "x" }, identifier: "y", metadata: { Event: "E" } },
  ];
  const m1: Record<string, string> | null = findResourceRowMetadataByRecordId(rows, "y");
  assert.equal(m1?.Event, "E");
});

test("normalizeResourceMetadataRow flattens primitives", () => {
  const m: Record<string, string> = normalizeResourceMetadataRow({
    a: "1",
    b: 2,
    c: true,
  } as unknown);
  assert.equal(m.a, "1");
  assert.equal(m.b, "2");
  assert.equal(m.c, "true");
});

test("normalizeResourceMetadataRow uses first non-empty string from string[] values", () => {
  const m: Record<string, string> = normalizeResourceMetadataRow({
    Opening: ["", "London", "x"],
  } as unknown);
  assert.equal(m.Opening, "London");
});
