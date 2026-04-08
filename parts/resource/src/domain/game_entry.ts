import type { PgnGameRef } from "./game_ref";
import type { MetadataKeyInfo } from "./metadata_schema";

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
 * - `metadata` values are strings for `cardinality: "one"` fields and string arrays
 *   for `cardinality: "many"` fields.
 * - `metadataKeyInfos` carries key + cardinality for every key present in this resource;
 *   available when the adapter tracks key cardinality (db kind). Absent for file/directory.
 *
 * Communication API:
 * - Returned by `list` operations; consumed by resource viewer/session routing.
 */
export type PgnGameEntry = {
  gameRef: PgnGameRef;
  title: string;
  revisionToken: string;
  /** Values are `string` for single-valued fields and `string[]` for multi-valued fields. */
  metadata: Record<string, string | string[]>;
  /** Ordered list of metadata key names present in this resource. */
  availableMetadataKeys: string[];
  /**
   * Key registry with cardinality information.
   * Present for adapters that track cardinality (db kind); absent otherwise.
   */
  metadataKeyInfos?: MetadataKeyInfo[];
  /** Whether the record represents a full game or a position setup. Absent for file/directory. */
  gameKind?: "game" | "position";
};
