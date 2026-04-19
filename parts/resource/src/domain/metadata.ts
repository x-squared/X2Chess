import {
  DEFAULT_RESOURCE_VIEWER_METADATA_KEYS,
  LEGACY_X2_STYLE_METADATA_KEY,
  LEGACY_XTWOCHESS_STYLE_METADATA_KEY,
  KNOWN_PGN_METADATA_KEYS,
  METADATA_KEY,
  PGN_METADATA_SCHEMA,
  PGN_STANDARD_METADATA_KEYS,
  X2CHESS_STYLE_METADATA_KEY,
  type HybridPgnMetadata,
} from "./metadata_schema";

/**
 * PGN metadata extraction utilities.
 *
 * Integration API:
 * - Single source of truth: `extractPgnMetadataFromSource` reads every `[Tag "..."]`
 *   line from the PGN header block (first occurrence per key) into one map.
 * - `extractPgnMetadata` / `extractHybridPgnMetadata` **narrow** that map to a key list
 *   for callers that only need a subset (UI projection — nothing is removed from disk).
 * - Also: `PGN_STANDARD_METADATA_KEYS`, `KNOWN_PGN_METADATA_KEYS`, `PGN_METADATA_SCHEMA`,
 *   `extractMultiPgnMetadata`.
 *
 * Configuration API:
 * - Narrow extractors accept optional `metadataKeys` (default: standard or known roster).
 * - `extractMultiPgnMetadata` accepts the set of keys to collect as arrays.
 *
 * Communication API:
 * - Pure parsing utilities over PGN header text; no I/O.
 */

export {
  DEFAULT_RESOURCE_VIEWER_METADATA_KEYS,
  KNOWN_PGN_METADATA_KEYS,
  METADATA_KEY,
  PGN_METADATA_SCHEMA,
  PGN_STANDARD_METADATA_KEYS,
};
export type { HybridPgnMetadata };

const resolveRawHeaderValue = (headers: Record<string, string>, key: string): string => {
  const directValue: string = String(headers[key] || "").trim();
  if (directValue) return directValue;
  if (key === X2CHESS_STYLE_METADATA_KEY) {
    const fromXtwo: string = String(headers[LEGACY_XTWOCHESS_STYLE_METADATA_KEY] || "").trim();
    if (fromXtwo) return fromXtwo;
    return String(headers[LEGACY_X2_STYLE_METADATA_KEY] || "").trim();
  }
  return directValue;
};

/**
 * Merge canonical `XSqrChessStyle` from legacy style tags when the canonical tag is absent.
 * Does not remove legacy keys from the map — adds/overwrites only the canonical key.
 *
 * @param metadata - Header map (mutated in place).
 */
const enrichCanonicalStyleFromLegacy = (metadata: Record<string, string>): void => {
  const resolved: string = resolveRawHeaderValue(metadata, X2CHESS_STYLE_METADATA_KEY).trim();
  if (resolved) {
    metadata[X2CHESS_STYLE_METADATA_KEY] = resolved;
  }
};

/**
 * Extract every unique bracket header from PGN text into one map (single source of truth for tags).
 * Document order of first occurrence is returned for discovery UIs.
 *
 * @param pgnText Raw PGN (headers + movetext).
 * @returns `metadata` — first occurrence per tag key; `discoveredKeysInOrder` — keys in order of first appearance.
 *   Canonical `XSqrChessStyle` is filled from legacy style tags when the canonical tag is absent.
 */
export const extractPgnMetadataFromSource = (
  pgnText: string,
): { metadata: Record<string, string>; discoveredKeysInOrder: string[] } => {
  const source: string = String(pgnText || "").replaceAll("\r\n", "\n");
  const metadata: Record<string, string> = {};
  const discoveredKeysInOrder: string[] = [];
  for (const line of source.split("\n")) {
    const match: RegExpMatchArray | null = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
    if (!match) continue;
    const key: string = String(match[1] || "").trim();
    const val: string = String(match[2] || "").trim();
    if (!key) continue;
    if (!Object.hasOwn(metadata, key)) {
      metadata[key] = val;
      discoveredKeysInOrder.push(key);
    }
  }
  enrichCanonicalStyleFromLegacy(metadata);
  return { metadata, discoveredKeysInOrder };
};

/**
 * Union of known catalog keys and keys present in the file, sorted for stable column catalogs.
 *
 * @param discoveredKeysInOrder Keys in first-seen order from {@link extractPgnMetadataFromSource}.
 * @returns Sorted unique key list.
 */
export const mergeMetadataCatalogKeys = (
  discoveredKeysInOrder: readonly string[],
): string[] => {
  const merged: Set<string> = new Set<string>([...KNOWN_PGN_METADATA_KEYS, ...discoveredKeysInOrder]);
  return [...merged].sort((left: string, right: string): number => left.localeCompare(right));
};

