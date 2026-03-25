# Material Key — Searchable Material Balance Field

**Goal**: Add `Material` as a derived, searchable metadata field for position games
(games that start from a non-standard FEN). The key is computed at import/list time
from the `[FEN "..."]` PGN header — never stored in PGN text, never requiring move replay.

---

## Representation

```
KQPPPvKRP
```

- White side: `K` first, then remaining white pieces sorted by value descending
  (Q=9, R=5, B=3, N=3, P=1; ties broken alphabetically so `B` before `N`).
- Separator: literal `v`.
- Black side: same ordering, lower-case in the FEN but stored as upper-case in the key.
- Example: endgame K+Q+3P vs K+R+P → `KQPPPvKRP`.
- Substring-searchable: `KQv` matches any position where white has K+Q.

**Scope rule**: `Material` is only computed and stored when the game has a
`[SetUp "1"]` header (i.e. `kind === "position"`). For standard starting-position
games the field is absent, which is the correct behaviour — filtering by material
only makes sense over position collections.

---

## Architecture fit

| Layer | Change |
|---|---|
| `resource/domain/material_key.ts` (new) | Pure `materialKeyFromFen(fen)` function |
| `resource/domain/metadata_schema.ts` | Register `Material` key + parser |
| `resource/domain/metadata.ts` | Re-export `Material` key constant |
| `resource/adapters/db/db_indexer.ts` | Write `Material` row when indexing a position game |
| `frontend/src/resources/source_picker_adapter.ts` | Augment metadata payload for directory/file listing |
| `frontend/src/resources_viewer/viewer_utils.ts` | Add `Material` to canonical column order |
| `frontend/test/` | Unit tests for `materialKeyFromFen` |

No DB migration required — `game_metadata` is already a generic key/value table
with an index on `(meta_key, val_str)`.

---

## Items

### Item 1 — Pure `materialKeyFromFen` function

**File**: `resource/domain/material_key.ts` (new)

Algorithm:
1. Split FEN string on whitespace; take field 0 (piece placement).
2. Collect white pieces (uppercase letters Q/R/B/N/P/K) and black pieces
   (lowercase, converted to uppercase).
3. For each side: extract K count (always 1), sort remaining pieces by value desc
   then alpha for ties.
4. Format: `K` + sorted white + `v` + `K` + sorted black.
5. Return `""` for invalid/empty FEN.

Exports: `materialKeyFromFen(fen: string): string`.

---

### Item 2 — Schema registration

**File**: `resource/domain/metadata_schema.ts`

- Add `Material?: string` to `PgnMetadataKnownValues`.
- Add `Material: "Material"` to `METADATA_KEY` const map.
- Add `"Material"` to `KNOWN_PGN_METADATA_KEYS`.
- Add `Material: { key: "Material", parse: parseStringValue }` to `PGN_METADATA_SCHEMA`.

Do **not** add `Material` to `PGN_STANDARD_METADATA_KEYS` (it is derived, not a
standard PGN header). Do **not** add it to `BUILT_IN_SCHEMA` fields — it shows up
in the viewer's available key catalog via `metadata_keys` table (DB path) or
`availableMetadataKeys` array (directory path) rather than through the schema editor.

---

### Item 3 — DB indexer integration

**File**: `resource/adapters/db/db_indexer.ts`

In `writeMetadata`, after the loop over standard metadata keys:

```ts
// Derive Material for position games (FEN header present + SetUp "1")
const fenValue = metadata["FEN"] || headers["FEN"];  // already parsed above
const isPosition = /\[SetUp\s+"1"\]/i.test(pgnText);
if (isPosition && fenValue) {
  const materialKey = materialKeyFromFen(fenValue);
  if (materialKey) {
    await db.execute(
      "INSERT OR REPLACE INTO game_metadata (game_id, meta_key, val_str) VALUES (?, ?, ?)",
      [gameId, "Material", materialKey],
    );
    await db.execute(
      "INSERT OR IGNORE INTO metadata_keys (key, value_type) VALUES (?, 'string')",
      ["Material"],
    );
  }
}
```

Note: `writeMetadata` already calls `extractPgnMetadata` which returns a plain
string map. The `FEN` key must be included in the extraction. Currently
`metadataKeys` defaults to `PGN_STANDARD_METADATA_KEYS` which does not include
`FEN`. Two options:

**Chosen approach**: call `parseHeaderLines` (inline or extract) separately for
just the `FEN` key, or pass a custom key list that includes `FEN`. Simplest: add
a second `extractPgnMetadata` call inside the new block that passes `["FEN"]` as
`metadataKeys`, then read `metadata["FEN"]`.

---

### Item 4 — Directory/file path

**File**: `frontend/src/resources/source_picker_adapter.ts`

After the existing `metadataPayload = extractPgnMetadata(...)` calls, augment the
payload:

```ts
const fenHeader = metadataPayload.metadata["FEN"]
  ?? extractPgnMetadata(pgnText, ["FEN"]).metadata["FEN"];
const isPosition = /\[SetUp\s+"1"\]/i.test(pgnText);
if (isPosition && fenHeader) {
  const materialKey = materialKeyFromFen(fenHeader);
  if (materialKey) {
    metadataPayload.metadata["Material"] = materialKey;
    if (!metadataPayload.availableMetadataKeys.includes("Material")) {
      metadataPayload.availableMetadataKeys.push("Material");
    }
  }
}
```

This ensures directory/file-backed resources present `Material` in exactly the
same way as DB-backed ones without any additional I/O.

---

### Item 5 — Resource viewer canonical order

**File**: `frontend/src/resources_viewer/viewer_utils.ts`

Insert `"Material"` into `METADATA_CANONICAL_ORDER` between `"Result"` and
`"Opening"`:

```ts
export const METADATA_CANONICAL_ORDER: readonly string[] = [
  "White", "WhiteElo", "Black", "BlackElo", "Result", "Material", "Opening", "ECO", "Event", "Date",
];
```

---

### Item 6 — Tests

**File**: `frontend/test/resource/domain/material_key.test.ts` (new)

Cases to cover:
- Standard starting position FEN → `""` (no position game, but also the material
  would be `KQRRBBNNPPPPPPPPvKQRRBBNNPPPPPPPP` — actually the function itself
  doesn't know if it's a position game; it just computes the key from whatever FEN).
  Test that the function returns a well-formed string for a full-board FEN.
- K vs K endgame → `KvK`
- K+Q+3P vs K+R+P → `KQPPPvKRP`
- K+B+N vs K endgame → `KBNvK`
- Empty / invalid FEN → `""`
- FEN with only kings on each side → `KvK`

---

## Acceptance criteria

- `materialKeyFromFen` passes all unit tests.
- Importing a position-game PGN into a DB resource produces a `Material` row in
  `game_metadata`.
- Listing a directory of position PGN files includes `Material` in
  `availableMetadataKeys` and in each entry's `metadata` map.
- The resource viewer shows `Material` as an available column for position
  collections; substring filter (if/when implemented) works because the DB index
  covers `(meta_key, val_str)`.
- Standard full-game resources have no `Material` key — the field is absent, not
  empty.
- `npm run typecheck` passes; `npm test` passes.
