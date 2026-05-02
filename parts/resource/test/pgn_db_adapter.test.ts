import test from "node:test";
import assert from "node:assert/strict";
import { createDbAdapter } from "../src/adapters/db/db_adapter";
import type { DbGateway } from "../src/io/db_gateway";

// ── Shared utilities ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const asStr = (v: unknown): string => typeof v === "string" ? v : "";
const normSql = (sql: string): string => sql.replaceAll(/\s+/g, " ").trim();

// Each test uses a distinct path so the module-level migratedPaths cache never
// returns a stale "already migrated" hit for a freshly-created in-memory store.
let pathCounter = 0;
const nextPath = (): string => `/test-db-${++pathCounter}.x2chess`;

// ── In-memory table store helpers ─────────────────────────────────────────────

const getOrCreateTbl = (
  tables: Map<string, Map<string, Row>>,
  name: string,
): Map<string, Row> => {
  const key = name.toLowerCase();
  const existing = tables.get(key);
  if (existing !== undefined) return existing;
  const created = new Map<string, Row>();
  tables.set(key, created);
  return created;
};

const compositeKey = (row: Row): string => {
  if ("game_id" in row && "meta_key" in row) {
    const ord = typeof row.ordinal === "number" ? row.ordinal : 0;
    return `${asStr(row.game_id)}:${asStr(row.meta_key)}:${ord}`;
  }
  const id = row.id ?? row.version ?? row.key;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
};

// ── Execute: DDL sub-handlers ─────────────────────────────────────────────────

const execDDLAddColumn = (
  tables: Map<string, Map<string, Row>>,
  match: RegExpExecArray,
): void => {
  const tbl = getOrCreateTbl(tables, match[1]);
  const col = match[2].toLowerCase();
  const def = match[3] ?? null;
  for (const row of tbl.values()) {
    if (!(col in row)) row[col] = def;
  }
};

const execDDLInsertSelect = (
  tables: Map<string, Map<string, Row>>,
  match: RegExpExecArray,
): void => {
  const destName = match[1].toLowerCase();
  const src = getOrCreateTbl(tables, "game_metadata");
  const dst = getOrCreateTbl(tables, destName);
  for (const [, row] of src) {
    const newRow: Row = { ...row, ordinal: typeof row.ordinal === "number" ? row.ordinal : 0 };
    const pk = compositeKey(newRow) || String(dst.size);
    dst.set(pk, newRow);
  }
};

// ── Execute: DDL ──────────────────────────────────────────────────────────────

const execDDL = (
  tables: Map<string, Map<string, Row>>,
  sql: string,
): boolean => {
  const createM = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i.exec(sql);
  if (createM) { getOrCreateTbl(tables, createM[1]); return true; }
  if (/CREATE INDEX/i.test(sql)) return true;
  if (/^PRAGMA/i.test(sql)) return true;

  const dropM = /DROP TABLE\s+(\w+)/i.exec(sql);
  if (dropM) { tables.delete(dropM[1].toLowerCase()); return true; }

  const renameM = /ALTER TABLE\s+(\w+)\s+RENAME TO\s+(\w+)/i.exec(sql);
  if (renameM) {
    const tbl = tables.get(renameM[1].toLowerCase());
    if (tbl !== undefined) { tables.set(renameM[2].toLowerCase(), tbl); tables.delete(renameM[1].toLowerCase()); }
    return true;
  }

  const addColM = /ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)[^']*(?:DEFAULT\s+'([^']*)')?/i.exec(sql);
  if (addColM) { execDDLAddColumn(tables, addColM); return true; }

  const insSelM = /INSERT INTO\s+(\w+)\s*\([^)]+\)\s+SELECT\b/i.exec(sql);
  if (insSelM) { execDDLInsertSelect(tables, insSelM); return true; }

  return false;
};

// ── Execute: DML sub-handlers ─────────────────────────────────────────────────

/**
 * Build a row from INSERT column names and VALUES tokens.
 * Handles both `?` placeholders (consume next param) and `'literal'` string
 * values mixed in the VALUES clause (e.g. `VALUES (?, 'string', ?)`).
 */
