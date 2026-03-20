/**
 * PGN metadata compatibility shim.
 *
 * Integration API:
 * - Re-exports `extractPgnMetadata` and `PGN_STANDARD_METADATA_KEYS` from the top-level
 *   `resource/domain/metadata` module.
 *
 * Configuration API:
 * - No runtime configuration in this shim.
 *
 * Communication API:
 * - Compile-time re-export only; no side effects.
 */
export { extractPgnMetadata, PGN_STANDARD_METADATA_KEYS } from "../../../../resource/domain/metadata";