/**
 * Parse bracket header lines from PGN text, collecting all occurrences per key.
 * Used by `extractMultiPgnMetadata` to support multi-valued fields.
 *
 * @param pgnText Raw PGN source text.
 * @returns Map where each key holds all header values in document order.
 */
const parseMultiHeaderLines = (pgnText: string): Record<string, string[]> => {
  const source = String(pgnText || "").replaceAll("\r\n", "\n");
  const headers: Record<string, string[]> = {};
  source.split("\n").forEach((line: string): void => {
    const match = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
    if (!match) return;
    const key = String(match[1] || "").trim();
    const val = String(match[2] || "").trim();
    if (!key) return;
    if (!Object.hasOwn(headers, key)) headers[key] = [];
    headers[key].push(val);
  });
  return headers;
};

/**
 * Narrow {@link extractPgnMetadataFromSource} to a fixed key list (plain strings).
 *
 * @param pgnText PGN source text.
 * @param metadataKeys Ordered field keys to copy from the SSOT parse (default: standard roster).
 * @returns Subset `metadata` plus `availableMetadataKeys` matching `metadataKeys` order.
 */
export const extractPgnMetadata = (
  pgnText: string,
  metadataKeys: readonly string[] = PGN_STANDARD_METADATA_KEYS,
): { metadata: Record<string, string>; availableMetadataKeys: string[] } => {
  const { metadata: fromSource } = extractPgnMetadataFromSource(pgnText);
  const availableMetadataKeys: string[] = [];
  const metadata: Record<string, string> = {};
  (Array.isArray(metadataKeys) ? metadataKeys : []).forEach((fieldKey: string): void => {
    const key: string = String(fieldKey || "").trim();
    if (!key) return;
    availableMetadataKeys.push(key);
    metadata[key] = resolveRawHeaderValue(fromSource, key);
  });
  return { metadata, availableMetadataKeys };
};

/**
 * Narrow {@link extractPgnMetadataFromSource} through typed schema parsers where defined.
 *
 * Hybrid strategy:
 * - Known keys are parsed into typed values (`Date`, ratings, `Result`, `XSqrChessStyle`, ...).
 * - Unknown keys in the requested list are preserved as strings.
 *
 * @param pgnText PGN source text.
 * @param metadataKeys Ordered field keys (default: `KNOWN_PGN_METADATA_KEYS`).
 * @returns Typed hybrid metadata payload with aligned key order.
 */
export const extractHybridPgnMetadata = (
  pgnText: string,
  metadataKeys: readonly string[] = KNOWN_PGN_METADATA_KEYS,
): { metadata: HybridPgnMetadata; availableMetadataKeys: string[] } => {
  const { metadata: fromSource } = extractPgnMetadataFromSource(pgnText);
  const availableMetadataKeys: string[] = [];
  const metadata: HybridPgnMetadata = {};
  (Array.isArray(metadataKeys) ? metadataKeys : []).forEach((fieldKey: string): void => {
    const key: string = String(fieldKey || "").trim();
    if (!key) return;
    availableMetadataKeys.push(key);
    const rawValue: string = resolveRawHeaderValue(fromSource, key);
    const schemaEntry = PGN_METADATA_SCHEMA[key];
    if (schemaEntry) {
      const parsed = schemaEntry.parse(rawValue);
      metadata[key] = parsed;
      return;
    }
    metadata[key] = rawValue || undefined;
  });
  return { metadata, availableMetadataKeys };
};

/**
 * Extract all header occurrences for a given set of keys, returning each as a
 * string array in document order.
 *
 * Use this for user-defined fields with `cardinality: "many"`. For each key the
 * result is `string[]`; an absent key is represented as an empty array.
 *
 * Keys not present in `multiKeys` are not extracted. Single-valued PGN standard
 * fields (White, Event, …) should not be passed here — use `extractPgnMetadata`
 * for those.
 *
 * @param pgnText PGN source text.
 * @param multiKeys Keys to collect as arrays.
 * @returns Map of key → all header values in document order (may be empty array).
 */
export const extractMultiPgnMetadata = (
  pgnText: string,
  multiKeys: readonly string[],
): Record<string, string[]> => {
  if (!Array.isArray(multiKeys) || multiKeys.length === 0) return {};
  const all = parseMultiHeaderLines(pgnText);
  const result: Record<string, string[]> = {};
  for (const fieldKey of multiKeys) {
    const key = String(fieldKey || "").trim();
    if (!key) continue;
    result[key] = all[key] ?? [];
  }
  return result;
};