const buildInsertRow = (cols: string[], valTokens: string[], params: unknown[]): Row => {
  let paramIdx = 0;
  const values = valTokens.map((tok) => {
    if (tok === "?") return params[paramIdx++] ?? null;
    if (tok.startsWith("'") && tok.endsWith("'")) return tok.slice(1, -1);
    const n = Number(tok);
    return Number.isNaN(n) ? tok : n;
  });
  return Object.fromEntries(cols.map((col, i) => [col, values[i] ?? null]));
};

const execDMLInsert = (
  tables: Map<string, Map<string, Row>>,
  sql: string,
  match: RegExpExecArray,
  params: unknown[],
): void => {
  const tbl = getOrCreateTbl(tables, match[1].toLowerCase());
  const cols = match[2].split(",").map((c) => c.trim());
  const isOrIgnore = /INSERT\s+OR\s+IGNORE/i.test(sql);

  // Extract all value groups from potentially multi-row: VALUES (…),(…),(…)
  const valuesSection = sql.slice(sql.toUpperCase().indexOf("VALUES") + 6).trim();
  const rowPattern = /\(([^)]+)\)/g;
  let paramIdx = 0;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(valuesSection)) !== null) {
    const valTokens = rowMatch[1].split(",").map((t) => t.trim());
    const sliceParams = params.slice(paramIdx);
    const row = buildInsertRow(cols, valTokens, sliceParams);
    paramIdx += valTokens.filter((t) => t === "?").length;
    const pk = compositeKey(row) || String(tbl.size);
    if (isOrIgnore && tbl.has(pk)) continue;
    tbl.set(pk, row);
  }
};

const execDMLUpdateCardinality = (
  tables: Map<string, Map<string, Row>>,
  params: unknown[],
): void => {
  // SQL: UPDATE metadata_keys SET cardinality = ? WHERE key = ?
  // params: [newCardinality, key]
  const newCardinality = asStr(params[0]);
  const key = asStr(params[1]);
  const tbl = getOrCreateTbl(tables, "metadata_keys");
  for (const row of tbl.values()) {
    if (asStr(row.key) === key) row.cardinality = newCardinality;
  }
};

// ── Execute: DML ──────────────────────────────────────────────────────────────

const execDML = (
  tables: Map<string, Map<string, Row>>,
  sql: string,
  params: unknown[],
): boolean => {
  const insertM = /INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\b/i.exec(sql);
  if (insertM) { execDMLInsert(tables, sql, insertM, params); return true; }

  const deleteM = /DELETE\s+FROM\s+(\w+)\s+WHERE\s+game_id\s*=\s*\?/i.exec(sql);
  if (deleteM) {
    const tbl = getOrCreateTbl(tables, deleteM[1]);
    const id = asStr(params[0]);
    for (const [k, v] of tbl.entries()) {
      if (asStr(v.game_id) === id) tbl.delete(k);
    }
    return true;
  }

  const deleteById = /DELETE\s+FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\?/i.exec(sql);
  if (deleteById) {
    const tbl = getOrCreateTbl(tables, deleteById[1]);
    const id = asStr(params[0]);
    for (const [k, v] of tbl.entries()) {
      if (asStr(v.id) === id) tbl.delete(k);
    }
    return true;
  }

  if (/UPDATE\s+metadata_keys\s+SET\s+cardinality\s*=/i.test(sql)) {
    execDMLUpdateCardinality(tables, params);
    return true;
  }

  const updateM = /UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\?/i.exec(sql);
  if (updateM) {
    const tbl = getOrCreateTbl(tables, updateM[1]);
    const setCols = updateM[2].split(",").map((p) => p.split("=")[0].trim());
    const row = tbl.get(asStr(params.at(-1)));
    if (row !== undefined) {
      setCols.forEach((col, i) => { row[col] = params[i] ?? null; });
    }
    return true;
  }

  return false;
};

