# Database Resource Plan

**File:** `database_resource_2e8f4c91.plan.md`
**Status:** Implementing — Phase 1 + 5 in progress.

---

## Goal

Implement the `db` resource kind backed by SQLite, turning the existing
placeholder `createDbAdapter` and `createDeferredDbSourceAdapter` into a
working read/write store with metadata search, position indexing, and a
cross-resource search interface.

---

## Resolved design decisions

| # | Question | Decision |
|---|---|---|
| 1 | Position hashing | chess.js only; Lean 4 path dropped entirely |
| 2 | Browser mode | Dropped — DB kind is desktop (Tauri) only, permanently |
| 3 | Multiple open DBs | One `.x2chess` file per resource tab; multiple simultaneous DBs are supported |
| 4 | Directory sidecar priority | Phase 5 in scope; sidecar filename TBD (see note) |
| 5 | Game ordering UI | Both drag-and-drop and explicit up/down buttons |
| 6 | File extension | `.x2chess` (native chess DB format; replaces `.db`) |
| 7 | ORM tool | No ORM — plain SQL via `DbGateway` |
| 8 | Sidecar name | `.x2chess-meta.json` — resource metadata only (ordering, extra tags). Training data lives in `.x2chess-training/` subdirectory (separate tier). |
| 9 | Schema versioning | `schema_version` table; backward-compatible migration runner; upgrade both explicitly (on-demand) and implicitly (on DB open) |

---

## Scope decision: DB vs. directory with sidecar

| Feature | SQLite DB (`.x2chess`) | Directory + sidecar | Plain multi-game PGN |
|---|---|---|---|
| List games | Native SQL | Index from sidecar | Parse all headers |
| Metadata search/filter | SQL WHERE | sidecar JSON scan | Linear PGN scan |
| Game ordering | `order_index` column | sidecar ordering array | Implicit order |
| Position search | Indexed hash table | Not practical | Not practical |
| Cross-db search | Via interface | Via interface | Via interface |

---

## A. Technology: SQLite via Tauri Rust commands

The `DbGateway` interface (`resource/io/db_gateway.ts`) is the sole I/O
boundary; the TypeScript adapter never talks to SQLite directly.

Concrete implementation: `buildTauriDbGateway(dbPath: string): DbGateway`
in `frontend/src/resources/source_gateway.ts`. Each unique `dbPath` gets
its own SQLite connection (pooled in a `Mutex<HashMap<String, Connection>>`
in Tauri state).

Tauri commands:
```
query_db(db_path: String, sql: String, params: Vec<JsonValue>) -> Result<Vec<JsonValue>, String>
execute_db(db_path: String, sql: String, params: Vec<JsonValue>) -> Result<(), String>
pick_x2chess_file()  -> Option<String>
create_x2chess_file(suggested_name: String) -> Option<String>
```

File extension: **`.x2chess`** (all new chess DB files use this extension;
existing `.db` files are not supported).

---

## B. Database schema

```sql
-- Schema versioning (runner pre-creates before migrations)
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT    NOT NULL
);

-- Core game store (one DB = one resource = one resource tab)
CREATE TABLE IF NOT EXISTS games (
  id             TEXT    PRIMARY KEY,   -- crypto.randomUUID()
  pgn_text       TEXT    NOT NULL,
  title_hint     TEXT    NOT NULL DEFAULT '',
  created_at     INTEGER NOT NULL,      -- Unix ms
  updated_at     INTEGER NOT NULL,
  order_index    REAL    NOT NULL DEFAULT 0.0,  -- fractional indexing
  revision_token TEXT    NOT NULL
);

-- Indexed metadata values per game
CREATE TABLE IF NOT EXISTS game_metadata (
  game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  meta_key TEXT NOT NULL,
  val_str  TEXT,
  PRIMARY KEY (game_id, meta_key)
);

-- Known metadata key catalog (drives column chooser UI)
CREATE TABLE IF NOT EXISTS metadata_keys (
  key        TEXT PRIMARY KEY,
  value_type TEXT NOT NULL DEFAULT 'string'
);

-- Position search index (Phase 3)
CREATE TABLE IF NOT EXISTS position_hashes (
  hash     TEXT    NOT NULL,   -- 16-char hex Zobrist
  game_id  TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply      INTEGER NOT NULL,
  fen      TEXT    NOT NULL,
  PRIMARY KEY (hash, game_id, ply)
);
```

