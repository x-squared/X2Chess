/**
 * db_indexer — write-side indexing helpers for the DB adapter.
 *
 * Provides the three write-path helpers that populate the position_hashes,
 * move_edges, and game_metadata tables whenever a game is created or saved.
 * Separated from db_adapter.ts so the indexing logic can evolve independently.
 *
 * Multi-valued fields: when PGN headers contain repeated lines for the same key
 * (e.g. two `[Character "..."]` lines), `writeMetadata` writes one row per value
 * with increasing `ordinal` and records `cardinality = 'many'` in `metadata_keys`.
 * Single-occurrence keys always use `ordinal = 0` and `cardinality = 'one'`.
 *
 * Cardinality is recalculated after every write so that removing multi-valued
 * fields from a game can downgrade a key back to `'one'` once no game in the
 * database retains multiple values for it.
 *
 * **Derived index pipeline:** `rewriteDerivedGameIndexes` is the only supported
 * way to refresh `game_metadata`, `position_hashes`, and `move_edges` from a game’s
 * `pgn_text` (with position/move indexers injected by the adapter factory).
 */

import type { DbGateway } from "../../io/db_gateway";
import { extractMultiPgnMetadata, extractPgnMetadata, extractPgnMetadataFromSource } from "../../domain/metadata";
import { materialKeyFromFen } from "../../domain/material_key";
import { PGN_STANDARD_METADATA_KEYS } from "../../domain/metadata_schema";
import type { BuildPositionIndex } from "./position_index";
import type { BuildMoveEdgeIndex } from "./move_edge_index";

// ── Internal row type ─────────────────────────────────────────────────────────

type MetaRow = {
  game_id: string;
  meta_key: string;
  ordinal: number;
  val_str: string | null;
};

export const asMetaRow = (r: unknown): MetaRow => {
  const v = r as Record<string, unknown>;
  return {
    game_id:  typeof v.game_id  === "string" ? v.game_id  : "",
    meta_key: typeof v.meta_key === "string" ? v.meta_key : "",
    ordinal:  typeof v.ordinal  === "number" ? v.ordinal  : 0,
    val_str:  typeof v.val_str  === "string" ? v.val_str  : null,
  };
};

// ── Batch-INSERT chunk size ───────────────────────────────────────────────────

const BATCH_SIZE = 500;

// ── Write helpers ─────────────────────────────────────────────────────────────

export const makeWritePositionIndex = (indexer: BuildPositionIndex | undefined) =>
  async (db: DbGateway, gameId: string, pgnText: string): Promise<void> => {
    if (!indexer) return;
    const records = indexer(pgnText);
    if (records.length === 0) return;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
      const params: unknown[] = chunk.flatMap(({ hash, ply }) => [hash, gameId, ply]);
      await db.execute(
        `INSERT OR IGNORE INTO position_hashes (hash, game_id, ply) VALUES ${placeholders}`,
        params,
      );
    }
  };

export const makeWriteMoveEdgeIndex = (indexer: BuildMoveEdgeIndex | undefined) =>
  async (db: DbGateway, gameId: string, pgnText: string): Promise<void> => {
    if (!indexer) return;
    const edges = indexer(pgnText);
    if (edges.length === 0) return;

    for (let i = 0; i < edges.length; i += BATCH_SIZE) {
      const chunk = edges.slice(i, i + BATCH_SIZE);
      const placeholders = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = chunk.flatMap(
        ({ positionHash, moveSan, moveUci, result }) => [positionHash, moveSan, moveUci, result, gameId],
      );
      await db.execute(
        `INSERT OR REPLACE INTO move_edges (position_hash, move_san, move_uci, result, game_id) VALUES ${placeholders}`,
        params,
      );
    }
  };

// ── Metadata write helpers ────────────────────────────────────────────────────

/** Write all ordinal rows for one metadata key. */
const writeMetadataKey = async (
  db: DbGateway,
  gameId: string,
  key: string,
  values: string[],
): Promise<void> => {
  const nonEmpty = values.filter((v) => v !== "");
  if (nonEmpty.length === 0) return;

  const placeholders = nonEmpty.map(() => "(?, ?, ?, ?)").join(", ");
  const params: unknown[] = nonEmpty.flatMap((val, ordinal) => [gameId, key, ordinal, val]);
  await db.execute(
    `INSERT OR REPLACE INTO game_metadata (game_id, meta_key, ordinal, val_str) VALUES ${placeholders}`,
    params,
  );

  // Ensure the key exists in the catalog (cardinality is recalculated separately).
  await db.execute(
    `INSERT OR IGNORE INTO metadata_keys (key, value_type, cardinality) VALUES (?, 'string', 'one')`,
    [key],
  );
};

