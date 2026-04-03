/**
 * storage — versioned localStorage store primitives.
 *
 * Re-exports the public API of `versioned_store` for clean external imports.
 */

export type {
  StorageBackend,
  StoredEnvelope,
  MigrationStep,
  VersionedStoreConfig,
  VersionedStore,
} from "./versioned_store";

export { createVersionedStore } from "./versioned_store";
