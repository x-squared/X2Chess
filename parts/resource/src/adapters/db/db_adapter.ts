/**
 * Canonical database adapter — SQLite-backed chess game store.
 *
 * Integration API:
 * - Primary export: `createDbAdapter`.
 * - Accepts a `gatewayForPath` factory so multiple `.x2chess` files can be
 *   open simultaneously (one gateway per DB file path).
 *
 * Configuration API:
 * - Migrations run automatically on first access per DB path.
 *
 * Communication API:
 * - All I/O delegated to the injected `DbGateway`; no direct SQLite dependency.
 * - Implements `list`, `load`, `save`, `create` for the canonical `db` kind.
 * - Implements `searchByMetadataValues` with `"any"` and `"all"` modes.
 */

import { PgnResourceError } from "../../domain/actions";
import type { MetadataSearchMode, PgnResourceAdapter, PgnSaveOptions } from "../../domain/contracts";
import type { PgnGameRef } from "../../domain/game_ref";
import type { PgnResourceRef } from "../../domain/resource_ref";
import type { PgnListGamesResult, PgnLoadGameResult, PgnSaveGameResult, PgnCreateGameResult } from "../../domain/actions";
import type { MetadataKeyInfo, MetadataValueCardinality } from "../../domain/metadata_schema";
import type { DbGateway } from "../../io/db_gateway";
import { runMigrations } from "../../database/migrations/runner";
import type { BuildPositionIndex } from "./position_index";
import type { BuildMoveEdgeIndex } from "./move_edge_index";
import type { MoveFrequencyEntry } from "../../domain/move_frequency";
import { asMetaRow, makeWritePositionIndex, makeWriteMoveEdgeIndex, writeMetadata } from "./db_indexer";

// ── Per-path migration cache ───────────────────────────────────────────────────

const migratedPaths = new Set<string>();

const ensureMigrated = async (db: DbGateway, dbPath: string): Promise<void> => {
  if (migratedPaths.has(dbPath)) return;
  await runMigrations(db);
  migratedPaths.add(dbPath);
};

// ── Primitive-safe string extraction ──────────────────────────────────────────

const strOf = (v: unknown): string => typeof v === "string" ? v : "";

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const generateRevisionToken = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Derive display title from PGN metadata for list view. */
const deriveTitle = (metadata: Record<string, string | string[]>, titleHint: string): string => {
  const whiteRaw = metadata.White;
  const blackRaw = metadata.Black;
  const white = typeof whiteRaw === "string" ? whiteRaw.trim() : "";
  const black = typeof blackRaw === "string" ? blackRaw.trim() : "";
  if (white && black && white !== "?" && black !== "?") return `${white} \u2013 ${black}`;
  if (titleHint) return titleHint;
  return "";
};

// ── Row types returned from DB queries ────────────────────────────────────────

type GameRow = {
  id: string;
  title_hint: string;
  revision_token: string;
  order_index: number;
  created_at: number;
  kind: string;
};

const asGameRow = (r: unknown): GameRow => {
  const v = r as Record<string, unknown>;
  return {
    id:             strOf(v.id),
    title_hint:     strOf(v.title_hint),
    revision_token: strOf(v.revision_token),
    order_index:    Number(v.order_index ?? 0),
    created_at:     Number(v.created_at  ?? 0),
    kind:           strOf(v.kind) || "game",
  };
};

const asGameRef = (r: unknown, dbPath: string): PgnGameRef => ({
  kind: "db",
  locator: dbPath,
  recordId: strOf((r as Record<string, unknown>).game_id),
});

// ── Kind detection ─────────────────────────────────────────────────────────────

const detectKind = (pgnText: string): string =>
  /\[SetUp\s+"1"\]/i.test(pgnText) ? "position" : "game";

// ── Read-side metadata helpers ─────────────────────────────────────────────────

const loadMetadataKeyInfos = async (db: DbGateway): Promise<MetadataKeyInfo[]> => {
  const rows = await db.query("SELECT key, cardinality FROM metadata_keys ORDER BY key ASC");
  return rows
    .map((r) => {
      const v = r as Record<string, unknown>;
      const key = strOf(v.key);
      const cardinality: MetadataValueCardinality = strOf(v.cardinality) === "many" ? "many" : "one";
      return { key, cardinality };
    })
    .filter((info) => info.key !== "");
};