/**
 * Recalculate `cardinality` for each key in `keys` by inspecting how many
 * distinct ordinal values exist across all games in the database.
 *
 * A key is `'many'` when at least one game stores more than one value for it
 * (i.e. `ordinal > 0` exists).  Otherwise it is `'one'`.
 *
 * This is called after every metadata rewrite so that removing multi-valued
 * headers from a game can downgrade the cardinality once no game retains them.
 */
const recalculateCardinality = async (db: DbGateway, keys: string[]): Promise<void> => {
  for (const key of keys) {
    const rows = await db.query(
      "SELECT COUNT(*) AS cnt FROM game_metadata WHERE meta_key = ? AND ordinal > 0",
      [key],
    );
    const hasMulti = Number((rows[0] as Record<string, unknown>)?.cnt ?? 0) > 0;
    await db.execute(
      "UPDATE metadata_keys SET cardinality = ? WHERE key = ?",
      [hasMulti ? "many" : "one", key],
    );
  }
};

/**
 * Write metadata index rows for one game and refresh cardinality.
 *
 * @param db Live database gateway.
 * @param gameId Game UUID.
 * @param pgnText Full PGN text for the game.
 */
/** Position + move index writers produced by {@link makeWritePositionIndex} / {@link makeWriteMoveEdgeIndex}. */
export type GameIndexWriters = {
  writePositionIndex: (db: DbGateway, gameId: string, pgnText: string) => Promise<void>;
  writeMoveEdgeIndex: (db: DbGateway, gameId: string, pgnText: string) => Promise<void>;
};

/**
 * Rebuild all PGN-derived index tables for one game inside the current transaction.
 * Deletes prior rows for that game, then repopulates from `pgnText`.
 *
 * @param db Transaction gateway (must not enqueue unrelated work interleaved on the same connection).
 * @param gameId Game primary key.
 * @param pgnText Full PGN to index.
 * @param writers Injected index builders from the adapter factory.
 */
export const rewriteDerivedGameIndexes = async (
  db: DbGateway,
  gameId: string,
  pgnText: string,
  writers: GameIndexWriters,
): Promise<void> => {
  await db.execute("DELETE FROM game_metadata WHERE game_id = ?", [gameId]);
  await writeMetadata(db, gameId, pgnText);
  await db.execute("DELETE FROM position_hashes WHERE game_id = ?", [gameId]);
  await writers.writePositionIndex(db, gameId, pgnText);
  await db.execute("DELETE FROM move_edges WHERE game_id = ?", [gameId]);
  await writers.writeMoveEdgeIndex(db, gameId, pgnText);
};

export const writeMetadata = async (
  db: DbGateway,
  gameId: string,
  pgnText: string,
): Promise<void> => {
  const allValues = extractMultiPgnMetadata(pgnText, allHeaderKeys(pgnText));
  const writtenKeys: string[] = [];

  for (const key of Object.keys(allValues)) {
    const values = allValues[key] ?? [];
    if (values.length > 0) {
      await writeMetadataKey(db, gameId, key, values);
      writtenKeys.push(key);
    }
  }

  await writeMaterialKey(db, gameId, pgnText);
  if (pgnText && /\[SetUp\s+"1"\]/i.test(pgnText)) writtenKeys.push("Material");

  await recalculateCardinality(db, writtenKeys);
};

/** Derive and write the Material key for position games. */
const writeMaterialKey = async (
  db: DbGateway,
  gameId: string,
  pgnText: string,
): Promise<void> => {
  if (!/\[SetUp\s+"1"\]/i.test(pgnText)) return;
  const { metadata: fenMeta } = extractPgnMetadata(pgnText, ["FEN"]);
  const fenValue = String(fenMeta["FEN"] ?? "").trim();
  const materialKey = fenValue ? materialKeyFromFen(fenValue) : "";
  if (!materialKey) return;

  await db.execute(
    `INSERT OR REPLACE INTO game_metadata (game_id, meta_key, ordinal, val_str)
     VALUES (?, ?, ?, ?)`,
    [gameId, "Material", 0, materialKey],
  );
  await db.execute(
    `INSERT OR IGNORE INTO metadata_keys (key, value_type, cardinality) VALUES (?, 'string', 'one')`,
    ["Material"],
  );
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Distinct header key names for indexing — same bracket parse as SSOT extraction.
 */
const allHeaderKeys = (pgnText: string): string[] => {
  const seen = new Set<string>(PGN_STANDARD_METADATA_KEYS);
  for (const key of Object.keys(extractPgnMetadataFromSource(pgnText).metadata)) {
    seen.add(key);
  }
  return [...seen];
};
