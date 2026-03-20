/**
 * Database schema manifest (deferred DB path).
 *
 * Integration API:
 * - Primary export: `SCHEMA_VERSIONS`.
 *
 * Configuration API:
 * - Ordered version list used by migration runner/ledger.
 *
 * Communication API:
 * - Static manifest only; no side effects.
 */
export const SCHEMA_VERSIONS = [
  "0001_init",
  "0002_indexes",
  "0003_metadata",
] as const;
