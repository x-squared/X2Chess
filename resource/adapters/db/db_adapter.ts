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
 */

import { PgnResourceError } from "../../domain/actions";
import type { PgnResourceAdapter, PgnSaveOptions } from "../../domain/contracts";
import type { PgnGameRef } from "../../domain/game_ref";
import type { PgnResourceRef } from "../../domain/resource_ref";
import type { PgnListGamesResult, PgnLoadGameResult, PgnSaveGameResult, PgnCreateGameResult } from "../../domain/actions";
import type { DbGateway } from "../../io/db_gateway";
import { runMigrations } from "../../database/migrations/runner";
import { extractPgnMetadata } from "../../domain/metadata";
import type { BuildPositionIndex } from "./position_index";

// ── Per-path migration cache ───────────────────────────────────────────────────

const migratedPaths = new Set<string>();

const ensureMigrated = async (db: DbGateway, dbPath: string): Promise<void> => {
  if (migratedPaths.has(dbPath)) return;
  await runMigrations(db);
  migratedPaths.add(dbPath);
};

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
const deriveTitle = (metadata: Record<string, string>, titleHint: string): string => {
  const white = String(metadata.White || "").trim();
  const black = String(metadata.Black || "").trim();
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

type MetaRow = {
  game_id: string;
  meta_key: string;
  val_str: string | null;
};

const asGameRow = (r: unknown): GameRow => {
  const v = r as Record<string, unknown>;
  return {
    id: String(v.id ?? ""),
    title_hint: String(v.title_hint ?? ""),
    revision_token: String(v.revision_token ?? ""),
    order_index: Number(v.order_index ?? 0),
    created_at: Number(v.created_at ?? 0),
    kind: String(v.kind ?? "game"),
  };
};

const asMetaRow = (r: unknown): MetaRow => {
  const v = r as Record<string, unknown>;
  return {
    game_id: String(v.game_id ?? ""),
    meta_key: String(v.meta_key ?? ""),
    val_str: v.val_str == null ? null : String(v.val_str),
  };
};

// ── Kind detection ─────────────────────────────────────────────────────────────

/** Detect game kind from PGN text: 'position' if [SetUp "1"] is present. */
const detectKind = (pgnText: string): string =>
  /\[SetUp\s+"1"\]/i.test(pgnText) ? "position" : "game";

// ── Metadata helpers ───────────────────────────────────────────────────────────

const makeWritePositionIndex = (indexer: BuildPositionIndex | undefined) =>
  async (db: DbGateway, gameId: string, pgnText: string): Promise<void> => {
    if (!indexer) return;
    const records = indexer(pgnText);
    for (const { ply, hash } of records) {
      await db.execute(
        "INSERT OR IGNORE INTO position_hashes (hash, game_id, ply) VALUES (?, ?, ?)",
        [hash, gameId, ply],
      );
    }
  };

const writeMetadata = async (
  db: DbGateway,
  gameId: string,
  pgnText: string,
): Promise<void> => {
  const { metadata, availableMetadataKeys } = extractPgnMetadata(pgnText);

  for (const key of availableMetadataKeys) {
    const val = String(metadata[key] ?? "");
    if (!val) continue;
    await db.execute(
      "INSERT OR REPLACE INTO game_metadata (game_id, meta_key, val_str) VALUES (?, ?, ?)",
      [gameId, key, val],
    );
    await db.execute(
      "INSERT OR IGNORE INTO metadata_keys (key, value_type) VALUES (?, 'string')",
      [key],
    );
  }
};

const loadMetadataForGames = async (
  db: DbGateway,
  gameIds: string[],
): Promise<Map<string, Record<string, string>>> => {
  const result = new Map<string, Record<string, string>>();
  if (gameIds.length === 0) return result;

  const placeholders = gameIds.map(() => "?").join(", ");
  const rows = await db.query(
    `SELECT game_id, meta_key, val_str FROM game_metadata WHERE game_id IN (${placeholders})`,
    gameIds,
  );

  for (const row of rows) {
    const { game_id, meta_key, val_str } = asMetaRow(row);
    if (!result.has(game_id)) result.set(game_id, {});
    if (val_str !== null) result.get(game_id)![meta_key] = val_str;
  }
  return result;
};

const loadAvailableMetadataKeys = async (db: DbGateway): Promise<string[]> => {
  const rows = await db.query("SELECT key FROM metadata_keys ORDER BY key ASC");
  return rows.map((r) => String((r as Record<string, unknown>).key ?? "")).filter(Boolean);
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
  options?: { buildPositionIndex?: BuildPositionIndex },
): PgnResourceAdapter => {
  const writePositionIndex = makeWritePositionIndex(options?.buildPositionIndex);
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
    const metaByGame = await loadMetadataForGames(db, gameIds);
    const availableMetadataKeys = await loadAvailableMetadataKeys(db);

    return {
      entries: gameRows.map((row) => {
        const metadata = metaByGame.get(row.id) ?? {};
        return {
          gameRef: { kind: "db", locator: dbPath, recordId: row.id },
          title: deriveTitle(metadata, row.title_hint),
          revisionToken: row.revision_token,
          metadata,
          availableMetadataKeys,
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
      pgnText: String(row.pgn_text ?? ""),
      revisionToken: String(row.revision_token ?? ""),
      title: String(row.title_hint ?? ""),
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
      const rows = await db.query(
        "SELECT revision_token FROM games WHERE id = ?",
        [gameId],
      );
      if (rows.length === 0) {
        throw new PgnResourceError("not_found", `Game ${gameId} not found in ${dbPath}.`);
      }
      const stored = String((rows[0] as Record<string, unknown>).revision_token ?? "");
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
    await db.execute(
      "UPDATE games SET pgn_text = ?, revision_token = ?, updated_at = ?, kind = ? WHERE id = ?",
      [pgnText, newToken, now, kind, gameId],
    );
    await db.execute("DELETE FROM game_metadata WHERE game_id = ?", [gameId]);
    await writeMetadata(db, gameId, pgnText);
    await db.execute("DELETE FROM position_hashes WHERE game_id = ?", [gameId]);
    await writePositionIndex(db, gameId, pgnText);

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
    const orderIndex = maxOrder + 1.0;

    const id = generateId();
    const revisionToken = generateRevisionToken();
    const now = Date.now();
    const titleHint = String(title || "").trim();
    const kind = detectKind(pgnText);

    await db.execute(
      `INSERT INTO games (id, pgn_text, title_hint, created_at, updated_at, order_index, revision_token, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pgnText, titleHint, now, now, orderIndex, revisionToken, kind],
    );
    await writeMetadata(db, id, pgnText);
    await writePositionIndex(db, id, pgnText);

    return {
      gameRef: { kind: "db", locator: dbPath, recordId: id },
      revisionToken,
      title: titleHint,
    };
  },

  reorder: async (gameRef: PgnGameRef, neighborGameRef: PgnGameRef): Promise<void> => {
    const dbPath = String(gameRef.locator || "").trim();
    if (!dbPath) return;

    const db = gatewayForPath(dbPath);
    await ensureMigrated(db, dbPath);

    const rows1 = await db.query("SELECT order_index FROM games WHERE id = ?", [gameRef.recordId]);
    const rows2 = await db.query("SELECT order_index FROM games WHERE id = ?", [neighborGameRef.recordId]);
    if (rows1.length === 0 || rows2.length === 0) return;

    const idx1 = (rows1[0] as Record<string, unknown>).order_index;
    const idx2 = (rows2[0] as Record<string, unknown>).order_index;
    const now = Date.now();

    await db.execute("UPDATE games SET order_index = ?, updated_at = ? WHERE id = ?", [idx2, now, gameRef.recordId]);
    await db.execute("UPDATE games SET order_index = ?, updated_at = ? WHERE id = ?", [idx1, now, neighborGameRef.recordId]);
  },
  };
};
