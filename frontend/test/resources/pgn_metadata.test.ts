import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPgnMetadata,
  PGN_STANDARD_METADATA_KEYS,
} from "../../src/resources/sources/pgn_metadata.js";

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

