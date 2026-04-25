import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPgnMetadata,
  extractMultiPgnMetadata,
  extractPgnMetadataFromSource,
  KNOWN_PGN_METADATA_KEYS,
  mergeMetadataCatalogKeys,
  PGN_STANDARD_METADATA_KEYS,
} from "../src/domain/metadata";

test("extractPgnMetadataFromSource keeps every unique tag (SSOT slice)", () => {
  const pgn = `[Event "A"]
[CustomTagFromUser "hello"]
[Head "1.e4"]

*`;
  const { metadata, discoveredKeysInOrder } = extractPgnMetadataFromSource(pgn);
  assert.equal(metadata.Event, "A");
  assert.equal(metadata.CustomTagFromUser, "hello");
  assert.equal(metadata.Head, "1.e4");
  assert.deepEqual(discoveredKeysInOrder, ["Event", "CustomTagFromUser", "Head"]);
});

test("mergeMetadataCatalogKeys unions known roster with discovered keys", () => {
  const merged: string[] = mergeMetadataCatalogKeys(["Zoo", "Apple"]);
  assert.ok(merged.includes("Apple"));
  assert.ok(merged.includes("Zoo"));
  assert.ok(merged.includes("White"));
  assert.ok(merged.includes("Head"));
});

test("extractPgnMetadata narrows SSOT map to requested keys only", () => {
  const pgn = `[Event "A"]
[Noise "x"]

*`;
  const narrowed = extractPgnMetadata(pgn, ["Event"]);
  assert.equal(narrowed.metadata.Event, "A");
  assert.equal(Object.hasOwn(narrowed.metadata, "Noise"), false);
});

test("extractPgnMetadata with KNOWN_PGN_METADATA_KEYS includes Head", () => {
  const pgn = `[Event "?"]
[Head "1.e4 e5"]

1. e4 e5 *`;
  const result = extractPgnMetadata(pgn, KNOWN_PGN_METADATA_KEYS);
  assert.equal(result.metadata.Head, "1.e4 e5");
});

test("extractPgnMetadata returns normalized map and keys", () => {
  const pgn = `[Event "Rapid"]
[Site "Berlin"]
[Date "2026.03.19"]
[White "Alpha"]
[Black "Beta"]
[Result "1-0"]

1. e4 e5 2. Nf3 *`;
  const result = extractPgnMetadata(pgn);
  assert.equal(result.metadata.Event, "Rapid");
  assert.equal(result.metadata.White, "Alpha");
  assert.equal(result.metadata.Black, "Beta");
  assert.equal(result.metadata.Result, "1-0");
  assert.deepEqual(result.availableMetadataKeys, [...PGN_STANDARD_METADATA_KEYS]);
});

// ── extractMultiPgnMetadata ────────────────────────────────────────────────────

test("extractMultiPgnMetadata: single occurrence yields one-element array", () => {
  const pgn = `[Event "Club Championship"]
[White "Alice"]

1. e4 *`;
  const result = extractMultiPgnMetadata(pgn, ["Event", "White"]);
  assert.deepEqual(result["Event"], ["Club Championship"]);
  assert.deepEqual(result["White"], ["Alice"]);
});

test("extractMultiPgnMetadata: repeated key yields values in document order", () => {
  const pgn = `[White "Alice"]
[Character "aggressive"]
[Character "positional"]
[Character "endgame"]

1. e4 *`;
  const result = extractMultiPgnMetadata(pgn, ["Character"]);
  assert.deepEqual(result["Character"], ["aggressive", "positional", "endgame"]);
});

test("extractMultiPgnMetadata: absent key yields empty array", () => {
  const pgn = `[White "Alice"]

1. e4 *`;
  const result = extractMultiPgnMetadata(pgn, ["Character"]);
  assert.deepEqual(result["Character"], []);
});

test("extractMultiPgnMetadata: returns only requested keys", () => {
  const pgn = `[White "Alice"]
[Character "aggressive"]
[Event "Blitz"]

*`;
  const result = extractMultiPgnMetadata(pgn, ["Character"]);
  assert.ok(!Object.hasOwn(result, "White"));
  assert.ok(!Object.hasOwn(result, "Event"));
  assert.deepEqual(result["Character"], ["aggressive"]);
});

test("extractMultiPgnMetadata: empty key list returns empty object", () => {
  const pgn = `[White "Alice"]

*`;
  const result = extractMultiPgnMetadata(pgn, []);
  assert.deepEqual(result, {});
});

test("extractMultiPgnMetadata: single-value extractPgnMetadata still picks first occurrence", () => {
  const pgn = `[Character "aggressive"]
[Character "positional"]

*`;
  // The single-value extractor must not be affected by repeated headers.
  const result = extractPgnMetadata(pgn, ["Character"]);
  assert.equal(result.metadata["Character"], "aggressive");
});

