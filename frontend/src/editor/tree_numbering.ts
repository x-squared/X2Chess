/**
 * Re-export shim — the implementation has moved to `./plan/tree_mode.ts`.
 *
 * Tests and any other consumers importing from this path continue to work
 * without change.
 */

export type { VariationNumberingStrategy } from "./plan/tree_mode";
export { alphaNumericPathStrategy } from "./plan/tree_mode";
