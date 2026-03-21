import { MIGRATIONS } from "../schema/schema_manifest";
import type { DbGateway } from "../../io/db_gateway";

/**
 * Database migration runner.
 *
 * Integration API:
 * - Primary export: `runMigrations`.
 *
 * Configuration API:
 * - Migrations declared in `MIGRATIONS` are applied in version order.
 * - Each migration may contain multiple SQL statements (one per array entry).
 *
 * Communication API:
 * - Reads `schema_version` table to determine applied versions.
 * - Executes each unapplied migration statement against the injected `DbGateway`.
 * - Writes applied version records back to `schema_version`.
 */

/**
 * Apply any unapplied migrations to the database.
 *
 * Safe to call on every DB open: skips versions already recorded in
 * `schema_version`. Creates `schema_version` if absent.
 *
 * @param db Live database gateway for this DB file.
 */
export const runMigrations = async (db: DbGateway): Promise<void> => {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT    NOT NULL
    )`,
  );

  const rows = await db.query("SELECT version FROM schema_version");
  const applied = new Set(rows.map((r) => (r as { version: number }).version));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    for (const sql of migration.statements) {
      await db.execute(sql);
    }
    await db.execute(
      "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
      [migration.version, new Date().toISOString()],
    );
  }
};
