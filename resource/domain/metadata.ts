import {
  DEFAULT_RESOURCE_VIEWER_METADATA_KEYS,
  KNOWN_PGN_METADATA_KEYS,
  METADATA_KEY,
  PGN_METADATA_SCHEMA,
  PGN_STANDARD_METADATA_KEYS,
  type HybridPgnMetadata,
} from "./metadata_schema";

/**
 * PGN metadata extraction utilities.
 *
 * Integration API:
 * - Primary exports: `PGN_STANDARD_METADATA_KEYS`, `DEFAULT_RESOURCE_VIEWER_METADATA_KEYS`,
 *   `KNOWN_PGN_METADATA_KEYS`, `PGN_METADATA_SCHEMA`, `extractPgnMetadata`, `extractHybridPgnMetadata`.
 *
 * Configuration API:
 * - Both extractors accept optional `metadataKeys` projection order.
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

/**
 * Parse bracket header lines from PGN text.
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
    metadata[key] = String(headers[key] || "").trim();
  });
  return { metadata, availableMetadataKeys };
};

/**
 * Extract selected metadata fields using canonical typed schema when available.
 *
 * Hybrid strategy:
 * - Known keys are parsed into typed values (`Date`, ratings, `Result`, `X2Style`, ...).
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
    const rawValue: string = String(headers[key] || "").trim();
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
