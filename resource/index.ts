/**
 * Resource library public entrypoint.
 *
 * Integration API:
 * - Re-exports canonical PGN resource contracts, adapters, and client factories.
 *
 * Configuration API:
 * - No runtime configuration in this module; consumers configure behavior via imported factories.
 *
 * Communication API:
 * - Compile-time module boundary only; no I/O and no state mutation.
 */

export * from "./domain/kinds";
export * from "./domain/resource_ref";
export * from "./domain/game_ref";
export * from "./domain/game_entry";
export * from "./domain/actions";
export * from "./domain/metadata";
export * from "./domain/metadata_schema";
export * from "./domain/contracts";
export * from "./adapters";
export * from "./client/capabilities";
export * from "./client/api";
export * from "./client/default_client";
