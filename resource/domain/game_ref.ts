import type { PgnResourceRef } from "./resource_ref";

/**
 * Canonical game reference contract.
 *
 * Integration API:
 * - Primary export: `PgnGameRef`.
 *
 * Configuration API:
 * - Extends `PgnResourceRef` with `recordId` to identify one game within the resource.
 *
 * Communication API:
 * - Shared identifier object used by `load/save` operations.
 */
export type PgnGameRef = PgnResourceRef & {
  recordId: string;
};