// ── Query handler ─────────────────────────────────────────────────────────────

const runQuery = (
  tables: Map<string, Map<string, Row>>,
  sql: string,
  params: unknown[],
): unknown[] => {
  if (/FROM\s+schema_version/i.test(sql)) {
    return [...getOrCreateTbl(tables, "schema_version").values()];
  }

  if (/FROM\s+games\b/i.test(sql) && !/JOIN/i.test(sql)) {
    let rows = [...getOrCreateTbl(tables, "games").values()];
    if (/WHERE\s+id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => asStr(r.id) === asStr(params[0]));
    }
    if (/MAX\(order_index\)/i.test(sql)) {
      const max = rows.reduce((m, r) => Math.max(m, Number(r.order_index ?? -1)), -1);
      return [{ max_order: max }];
    }
    return rows;
  }

  if (/FROM\s+game_metadata/i.test(sql)) {
    return queryGameMetadata(tables, sql, params);
  }

  if (/FROM\s+metadata_keys/i.test(sql)) {
    return [...getOrCreateTbl(tables, "metadata_keys").values()];
  }

  return [];
};

const queryGameMetadata = (
  tables: Map<string, Map<string, Row>>,
  sql: string,
  params: unknown[],
): unknown[] => {
  const tbl = getOrCreateTbl(tables, "game_metadata");

  // COUNT(*) WHERE meta_key = ? AND ordinal > 0  — cardinality recalculation
  if (/SELECT\s+COUNT\(\*\)/i.test(sql) && /WHERE\s+meta_key\s*=\s*\?/i.test(sql) && /ordinal\s*>\s*0/i.test(sql)) {
    const key = asStr(params[0]);
    const cnt = [...tbl.values()].filter((r) => asStr(r.meta_key) === key && Number(r.ordinal) > 0).length;
    return [{ cnt }];
  }

  // WHERE meta_key = ? AND val_str IN (…)  — searchByMetadataValues
  if (/WHERE\s+meta_key\s*=\s*\?\s+AND\s+val_str\s+IN/i.test(sql)) {
    const key = asStr(params[0]);
    const isAllMode: boolean = /HAVING\s+COUNT\(DISTINCT\s+val_str\)\s*=\s*\?/i.test(sql);
    const valueParams: unknown[] = isAllMode ? params.slice(1, -1) : params.slice(1);
    const valSet = new Set(valueParams.map(asStr));
    const matching = [...tbl.values()].filter(
      (r) => asStr(r.meta_key) === key && valSet.has(asStr(r.val_str)),
    );

    // "all" mode: HAVING COUNT(DISTINCT val_str) = ?
    if (/HAVING\s+COUNT\(DISTINCT\s+val_str\)\s*=\s*\?/i.test(sql)) {
      const n = Number(params.at(-1) ?? 0);
      const byGame = new Map<string, Set<string>>();
      for (const r of matching) {
        const gid = asStr(r.game_id);
        const existing = byGame.get(gid);
        if (existing === undefined) {
          byGame.set(gid, new Set([asStr(r.val_str)]));
        } else {
          existing.add(asStr(r.val_str));
        }
      }
      return [...byGame.entries()]
        .filter(([, vs]) => vs.size >= n)
        .map(([game_id]) => ({ game_id }));
    }

    // "any" mode: DISTINCT game_id
    const seen = new Set<string>();
    return matching
      .filter((r) => {
        const id = asStr(r.game_id);
        if (seen.has(id)) { return false; }
        seen.add(id);
        return true;
      })
      .map((r) => ({ game_id: r.game_id }));
  }

  // WHERE game_id IN (…)  — batch metadata load
  if (/WHERE\s+game_id\s+IN/i.test(sql)) {
    const ids = new Set(params.map(asStr));
    return [...tbl.values()].filter((r) => ids.has(asStr(r.game_id)));
  }

  return [...tbl.values()];
};

// ── Gateway factory ───────────────────────────────────────────────────────────