/** Append val_str into the correct slot of gameRecord depending on cardinality. */
const applyMetaValue = (
  gameRecord: Record<string, string | string[]>,
  metaKey: string,
  valStr: string,
  cardinality: MetadataValueCardinality,
): void => {
  if (cardinality === "many") {
    const existing = gameRecord[metaKey];
    if (Array.isArray(existing)) {
      existing.push(valStr);
    } else {
      gameRecord[metaKey] = [valStr];
    }
  } else {
    // First row wins (ORDER BY ordinal ASC guarantees ordinal 0 arrives first).
    gameRecord[metaKey] ??= valStr;
  }
};

const loadMetadataForGames = async (
  db: DbGateway,
  gameIds: string[],
  cardinalityMap: ReadonlyMap<string, MetadataValueCardinality>,
): Promise<Map<string, Record<string, string | string[]>>> => {
  const result = new Map<string, Record<string, string | string[]>>();
  if (gameIds.length === 0) return result;

  const placeholders = gameIds.map(() => "?").join(", ");
  const rows = await db.query(
    `SELECT game_id, meta_key, ordinal, val_str
       FROM game_metadata
      WHERE game_id IN (${placeholders})
      ORDER BY ordinal ASC`,
    gameIds,
  );

  for (const row of rows) {
    const { game_id, meta_key, val_str } = asMetaRow(row);
    if (val_str === null) continue;

    let gameRecord = result.get(game_id);
    if (gameRecord === undefined) {
      gameRecord = {};
      result.set(game_id, gameRecord);
    }

    const cardinality = cardinalityMap.get(meta_key) ?? "one";
    applyMetaValue(gameRecord, meta_key, val_str, cardinality);
  }
  return result;
};

// ── Adapter factory ────────────────────────────────────────────────────────────

/**
 * Create a canonical database adapter backed by `.x2chess` SQLite files.
 *
 * @param gatewayForPath Factory that produces a `DbGateway` bound to a given
 *   DB file path. Called once per operation with `resourceRef.locator` or
 *   `gameRef.locator` as the path.
 * @param options Optional configuration.
 * @param options.buildPositionIndex Injectable position indexer; omit to skip
 *   position hashing (e.g. in test or non-chess environments).
 * @returns Canonical adapter implementing kind `db`.
 */
