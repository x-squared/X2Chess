import type { PgnGameRef } from "./game_ref";

/**
 * Canonical listed-game payload.
 *
 * Integration API:
 * - Primary export: `PgnGameEntry`.
 *
 * Configuration API:
 * - Contains game identity, display title, revision marker, and metadata columns.
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
