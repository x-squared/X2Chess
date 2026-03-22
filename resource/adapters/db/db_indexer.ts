/**
 * db_indexer — write-side indexing helpers for the DB adapter.
 *
 * Provides the three write-path helpers that populate the position_hashes,
 * move_edges, and game_metadata tables whenever a game is created or saved.
 * Separated from db_adapter.ts so the indexing logic can evolve independently.
 */

import type { DbGateway } from "../../io/db_gateway";
import { extractPgnMetadata } from "../../domain/metadata";
import type { BuildPositionIndex } from "./position_index";
import type { BuildMoveEdgeIndex } from "./move_edge_index";

// ── Internal row type ─────────────────────────────────────────────────────────

type MetaRow = {
  game_id: string;
  meta_key: string;
  val_str: string | null;
};

export const asMetaRow = (r: unknown): MetaRow => {
  const v = r as Record<string, unknown>;
  return {
    game_id: String(v.game_id ?? ""),
    meta_key: String(v.meta_key ?? ""),
    val_str: v.val_str == null ? null : String(v.val_str),
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

export const writeMetadata = async (
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
