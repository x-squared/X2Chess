# Plan: ECO Opening Code Derivation

**Status:** Draft
**Priority:** Medium
**Dependencies:** PGN model (move list available), resource library (optional persistence)

---

## Goal

Given the move list of a game, derive the deepest matching ECO (Encyclopaedia of Chess Openings) code and opening name. Display this in:
- The game tab / game info header
- The resource viewer's "Opening" column
- The metadata editor (read-only field, auto-populated)

---

## Background

ECO codes cover A00–E99 (500 named codes, each with one canonical line and many transpositions). The standard approach is a **trie/prefix lookup**: store all known lines as move sequences, walk the game's moves depth-first, keep the last matched ECO entry.

ECO data is publicly available (e.g. the `chess-openings` dataset, PGN-based ECO files from Scid). The dataset has ~3,000 named lines as SAN sequences.

---

## Data format

Store ECO data as a compact embedded JSON file at:

```
frontend/src/resources/eco/eco_data.json
```

Shape:
```json
[
  { "eco": "A00", "name": "Uncommon Opening", "moves": [] },
  { "eco": "A00", "name": "Anderssen's Opening", "moves": ["a3"] },
  { "eco": "B20", "name": "Sicilian Defence", "moves": ["e4", "c5"] },
  ...
]
```

- `moves` is an array of SAN strings (move 1 white, move 1 black, move 2 white, …)
- Entries are sorted by increasing move-list length (shallow → deep)
- ~3,000 entries; compressed JSON is ~120 KB, well within bundle budget

**Source**: adapt from `hayatbirazkisa/chess-openings` or `niklasf/scalachess` ECO PGN files. A one-time conversion script (`scripts/build_eco_json.ts`) produces `eco_data.json` from the source PGN.

---

## Architecture

### Phase E1 — Data preparation (offline, one-time)

1. Write `scripts/build_eco_json.ts`:
   - Reads ECO PGN files (input directory configurable)
   - Parses `[ECO "..."]`, `[Opening "..."]`, `[Variation "..."]` headers + move text
   - Outputs `frontend/src/resources/eco/eco_data.json`
2. Commit the generated `eco_data.json` (no runtime dependency on PGN source).

### Phase E2 — Pure-logic matcher

File: `frontend/src/resources/eco/eco_lookup.ts`

```typescript
/** A single ECO entry. */
export type EcoEntry = {
  eco: string;   // "B20"
  name: string;  // "Sicilian Defence"
  moves: string[]; // SAN sequence
};

/** Result of a lookup. */
export type EcoMatch = {
  eco: string;
  name: string;
  depth: number; // number of moves matched
};

/**
 * Build a lookup function from the ECO dataset.
 * Call once at startup; the returned function is O(moves.length).
 */
export function buildEcoLookup(entries: EcoEntry[]): (moves: string[]) => EcoMatch | null;
```

Implementation strategy — **sorted prefix scan** (simpler than a trie for this size):
1. Sort entries by `moves.length` ascending (already guaranteed by JSON build order).
2. For a given game move list, walk entries. An entry matches iff every entry move equals the corresponding game move.
3. Track the deepest match found so far; return it at the end.

This is O(entries × depth) ≈ O(3000 × 20) = 60,000 comparisons — fast enough for on-demand calls.

**Alternative (optional future optimisation)**: build a trie on startup for O(depth) lookup. Only needed if called on bulk imports of thousands of games.

**Module constraints**: pure TypeScript, no React, no DOM. Imports only `eco_data.json` (static asset, bundled by Vite).

### Phase E3 — Integration point

File: `frontend/src/resources/eco/index.ts` — re-exports `buildEcoLookup`, `EcoEntry`, `EcoMatch`.

Initialise once in `createAppServices.ts`:
```typescript
import ecoData from "../resources/eco/eco_data.json";
import { buildEcoLookup } from "../resources/eco/eco_lookup";

const lookupEco = buildEcoLookup(ecoData);
```

Expose via `ServiceContext` or pass directly to components that need it.

### Phase E4 — UI display

**Game info header / GameInfoEditor:**
- Add a read-only `eco` field: `"B20 · Sicilian Defence"`.
- Derived reactively: whenever the move list changes, call `lookupEco(sanMoves)`.
- Computed in a selector (`selectEco`) or inside the component with `useMemo`.

**Resource viewer column:**
- Add `"Opening"` column to the game list table.
- Column value comes from `lookupEco` applied to the game's stored move list.
- For large collections this should be computed lazily (on scroll / virtualised row render).

**Metadata editor:**
- `Opening` and `ECO` are standard PGN headers. Auto-populate when game is loaded or move is made.
- Allow manual override (user can type a custom string; auto-fill only when field is empty or explicitly triggered).

### Phase E5 — PGN export

When saving a game, write `[ECO "B20"]` and `[Opening "Sicilian Defence"]` headers if the lookup produced a match and those headers aren't already set manually.

---

## File list

| File | Role |
|---|---|
| `scripts/build_eco_json.ts` | One-time data build script |
| `frontend/src/resources/eco/eco_data.json` | Committed ECO dataset (~120 KB) |
| `frontend/src/resources/eco/eco_lookup.ts` | Pure-logic matcher |
| `frontend/src/resources/eco/index.ts` | Public API re-export |
| `frontend/src/hooks/createAppServices.ts` | Initialise `lookupEco` |
| `frontend/src/state/selectors.ts` | `selectEco(state): EcoMatch | null` |
| `frontend/src/components/GameInfoEditor.tsx` | Display ECO badge |
| `frontend/src/components/ResourceViewer.tsx` | Opening column |
| `frontend/test/resources/eco/eco_lookup.test.ts` | Unit tests |

---

## Unit tests (Phase E2)

- Empty move list → `null` (or the A00 catch-all entry, depending on data).
- `["e4", "c5"]` → `{ eco: "B20", name: "Sicilian Defence", depth: 2 }`.
- Longer sequence takes precedence over shorter: `["e4", "c5", "Nf3"]` → deeper entry if present.
- Unknown moves after a known prefix → returns the last matched entry (partial match is fine).
- Completely unknown sequence → `null`.

---

## Open questions / decisions

1. **Source dataset licence**: `chess-openings` (MIT) or Scid's ECO PGN (GPL). Choose MIT for clean bundling.
2. **Transpositions**: Many ECO books list the same position reachable via different move orders. Initial implementation matches move-sequence only (order matters). Transposition support requires position hashing (FEN after each move) — defer to a later phase.
3. **Bundle impact**: `eco_data.json` at ~120 KB gzipped is ~30 KB. Acceptable. If it becomes a concern, lazy-load via dynamic `import()`.
4. **Trie vs. linear scan**: Linear scan is simpler and sufficient for interactive use. Trie is only needed for bulk-import batch processing.

---

## Phases summary

| Phase | Deliverable | Est. effort |
|---|---|---|
| E1 | `build_eco_json.ts` + committed `eco_data.json` | Small |
| E2 | `eco_lookup.ts` + unit tests | Small |
| E3 | Service wiring in `createAppServices.ts` | Trivial |
| E4 | ECO badge in GameInfoEditor + Opening column in ResourceViewer | Medium |
| E5 | Auto-write ECO/Opening PGN headers on save | Small |
