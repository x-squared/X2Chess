import {
  DEFAULT_RESOURCE_VIEWER_METADATA_KEYS,
  LEGACY_X2_STYLE_METADATA_KEY,
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
 * - Primary exports: `PGN_STANDARD_METADATA_KEYS`, `DEFAULT_RESOURCE_VIEWER_METADATA_KEYS`,
 *   `KNOWN_PGN_METADATA_KEYS`, `PGN_METADATA_SCHEMA`, `extractPgnMetadata`,
 *   `extractHybridPgnMetadata`, `extractMultiPgnMetadata`.
 *
 * Configuration API:
 * - Both single-value extractors accept optional `metadataKeys` projection order.
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
    return String(headers[LEGACY_X2_STYLE_METADATA_KEY] || "").trim();
  }
  return directValue;
};

/**
 * Parse bracket header lines from PGN text.
 * First occurrence wins for each key — used by single-value extractors.
 *
 * @param pgnText Raw PGN source text.
 * @returns Header map where first occurrence for each key wins.
 */
const parseHeaderLines = (pgnText: string): Record<string, string> => {
  const source = String(pgnText || "").replaceAll("\r\n", "\n");
  const headers: Record<string, string> = {};
  source.split("\n").forEach((line: string): void => {
    const match = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
    if (!match) return;
    const key = String(match[1] || "").trim();
    if (!key || Object.hasOwn(headers, key)) return;
    headers[key] = String(match[2] || "").trim();
  });
  return headers;
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
 * Extract selected metadata fields as plain-string map.
 *
 * @param pgnText PGN source text.
 * @param metadataKeys Ordered field keys to project from headers.
 * @returns `metadata` map with string values plus `availableMetadataKeys` in display order.
 */
export const extractPgnMetadata = (
  pgnText: string,
  metadataKeys: readonly string[] = PGN_STANDARD_METADATA_KEYS,
): { metadata: Record<string, string>; availableMetadataKeys: string[] } => {
  const headers: Record<string, string> = parseHeaderLines(pgnText);
  const availableMetadataKeys: string[] = [];
  const metadata: Record<string, string> = {};
  (Array.isArray(metadataKeys) ? metadataKeys : []).forEach((fieldKey: string): void => {
    const key: string = String(fieldKey || "").trim();
    if (!key) return;
    availableMetadataKeys.push(key);
    metadata[key] = resolveRawHeaderValue(headers, key);
  });
  return { metadata, availableMetadataKeys };
};

/**
 * Extract selected metadata fields using canonical typed schema when available.
 *
 * Hybrid strategy:
 * - Known keys are parsed into typed values (`Date`, ratings, `Result`, `XTwoChessStyle`, ...).
 * - Unknown keys are preserved as strings.
 *
 * @param pgnText PGN source text.
 * @param metadataKeys Ordered field keys to project from headers.
 * @returns Typed hybrid metadata payload with aligned key order.
 */
export const extractHybridPgnMetadata = (
  pgnText: string,
  metadataKeys: readonly string[] = KNOWN_PGN_METADATA_KEYS,
): { metadata: HybridPgnMetadata; availableMetadataKeys: string[] } => {
  const headers: Record<string, string> = parseHeaderLines(pgnText);
  const availableMetadataKeys: string[] = [];
  const metadata: HybridPgnMetadata = {};
  (Array.isArray(metadataKeys) ? metadataKeys : []).forEach((fieldKey: string): void => {
    const key: string = String(fieldKey || "").trim();
    if (!key) return;
    availableMetadataKeys.push(key);
    const rawValue: string = resolveRawHeaderValue(headers, key);
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
