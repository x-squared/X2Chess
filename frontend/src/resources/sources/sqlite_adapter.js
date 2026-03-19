/**
 * SQLite source adapter.
 *
 * Integration API:
 * - `createSqliteSourceAdapter()`
 *
 * Configuration API:
 * - This adapter is interface-complete but currently a stub.
 *
 * Communication API:
 * - Exposes the same shape as file adapters for registry uniformity.
 */

/**
 * Create SQLite source adapter.
 *
 * @returns {{kind: string, list: Function, load: Function, save: Function}} Adapter object.
 */
export const createSqliteSourceAdapter = () => {
  /**
   * Stub list operation.
   *
   * @returns {Promise<Array<{sourceRef: object, titleHint: string, revisionToken: string}>>} Empty list.
   */
  const list = async () => [];

  /**
   * Stub load operation.
   *
   * @returns {Promise<never>} Always rejects until SQLite backend is implemented.
   */
  const load = async () => {
    throw new Error("SQLite source adapter is not implemented yet.");
  };

  /**
   * Stub save operation.
   *
   * @returns {Promise<never>} Always rejects until SQLite backend is implemented.
   */
  const save = async () => {
    throw new Error("SQLite source adapter is not implemented yet.");
  };

  return {
    kind: "sqlite",
    list,
    load,
    save,
  };
};