export const createDbAdapter = (
  gatewayForPath: (dbPath: string) => DbGateway,
  options?: { buildPositionIndex?: BuildPositionIndex; buildMoveEdgeIndex?: BuildMoveEdgeIndex },
): PgnResourceAdapter => {
  const writePositionIndex = makeWritePositionIndex(options?.buildPositionIndex);
  const writeMoveEdgeIndex = makeWriteMoveEdgeIndex(options?.buildMoveEdgeIndex);
  return {
  kind: "db",

  list: async (resourceRef: PgnResourceRef): Promise<PgnListGamesResult> => {
    const dbPath = String(resourceRef.locator || "").trim();
    if (!dbPath) return { entries: [] };
    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    const gameRows = (await db.query(
      "SELECT id, title_hint, revision_token, order_index, created_at, kind FROM games ORDER BY order_index ASC, created_at ASC",
    )).map(asGameRow);

    const gameIds = gameRows.map((r) => r.id);
    const keyInfos = await loadMetadataKeyInfos(db);
    const cardinalityMap = new Map(keyInfos.map((i) => [i.key, i.cardinality]));
    const metaByGame = await loadMetadataForGames(db, gameIds, cardinalityMap);

    return {
      entries: gameRows.map((row) => {
        const metadata = metaByGame.get(row.id) ?? {};
        return {
          gameRef: { kind: "db", locator: dbPath, recordId: row.id },
          title: deriveTitle(metadata, row.title_hint),
          revisionToken: row.revision_token,
          metadata,
          availableMetadataKeys: keyInfos.map((i) => i.key),
          metadataKeyInfos: keyInfos,
          gameKind: row.kind === "position" ? "position" : "game",
        };
      }),
    };
  },

  load: async (gameRef: PgnGameRef): Promise<PgnLoadGameResult> => {
    const dbPath = String(gameRef.locator || "").trim();
    const gameId = String(gameRef.recordId || "").trim();
    if (!dbPath) throw new PgnResourceError("validation_failed", "DB game ref is missing locator.");
    if (!gameId) throw new PgnResourceError("validation_failed", "DB game ref is missing recordId.");

    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    const rows = await db.query(
      "SELECT pgn_text, title_hint, revision_token FROM games WHERE id = ?",
      [gameId],
    );
    if (rows.length === 0) {
      throw new PgnResourceError("not_found", `Game ${gameId} not found in ${dbPath}.`);
    }
    const row = rows[0] as Record<string, unknown>;
    return {
      gameRef,
      pgnText:       strOf(row.pgn_text),
      revisionToken: strOf(row.revision_token),
      title:         strOf(row.title_hint),
    };
  },

  save: async (
    gameRef: PgnGameRef,
    pgnText: string,
    options?: PgnSaveOptions,
  ): Promise<PgnSaveGameResult> => {
    const dbPath = String(gameRef.locator || "").trim();
    const gameId = String(gameRef.recordId || "").trim();
    if (!dbPath) throw new PgnResourceError("validation_failed", "DB game ref is missing locator.");
    if (!gameId) throw new PgnResourceError("validation_failed", "DB game ref is missing recordId.");

    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    if (options?.expectedRevisionToken) {
      const rows = await db.query("SELECT revision_token FROM games WHERE id = ?", [gameId]);
      if (rows.length === 0) {
        throw new PgnResourceError("not_found", `Game ${gameId} not found in ${dbPath}.`);
      }
      const stored = strOf((rows[0] as Record<string, unknown>).revision_token);
      if (stored !== options.expectedRevisionToken) {
        throw new PgnResourceError(
          "conflict",
          `Revision conflict for game ${gameId}: expected ${options.expectedRevisionToken}, found ${stored}.`,
        );
      }
    }

    const newToken = generateRevisionToken();
    const now = Date.now();
    const kind = detectKind(pgnText);

    await db.transaction(async (tx) => {
      await tx.execute(
        "UPDATE games SET pgn_text = ?, revision_token = ?, updated_at = ?, kind = ? WHERE id = ?",
        [pgnText, newToken, now, kind, gameId],
      );
      await tx.execute("DELETE FROM game_metadata WHERE game_id = ?", [gameId]);
      await writeMetadata(tx, gameId, pgnText);
      await tx.execute("DELETE FROM position_hashes WHERE game_id = ?", [gameId]);
      await writePositionIndex(tx, gameId, pgnText);
      await tx.execute("DELETE FROM move_edges WHERE game_id = ?", [gameId]);
      await writeMoveEdgeIndex(tx, gameId, pgnText);
    });

    return { gameRef, revisionToken: newToken };
  },

  create: async (
    resourceRef: PgnResourceRef,
    pgnText: string,
    title: string,
  ): Promise<PgnCreateGameResult> => {
    const dbPath = String(resourceRef.locator || "").trim();
    if (!dbPath) throw new PgnResourceError("validation_failed", "DB resource ref is missing locator.");

    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    const maxRows = await db.query("SELECT MAX(order_index) AS max_order FROM games");
    const maxOrder = Number((maxRows[0] as Record<string, unknown>)?.max_order ?? -1);
    const orderIndex = maxOrder + 1;

    const id = generateId();
    const revisionToken = generateRevisionToken();
    const now = Date.now();
    const titleHint = String(title || "").trim();
    const kind = detectKind(pgnText);

    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO games (id, pgn_text, title_hint, created_at, updated_at, order_index, revision_token, kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, pgnText, titleHint, now, now, orderIndex, revisionToken, kind],
      );
      await writeMetadata(tx, id, pgnText);
      await writePositionIndex(tx, id, pgnText);
      await writeMoveEdgeIndex(tx, id, pgnText);
    });

    return {
      gameRef: { kind: "db", locator: dbPath, recordId: id },
      revisionToken,
      title: titleHint,
    };
  },

  searchByPositionHash: async (positionHash: string, resourceRef: PgnResourceRef): Promise<PgnGameRef[]> => {
    const dbPath = String(resourceRef.locator || "").trim();
    if (!dbPath || !positionHash) return [];
    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);
    const rows = await db.query(
      "SELECT DISTINCT game_id FROM position_hashes WHERE hash = ?",
      [positionHash],
    );
    return rows.map((r) => asGameRef(r, dbPath)).filter((ref) => ref.recordId !== "");
  },

  explorePosition: async (positionHash: string, resourceRef: PgnResourceRef): Promise<MoveFrequencyEntry[]> => {
    const dbPath = String(resourceRef.locator || "").trim();
    if (!dbPath || !positionHash) return [];
    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);
    const rows = await db.query(
      `SELECT move_san, move_uci,
              COUNT(*) AS count,
              SUM(CASE result WHEN '1-0'     THEN 1 ELSE 0 END) AS white_wins,
              SUM(CASE result WHEN '1/2-1/2' THEN 1 ELSE 0 END) AS draws,
              SUM(CASE result WHEN '0-1'     THEN 1 ELSE 0 END) AS black_wins
       FROM move_edges
       WHERE position_hash = ?
       GROUP BY move_san, move_uci
       ORDER BY COUNT(*) DESC`,
      [positionHash],
    );
    return rows.map((r) => {
      const v = r as Record<string, unknown>;
      return {
        san:       strOf(v.move_san),
        uci:       strOf(v.move_uci),
        count:     Number(v.count      ?? 0),
        whiteWins: Number(v.white_wins ?? 0),
        draws:     Number(v.draws      ?? 0),
        blackWins: Number(v.black_wins ?? 0),
      };
    }).filter((e) => e.san !== "");
  },

  searchByText: async (query: string, resourceRef: PgnResourceRef): Promise<PgnGameRef[]> => {
    const dbPath = String(resourceRef.locator || "").trim();
    const q = String(query || "").trim();
    if (!dbPath || !q) return [];
    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);
    const rows = await db.query(
      `SELECT DISTINCT game_id FROM game_metadata
       WHERE meta_key IN ('White', 'Black', 'Event', 'Site')
         AND LOWER(val_str) LIKE LOWER(?)`,
      [`%${q}%`],
    );
    return rows.map((r) => asGameRef(r, dbPath)).filter((ref) => ref.recordId !== "");
  },

  /**
   * Search for games where a metadata key matches one or more values.
   *
   * `"any"` mode: game must have at least one of the given values —
   *   `WHERE meta_key = ? AND val_str IN (…)`.
   *
   * `"all"` mode: game must have every one of the given values —
   *   `WHERE meta_key = ? AND val_str IN (…) GROUP BY game_id HAVING COUNT(DISTINCT val_str) = N`.
   */
  searchByMetadataValues: async (
    key: string,
    values: string[],
    mode: MetadataSearchMode,
    resourceRef: PgnResourceRef,
  ): Promise<PgnGameRef[]> => {
    const dbPath = String(resourceRef.locator || "").trim();
    const cleanKey = String(key || "").trim();
    if (!dbPath || !cleanKey || values.length === 0) return [];

    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    const placeholders = values.map(() => "?").join(", ");
    const params: unknown[] = [cleanKey, ...values];

    let sql: string;
    if (mode === "all") {
      params.push(values.length);
      sql = `SELECT game_id FROM game_metadata
             WHERE meta_key = ? AND val_str IN (${placeholders})
             GROUP BY game_id
             HAVING COUNT(DISTINCT val_str) = ?`;
    } else {
      sql = `SELECT DISTINCT game_id FROM game_metadata
             WHERE meta_key = ? AND val_str IN (${placeholders})`;
    }

    const rows = await db.query(sql, params);
    return rows.map((r) => asGameRef(r, dbPath)).filter((ref) => ref.recordId !== "");
  },

  reorder: async (gameRef: PgnGameRef, afterRef: PgnGameRef | null): Promise<void> => {
    const dbPath = String(gameRef.locator || "").trim();
    if (!dbPath) return;

    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    const allRows = (await db.query(
      "SELECT id, order_index FROM games ORDER BY order_index ASC, created_at ASC",
    )).map((r) => {
      const v = r as Record<string, unknown>;
      return { id: strOf(v.id), order_index: Number(v.order_index ?? 0) };
    });

    if (allRows.length === 0) return;

    if (afterRef === null) {
      const front = allRows[0];
      if (!front || front.id === gameRef.recordId) return;
      await db.execute(
        "UPDATE games SET order_index = ?, updated_at = ? WHERE id = ?",
        [front.order_index - 1, Date.now(), gameRef.recordId],
      );
      return;
    }

    const afterIdx = allRows.findIndex((r) => r.id === afterRef.recordId);
    if (afterIdx === -1) return;

    const afterOrder = allRows[afterIdx]!.order_index;
    let nextIdx = afterIdx + 1;
    while (nextIdx < allRows.length && allRows[nextIdx]!.id === gameRef.recordId) nextIdx++;
    const nextOrder = nextIdx < allRows.length ? allRows[nextIdx]!.order_index : afterOrder + 2;

    await db.execute(
      "UPDATE games SET order_index = ?, updated_at = ? WHERE id = ?",
      [(afterOrder + nextOrder) / 2, Date.now(), gameRef.recordId],
    );
  },
  };
};