---

## C. Metadata: canonical keys + open user keys

Standard PGN headers parsed by `extractPgnMetadata` in `resource/domain/metadata.ts`.
Stored in `game_metadata` as string key/value pairs.
`metadata_keys` catalog is populated on `create`/`save` so the column
chooser can enumerate columns without scanning all rows.

---

## D. Metadata round-trip

PGN headers are the **import source of truth**.
On `create`/`save`: adapter parses headers from `pgn_text` → writes rows to `game_metadata`.
On `list`: metadata rows are read back → displayed in resource viewer.
On `load`: only `pgn_text` is returned (headers are already embedded there).

---

## E. Position search (Phase 3)

Zobrist hashing via chess.js (already a dependency).
Utility: `buildPositionIndex(pgnText): Array<{ ply, fen, hash }>` in `resource/adapters/db/`.
`create`/`save` index all mainline positions.
Search: `SELECT DISTINCT game_id FROM position_hashes WHERE hash = ?`

---

## F. Cross-resource search interface (Phase 4)

`PgnResourceAdapter` gains optional `search?(query): Promise<result>`.
`SearchCoordinator` in `resource/client/search_coordinator.ts` fans out to all adapters.

---

## G. Game ordering

Fractional indexing via `order_index REAL`:
- **Insert at end**: `MAX(order_index) + 1.0`
- **Insert between** a and b: `(a + b) / 2.0`
- UI: both drag-and-drop rows and explicit up/down buttons (Phase 4 UI).

---

## H. Schema versioning

`runMigrations(db: DbGateway)` runs on first DB access (per path, cached in module Set).
Migration runner:
1. Pre-creates `schema_version` table.
2. Reads applied versions.
3. Runs any unapplied migration statements in order.
4. Records each version in `schema_version`.

Backward compatibility: migrations only ADD tables/indexes; DROP or ALTER
only in explicitly versioned upgrade migrations (future). Older DBs can be
silently upgraded on open.

---

## Incremental delivery phases

### Phase 1 — DB CRUD ✅

- ✅ Design decisions locked
- ✅ SQL schema in `schema_manifest.ts` (migration arrays)
- ✅ `runMigrations(db)` in `runner.ts`
- ✅ `createDbAdapter(gatewayForPath)` in `db_adapter.ts`
- ✅ Rust: `rusqlite` dep, `query_db` / `execute_db` / `pick_x2chess_file` / `create_x2chess_file`
- ✅ `buildTauriDbGateway` in `source_gateway.ts`
- ✅ Wire `createDbAdapter` replacing `createDeferredDbSourceAdapter`
- ✅ Enable `db` kind in picker when Tauri runtime
- ✅ Update picker filter to `.x2chess`

### Phase 2 — Hardening ✅

- ✅ WAL mode + foreign keys pragma on DB open
- ✅ Migration runner: handle multi-statement safety (sequential steps in ledger)
- [ ] Integration tests with in-memory sqlite (better-sqlite3 via tsx)

### Phase 3 — Position indexing ✅

- ✅ `buildPositionIndex` utility (`position_indexer.ts`)
- ✅ Index positions on `create`/`save`
- ✅ `searchByPositionHash` method on DB adapter + `PgnResourceAdapter` contract

### Phase 4 — Cross-resource search UI ✅

- ✅ `resource/client/search_coordinator.ts` — `searchAcrossResources` fans out across adapters via `Promise.allSettled`
- ✅ `searchByPositionHash` on `ResourceCapabilities` + `createResourceClient`
- ✅ `source_gateway.ts` — `searchByPositionAcross` wires coordinator to frontend
- ✅ `ServiceContext` — `searchByPosition` service callback
- ✅ `usePositionSearch` hook — hashes current board FEN, fans out to open resource tabs
- ✅ `PositionSearchPanel` component — search button + result list with open-game action
- ✅ Wired into `AppShell`
- Game ordering UI (drag-and-drop rows) — deferred; up/down buttons already in place

### Phase 5 — Directory sidecar ✅

- ✅ `.x2chess-meta.json` alongside PGN directories (`sidecar.ts`)
- ✅ Stores ordering and extended metadata
- ✅ Updated on `create`; `reorder` swaps orderIndex in sidecar
- ✅ Applied on `list` to sort rows by persisted order