const buildInMemoryGateway = (): DbGateway => {
  const tables = new Map<string, Map<string, Row>>();
  const gw: DbGateway = {
    execute: async (sql: string, params: unknown[] = []): Promise<void> => {
      const norm = normSql(sql);
      if (norm === "BEGIN" || norm === "COMMIT" || norm === "ROLLBACK") return;
      if (!execDDL(tables, norm)) execDML(tables, norm, params);
    },
    query: async (sql: string, params: unknown[] = []): Promise<unknown[]> =>
      runQuery(tables, normSql(sql), params),
    transaction: async (fn: (db: DbGateway) => Promise<void>): Promise<void> => {
      await fn(gw);
    },
  };
  return gw;
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const GAME_A_PGN = `[Event "Test Event"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0`;

const GAME_B_PGN = `[Event "Another Event"]
[White "Carol"]
[Black "Dave"]
[Result "0-1"]

1. d4 d5 2. c4 e6 0-1`;

const MULTI_TAG_PGN = `[Event "Training"]
[White "Eve"]
[Black "Frank"]
[Result "*"]
[Character "aggressive"]
[Character "positional"]
[Character "endgame"]

1. e4 *`;

// ── Basic CRUD ─────────────────────────────────────────────────────────────────

test("db adapter: create and list games", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "Game A");
  await adapter.create({ kind: "db", locator: dbPath }, GAME_B_PGN, "Game B");

  const listed = await adapter.list({ kind: "db", locator: dbPath });
  assert.equal(listed.entries.length, 2);
  const [a, b] = listed.entries;
  assert.equal(a?.metadata.White, "Alice");
  assert.equal(a?.metadata.Black, "Bob");
  assert.equal(b?.metadata.White, "Carol");
  assert.equal(b?.metadata.Black, "Dave");
  assert.match(String(a?.title ?? ""), /Alice/);
});

test("db adapter: load game by recordId", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "");
  const loaded = await adapter.load(created.gameRef);

  assert.match(loaded.pgnText, /\[White "Alice"\]/);
  assert.match(loaded.pgnText, /1\. e4/);
  assert.ok(loaded.revisionToken.length > 0);
});

test("db adapter: save updates pgn and revision token", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "");
  const saved = await adapter.save(created.gameRef, GAME_B_PGN, {
    expectedRevisionToken: created.revisionToken,
  });

  assert.notEqual(saved.revisionToken, created.revisionToken);
  const loaded = await adapter.load(created.gameRef);
  assert.match(loaded.pgnText, /Carol/);
});

test("db adapter: save refreshes title_hint from PGN headers", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "session-tab-hint");
  let loaded = await adapter.load(created.gameRef);
  assert.equal(loaded.title, "session-tab-hint");

  await adapter.save(created.gameRef, GAME_B_PGN, {
    expectedRevisionToken: created.revisionToken,
  });
  loaded = await adapter.load(created.gameRef);
  assert.match(loaded.title, /Carol/);
  assert.match(loaded.title, /Dave/);
});

test("db adapter: save rebuilds game_metadata for search from saved PGN", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "");
  await adapter.save(created.gameRef, GAME_B_PGN, {
    expectedRevisionToken: created.revisionToken,
  });

  const search = adapter.searchByMetadataValues;
  assert.ok(search !== undefined, "adapter should implement searchByMetadataValues");
  const refsByWhite = await search.call(adapter, "White", ["Carol"], "any", { kind: "db", locator: dbPath });
  assert.equal(refsByWhite.length, 1);
  assert.equal(refsByWhite[0]?.recordId, created.gameRef.recordId);

  const staleAlice = await search.call(adapter, "White", ["Alice"], "any", { kind: "db", locator: dbPath });
  assert.equal(staleAlice.length, 0);
});

test("db adapter: save with wrong revision token throws conflict", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "");
  await assert.rejects(
    () => adapter.save(created.gameRef, GAME_B_PGN, { expectedRevisionToken: "wrong-token" }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /conflict/i);
      return true;
    },
  );
});

