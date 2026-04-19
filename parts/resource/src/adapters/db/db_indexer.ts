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

// ── Write helpers ─────────────────────────────────────────────────────────────

export const makeWritePositionIndex = (indexer: BuildPositionIndex | undefined) =>
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

export const makeWriteMoveEdgeIndex = (indexer: BuildMoveEdgeIndex | undefined) =>
  async (db: DbGateway, gameId: string, pgnText: string): Promise<void> => {
    if (!indexer) return;
    const edges = indexer(pgnText);
    for (const { positionHash, moveSan, moveUci, result } of edges) {
      await db.execute(
        `INSERT OR REPLACE INTO move_edges (position_hash, move_san, move_uci, result, game_id)
         VALUES (?, ?, ?, ?, ?)`,
        [positionHash, moveSan, moveUci, result, gameId],
      );
    }
  };

// ── Metadata write helpers ────────────────────────────────────────────────────

/** Write all ordinal rows for one metadata key and register its cardinality. */
const writeMetadataKey = async (
  db: DbGateway,
  gameId: string,
  key: string,
  values: string[],
): Promise<void> => {
  const cardinality = values.length > 1 ? "many" : "one";

  for (let ordinal = 0; ordinal < values.length; ordinal++) {
    const val = values[ordinal];
    if (val === undefined || val === "") continue;
    await db.execute(
      `INSERT OR REPLACE INTO game_metadata (game_id, meta_key, ordinal, val_str)
       VALUES (?, ?, ?, ?)`,
      [gameId, key, ordinal, val],
    );
  }

  await db.execute(
    `INSERT OR IGNORE INTO metadata_keys (key, value_type, cardinality) VALUES (?, 'string', ?)`,
    [key, cardinality],
  );
  if (cardinality === "many") {
    await db.execute(
      `UPDATE metadata_keys SET cardinality = 'many' WHERE key = ? AND cardinality = 'one'`,
      [key],
    );
  }
};

/**
 * Write metadata index rows for one game.
 *
 * Strategy:
 * - Collect all header occurrences per key using `extractMultiPgnMetadata`.
 * - For keys with one value: write ordinal=0, cardinality='one'.
 * - For keys with multiple values: write ordinal=0,1,2,…, cardinality='many'.
 * - For position games, derive and index the `Material` key from the FEN.
 *
 * @param db Live database gateway.
 * @param gameId Game UUID.
 * @param pgnText Full PGN text for the game.
 */
export const writeMetadata = async (
  db: DbGateway,
  gameId: string,
  pgnText: string,
): Promise<void> => {
  const allValues = extractMultiPgnMetadata(pgnText, allHeaderKeys(pgnText));

  for (const key of Object.keys(allValues)) {
    const values = allValues[key] ?? [];
    if (values.length > 0) {
      await writeMetadataKey(db, gameId, key, values);
    }
  }

  await writeMaterialKey(db, gameId, pgnText);
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
