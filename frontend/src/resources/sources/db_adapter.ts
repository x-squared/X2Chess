/**
 * Frontend database source adapter placeholder (deferred behavior).
 *
 * Integration API:
 * - Primary export: `createDatabaseSourceAdapter`.
 *
 * Configuration API:
 * - No runtime options; this adapter remains intentionally disabled in the current migration phase.
 *
 * Communication API:
 * - `list` returns an empty array.
 * - `load` and `save` throw explicit errors to signal deferred support.
 */

/**
 * Create deferred database source adapter.
 *
 * @returns Adapter-like object with `kind`, `list`, `load`, and `save`.
 */
export const createDatabaseSourceAdapter = (): any => {
  /**
   * List database games.
   *
   * @returns Always an empty list while DB integration is deferred.
   */
  const list = async (): Promise<any> => [];

  /**
   * Load one database game.
   *
   * @throws Error Always, because DB loading is deferred.
   */
  const load = async (): Promise<any> => {
    throw new Error("Database source adapter is deferred in this migration phase.");
  };

  /**
   * Save one database game.
   *
   * @throws Error Always, because DB saving is deferred.
   */
  const save = async (): Promise<any> => {
    throw new Error("Database source adapter is deferred in this migration phase.");
  };

  return {
    kind: "db",
    list,
    load,
    save,
  };
};