test("db adapter: load missing game throws not_found", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await assert.rejects(
    () => adapter.load({ kind: "db", locator: dbPath, recordId: "no-such-id" }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /not found/i);
      return true;
    },
  );
});

test("db adapter: delete removes game and related indexes", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);
  const created = await adapter.create({ kind: "db", locator: dbPath }, GAME_A_PGN, "A");
  await adapter.delete?.(created.gameRef);
  const listed = await adapter.list({ kind: "db", locator: dbPath });
  assert.equal(listed.entries.length, 0);
  await assert.rejects(
    () => adapter.load(created.gameRef),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /not found/i);
      return true;
    },
  );
});

// ── Multi-valued metadata ──────────────────────────────────────────────────────

test("db adapter: multi-valued tags listed as string[]", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "Multi");

  const listed = await adapter.list({ kind: "db", locator: dbPath });
  assert.equal(listed.entries.length, 1);
  const [entry] = listed.entries;
  const charVal = entry?.metadata["Character"];
  assert.ok(Array.isArray(charVal), "Character should be a string array");
  assert.deepEqual(charVal, ["aggressive", "positional", "endgame"]);
});

test("db adapter: single-valued tags remain strings alongside multi-valued ones", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "Multi");

  const listed = await adapter.list({ kind: "db", locator: dbPath });
  const [entry] = listed.entries;
  const white = entry?.metadata.White;
  assert.equal(typeof white, "string", "White should be a plain string");
  assert.equal(white, "Eve");
});

test("db adapter: metadataKeyInfos reports cardinality", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "Multi");

  const listed = await adapter.list({ kind: "db", locator: dbPath });
  const [entry] = listed.entries;
  const keyInfos = entry?.metadataKeyInfos ?? [];
  const charInfo = keyInfos.find((k) => k.key === "Character");
  const whiteInfo = keyInfos.find((k) => k.key === "White");

  assert.ok(charInfo !== undefined, "Character key should be registered");
  assert.equal(charInfo.cardinality, "many");
  assert.ok(whiteInfo !== undefined, "White key should be registered");
  assert.equal(whiteInfo.cardinality, "one");
});

// ── searchByMetadataValues ─────────────────────────────────────────────────────

test("searchByMetadataValues any: matches game with at least one value", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const a = await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "A");
  await adapter.create({ kind: "db", locator: dbPath }, GAME_B_PGN, "B");

  const search = adapter.searchByMetadataValues;
  assert.ok(search !== undefined, "adapter should implement searchByMetadataValues");
  const refs = await search.call(adapter, "Character", ["aggressive", "positional"], "any", { kind: "db", locator: dbPath });
  assert.equal(refs.length, 1);
  assert.equal(refs[0]?.recordId, a.gameRef.recordId);
});

test("searchByMetadataValues all: matches game having every value", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "A");
  await adapter.create({ kind: "db", locator: dbPath }, GAME_B_PGN, "B");

  const search = adapter.searchByMetadataValues;
  assert.ok(search !== undefined, "adapter should implement searchByMetadataValues");
  const refs = await search.call(adapter, "Character", ["aggressive", "endgame"], "all", { kind: "db", locator: dbPath });
  assert.equal(refs.length, 1);
});

test("searchByMetadataValues all: returns nothing when partial match only", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "A");

  const search = adapter.searchByMetadataValues;
  assert.ok(search !== undefined, "adapter should implement searchByMetadataValues");
  const refs = await search.call(adapter, "Character", ["aggressive", "tactical"], "all", { kind: "db", locator: dbPath });
  assert.equal(refs.length, 0);
});

test("searchByMetadataValues any: empty value list returns empty array", async () => {
  const dbPath = nextPath();
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: dbPath }, MULTI_TAG_PGN, "A");

  const search = adapter.searchByMetadataValues;
  assert.ok(search !== undefined, "adapter should implement searchByMetadataValues");
  const refs = await search.call(adapter, "Character", [], "any", { kind: "db", locator: dbPath });
  assert.equal(refs.length, 0);
});
