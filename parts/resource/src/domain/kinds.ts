/**
 * Canonical resource kind constants.
 *
 * Integration API:
 * - Primary exports: `PGN_RESOURCE_KINDS`, `PgnResourceKind`.
 *
 * Configuration API:
 * - Kind list is static and ordered.
 *
 * Communication API:
 * - Compile-time/runtime constants only; no side effects.
 */
export const PGN_RESOURCE_KINDS = ["file", "directory", "db"] as const;

/** Canonical resource-kind union derived from `PGN_RESOURCE_KINDS`. */
export type PgnResourceKind = (typeof PGN_RESOURCE_KINDS)[number];
