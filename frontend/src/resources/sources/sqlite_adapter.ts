/**
 * SQLite source adapter.
 *
 * Integration API:
 * - Register this adapter with the source registry to reserve the `sqlite` kind
 *   in the uniform adapter contract.
 *
 * Configuration API:
 * - No runtime configuration yet; implementation is intentionally a stub until
 *   SQLite read/write operations are introduced.
 *
 * Communication API:
 * - Keeps API shape consistent with other adapters (`kind`, `list`, `load`, `save`).
 * - `list()` returns an empty result; `load()` and `save()` throw "not implemented".
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
   * @returns {Promise<Array<{sourceRef: object, titleHint: string, revisionToken: string, metadata?: object, availableMetadataKeys?: string[]}>>} Empty list.
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

