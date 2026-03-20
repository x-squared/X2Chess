import { PgnResourceError } from "../../domain/actions";
import type { PgnResourceAdapter } from "../../domain/contracts";

/**
 * Canonical database adapter placeholder (deferred).
 *
 * Integration API:
 * - Primary export: `createDbAdapter`.
 *
 * Configuration API:
 * - No runtime options currently; full DB wiring is deferred.
 *
 * Communication API:
 * - `list` returns empty set.
 * - `load/save/create` throw `schema_outdated` until DB implementation is enabled.
 */
export const createDbAdapter = (): PgnResourceAdapter => ({
  kind: "db",
  list: async () => ({ entries: [] }),
  load: async () => {
    throw new PgnResourceError("schema_outdated", "DB adapter load is not implemented yet.");
  },
  save: async () => {
    throw new PgnResourceError("schema_outdated", "DB adapter save is not implemented yet.");
  },
  create: async () => {
    throw new PgnResourceError("schema_outdated", "DB adapter create is not implemented yet.");
  },
});
