import { createDbAdapter } from "./db/db_adapter";
import { createDirectoryAdapter } from "./directory/directory_adapter";
import { createFileAdapter } from "./file/file_adapter";
import type { PgnResourceAdapter } from "../domain/contracts";
import type { PgnResourceKind } from "../domain/kinds";

/**
 * Default canonical adapter registry factory.
 *
 * Integration API:
 * - Primary export: `createDefaultAdapters`.
 *
 * Configuration API:
 * - No runtime options; uses built-in adapter constructors for `db`, `directory`, and `file`.
 *
 * Communication API:
 * - Returns kind-indexed adapter map for `createResourceClient`.
 */
export const createDefaultAdapters = (): Record<PgnResourceKind, PgnResourceAdapter> => ({
  db: createDbAdapter(),
  directory: createDirectoryAdapter(),
  file: createFileAdapter(),
});
