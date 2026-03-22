/**
 * Database schema manifest — ordered migration list with embedded SQL.
 *
 * Integration API:
 * - Primary export: `MIGRATIONS`.
 *
 * Configuration API:
 * - Each migration is a version number plus an ordered list of SQL statements
 *   (one statement per string; runner executes them individually).
 *
 * Communication API:
 * - Static manifest only; no side effects.
 */

export type Migration = {
  version: number;
  statements: readonly string[];
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS games (
        id             TEXT    PRIMARY KEY,
        pgn_text       TEXT    NOT NULL,
        title_hint     TEXT    NOT NULL DEFAULT '',
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL,
        order_index    REAL    NOT NULL DEFAULT 0.0,
        revision_token TEXT    NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS game_metadata (
        game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        meta_key TEXT NOT NULL,
        val_str  TEXT,
        PRIMARY KEY (game_id, meta_key)
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE INDEX IF NOT EXISTS idx_game_metadata_key     ON game_metadata(meta_key)`,
      `CREATE INDEX IF NOT EXISTS idx_game_metadata_key_val ON game_metadata(meta_key, val_str)`,
      `CREATE INDEX IF NOT EXISTS idx_games_order           ON games(order_index, created_at)`,
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE IF NOT EXISTS metadata_keys (
        key        TEXT PRIMARY KEY,
        value_type TEXT NOT NULL DEFAULT 'string'
      )`,
    ],
  },
  {
    version: 4,
    statements: [
      `CREATE TABLE IF NOT EXISTS position_hashes (
        hash     TEXT    NOT NULL,
        game_id  TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        ply      INTEGER NOT NULL,
        PRIMARY KEY (hash, game_id, ply)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_position_hashes_hash ON position_hashes(hash)`,
    ],
  },
  {
    version: 5,
    statements: [
      `ALTER TABLE games ADD COLUMN kind TEXT NOT NULL DEFAULT 'game'`,
    ],
  },
  {
    version: 6,
    statements: [
      `CREATE TABLE IF NOT EXISTS training_transcripts (
        session_id     TEXT    PRIMARY KEY,
        source_game_id TEXT    NOT NULL,
        protocol       TEXT    NOT NULL,
        started_at     INTEGER NOT NULL,
        completed_at   INTEGER,
        aborted        INTEGER NOT NULL DEFAULT 0,
        config_json    TEXT    NOT NULL DEFAULT '{}',
        ply_records    TEXT    NOT NULL DEFAULT '[]',
        annotations    TEXT    NOT NULL DEFAULT '[]'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_transcripts_game ON training_transcripts(source_game_id)`,
    ],
  },
  {
    version: 7,
    statements: [
      `CREATE TABLE IF NOT EXISTS move_edges (
        position_hash TEXT NOT NULL,
        move_san      TEXT NOT NULL,
        move_uci      TEXT NOT NULL,
        result        TEXT NOT NULL DEFAULT '*',
        game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        PRIMARY KEY (position_hash, game_id, move_uci)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_move_edges_hash ON move_edges(position_hash)`,
    ],
  },
] as const;
