import test from "node:test";
import assert from "node:assert/strict";
import { createDbAdapter } from "../../../resource/adapters/db/db_adapter";
import type { DbGateway } from "../../../resource/io/db_gateway";

// ── In-memory DB gateway using a simple JS Map ─────────────────────────────

/**
 * Build a minimal in-memory gateway that executes a tiny subset of SQLite-
 * compatible DDL/DML. Sufficient to exercise the DB adapter without a real
 * SQLite engine.
 */
const buildInMemoryGateway = (): DbGateway => {
  // Each table is a Map<rowId, Record<col, unknown>>.
  const tables: Map<string, Map<string, Record<string, unknown>>> = new Map();
  let rowCounter = 0;

  const getOrCreate = (name: string): Map<string, Record<string, unknown>> => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  return {
    execute: async (sql: string, params?: unknown[]): Promise<void> => {
      const s = sql.replace(/\s+/g, " ").trim();

      // CREATE TABLE ... — just ensure the table map exists
      const createMatch = s.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
      if (createMatch) { getOrCreate(createMatch[1].toLowerCase()); return; }

      // CREATE INDEX ... — no-op for in-memory
      if (/CREATE INDEX/i.test(s)) return;

      // PRAGMA ... — no-op
      if (/^PRAGMA/i.test(s)) return;

      // INSERT INTO table (cols) VALUES (?)
      const insertMatch = s.match(/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const tbl = getOrCreate(insertMatch[1].toLowerCase());
        const cols = insertMatch[2].split(",").map((c) => c.trim());
        const row: Record<string, unknown> = {};
        cols.forEach((col, i) => { row[col] = params?.[i] ?? null; });
        const pk: string = String(row.id ?? row.version ?? row.key ?? ++rowCounter);
        tbl.set(pk, row);
        return;
      }

      // DELETE FROM table WHERE game_id = ?
      const deleteMatch = s.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+game_id\s*=\s*\?/i);
      if (deleteMatch) {
        const tbl = getOrCreate(deleteMatch[1].toLowerCase());
        const id = String(params?.[0] ?? "");
        for (const [k, v] of tbl.entries()) {
          if (String(v.game_id) === id) tbl.delete(k);
        }
        return;
      }

      // UPDATE games SET pgn_text=?, revision_token=?, updated_at=? WHERE id=?
      const updateMatch = s.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\?/i);
      if (updateMatch) {
        const tbl = getOrCreate(updateMatch[1].toLowerCase());
        const setClause = updateMatch[2];
        const setCols = setClause.split(",").map((p) => p.split("=")[0].trim());
        const id = String(params?.[params.length - 1] ?? "");
        const existing = tbl.get(id);
        if (existing) {
          setCols.forEach((col, i) => { existing[col] = params?.[i] ?? null; });
        }
        return;
      }
    },

    query: async (sql: string, params?: unknown[]): Promise<unknown[]> => {
      const s = sql.replace(/\s+/g, " ").trim();

      // SELECT version FROM schema_version
      if (/FROM\s+schema_version/i.test(s)) {
        const tbl = getOrCreate("schema_version");
        return [...tbl.values()];
      }

      // SELECT * / cols FROM games ...
      if (/FROM\s+games\b/i.test(s) && !/JOIN/i.test(s)) {
        const tbl = getOrCreate("games");
        let rows = [...tbl.values()];
        // WHERE id = ?
        if (/WHERE\s+id\s*=\s*\?/i.test(s)) {
          rows = rows.filter((r) => String(r.id) === String(params?.[0] ?? ""));
        }
        return rows;
      }

      // SELECT MAX(order_index) ...
      if (/MAX\(order_index\)/i.test(s)) {
        const tbl = getOrCreate("games");
        const max = [...tbl.values()].reduce((m, r) => Math.max(m, Number(r.order_index ?? -1)), -1);
        return [{ max_order: max }];
      }

      // SELECT game_id, meta_key, val_str FROM game_metadata WHERE game_id IN (...)
      if (/FROM\s+game_metadata/i.test(s)) {
        const tbl = getOrCreate("game_metadata");
        const ids = new Set((params ?? []).map(String));
        return [...tbl.values()].filter((r) => ids.has(String(r.game_id)));
      }

      // SELECT key FROM metadata_keys
      if (/FROM\s+metadata_keys/i.test(s)) {
        const tbl = getOrCreate("metadata_keys");
        return [...tbl.values()];
      }

      return [];
    },
  };
};

// ── Tests ──────────────────────────────────────────────────────────────────

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

test("db adapter: create and list games", async () => {
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await adapter.create({ kind: "db", locator: "/fake.x2chess" }, GAME_A_PGN, "Game A");
  await adapter.create({ kind: "db", locator: "/fake.x2chess" }, GAME_B_PGN, "Game B");

  const listed = await adapter.list({ kind: "db", locator: "/fake.x2chess" });
  assert.equal(listed.entries.length, 2);
  assert.equal(listed.entries[0].metadata.White, "Alice");
  assert.equal(listed.entries[0].metadata.Black, "Bob");
  assert.equal(listed.entries[1].metadata.White, "Carol");
  assert.equal(listed.entries[1].metadata.Black, "Dave");
  assert.match(listed.entries[0].title, /Alice/);
});

test("db adapter: load game by recordId", async () => {
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: "/fake.x2chess" }, GAME_A_PGN, "");
  const loaded = await adapter.load(created.gameRef);

  assert.match(loaded.pgnText, /\[White "Alice"\]/);
  assert.match(loaded.pgnText, /1\. e4/);
  assert.ok(loaded.revisionToken.length > 0);
});

test("db adapter: save updates pgn and revision token", async () => {
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: "/fake.x2chess" }, GAME_A_PGN, "");
  const saved = await adapter.save(created.gameRef, GAME_B_PGN, {
    expectedRevisionToken: created.revisionToken,
  });

  assert.notEqual(saved.revisionToken, created.revisionToken);

  const loaded = await adapter.load(created.gameRef);
  assert.match(loaded.pgnText, /Carol/);
});

test("db adapter: save with wrong revision token throws conflict", async () => {
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  const created = await adapter.create({ kind: "db", locator: "/fake.x2chess" }, GAME_A_PGN, "");
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
  const db = buildInMemoryGateway();
  const adapter = createDbAdapter(() => db);

  await assert.rejects(
    () => adapter.load({ kind: "db", locator: "/fake.x2chess", recordId: "no-such-id" }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /not found/i);
      return true;
    },
  );
});
