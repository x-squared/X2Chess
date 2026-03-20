import type { PgnGameRef } from "./game_ref";

/**
 * Canonical listed-game payload.
 *
 * Integration API:
 * - Primary export: `PgnGameEntry`.
 *
 * Configuration API:
 * - Contains game identity, display title, revision marker, and metadata columns.
 * - `title` is a view/display field derived by each adapter strategy at list time; it is
 *   not a canonical PGN header field in this contract.
 *   - Example strategies:
 *     - file resource: derive from headers (`Event`, `White`, `Black`) with fallback such as `Game N`.
 *     - directory resource: derive from file stem/title hint.
 *
 * Communication API:
 * - Returned by `list` operations; consumed by resource viewer/session routing.
 */
export type PgnGameEntry = {
  gameRef: PgnGameRef;
  title: string;
  revisionToken: string;
  metadata: Record<string, string>;
  availableMetadataKeys: string[];
};
