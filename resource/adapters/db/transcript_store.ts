/**
 * transcript_store — SQLite-backed training transcript persistence (T9).
 *
 * Saves and retrieves `TrainingTranscript` records in the
 * `training_transcripts` table (migration v6).
 *
 * Integration API:
 * - `createTranscriptStore(db)` — factory; call once per open DB gateway.
 *
 * Configuration API:
 * - No configuration; schema is managed by the migration runner.
 *
 * Communication API:
 * - All I/O delegated to the injected `DbGateway`.
 */

import type { DbGateway } from "../../io/db_gateway";

// ── Transcript types (mirrors frontend domain) ─────────────────────────────────
// These are value objects — no domain logic here, just persistence contracts.

export type StoredTranscript = {
  sessionId: string;
  sourceGameId: string;
  protocol: string;
  startedAt: number;    // Unix epoch ms
  completedAt?: number;
  aborted: boolean;
  config: Record<string, unknown>;
  plyRecords: unknown[];
  annotations: unknown[];
};

// ── Row type ───────────────────────────────────────────────────────────────────

type TranscriptRow = {
  session_id: string;
  source_game_id: string;
  protocol: string;
  started_at: number;
  completed_at: number | null;
  aborted: number;
  config_json: string;
  ply_records: string;
  annotations: string;
};

const rowToTranscript = (row: TranscriptRow): StoredTranscript => ({
  sessionId: row.session_id,
  sourceGameId: row.source_game_id,
  protocol: row.protocol,
  startedAt: row.started_at,
  completedAt: row.completed_at ?? undefined,
  aborted: row.aborted !== 0,
  config: JSON.parse(row.config_json || "{}") as Record<string, unknown>,
  plyRecords: JSON.parse(row.ply_records || "[]") as unknown[],
  annotations: JSON.parse(row.annotations || "[]") as unknown[],
});

// ── Store API ──────────────────────────────────────────────────────────────────

export type TranscriptStore = {
  /** Upsert a training transcript (insert or replace). */
  save(transcript: StoredTranscript): Promise<void>;
  /** Load all transcripts for a given game. */
  loadForGame(sourceGameId: string): Promise<StoredTranscript[]>;
  /** Load a single transcript by session ID. */
  loadById(sessionId: string): Promise<StoredTranscript | null>;
  /** Delete a transcript by session ID. */
  delete(sessionId: string): Promise<void>;
};

export const createTranscriptStore = (db: DbGateway): TranscriptStore => ({
  async save(t: StoredTranscript): Promise<void> {
    await db.execute(
      `INSERT INTO training_transcripts
         (session_id, source_game_id, protocol, started_at, completed_at, aborted,
          config_json, ply_records, annotations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         completed_at = excluded.completed_at,
         aborted      = excluded.aborted,
         ply_records  = excluded.ply_records,
         annotations  = excluded.annotations`,
      [
        t.sessionId,
        t.sourceGameId,
        t.protocol,
        t.startedAt,
        t.completedAt ?? null,
        t.aborted ? 1 : 0,
        JSON.stringify(t.config),
        JSON.stringify(t.plyRecords),
        JSON.stringify(t.annotations),
      ],
    );
  },

  async loadForGame(sourceGameId: string): Promise<StoredTranscript[]> {
    const rows = await db.query(
      `SELECT * FROM training_transcripts WHERE source_game_id = ? ORDER BY started_at DESC`,
      [sourceGameId],
    );
    return (rows as TranscriptRow[]).map(rowToTranscript);
  },

  async loadById(sessionId: string): Promise<StoredTranscript | null> {
    const rows = await db.query(
      `SELECT * FROM training_transcripts WHERE session_id = ?`,
      [sessionId],
    );
    const row = (rows as TranscriptRow[])[0];
    return row ? rowToTranscript(row) : null;
  },

  async delete(sessionId: string): Promise<void> {
    await db.execute(
      `DELETE FROM training_transcripts WHERE session_id = ?`,
      [sessionId],
    );
  },
});
