/**
 * PGN metadata extraction utilities.
 *
 * Integration API:
 * - Primary exports: `PGN_STANDARD_METADATA_KEYS`, `extractPgnMetadata`.
 *
 * Configuration API:
 * - `extractPgnMetadata` accepts optional `metadataKeys` selection order.
 *
 * Communication API:
 * - Pure parsing utilities over PGN header text; no I/O.
 */
export const PGN_STANDARD_METADATA_KEYS = Object.freeze([
  "Event",
  "Site",
  "Round",
  "Date",
  "White",
  "Black",
  "Result",
  "ECO",
  "Opening",
  "WhiteElo",
  "BlackElo",
  "TimeControl",
  "Termination",
  "Annotator",
]);

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
 * Extract selected metadata fields from PGN headers.
 *
 * @param pgnText PGN source text.
 * @param metadataKeys Ordered field keys to project from headers.
 * @returns `metadata` map with string values plus `availableMetadataKeys` in display order.
 */
export const extractPgnMetadata = (
  pgnText: string,
  metadataKeys: readonly string[] = PGN_STANDARD_METADATA_KEYS,
): { metadata: Record<string, string>; availableMetadataKeys: string[] } => {
  const headers = parseHeaderLines(pgnText);
  const availableMetadataKeys: string[] = [];
  const metadata: Record<string, string> = {};
  (Array.isArray(metadataKeys) ? metadataKeys : []).forEach((fieldKey: string): void => {
    const key = String(fieldKey || "").trim();
    if (!key) return;
    availableMetadataKeys.push(key);
    metadata[key] = String(headers[key] || "").trim();
  });
  return { metadata, availableMetadataKeys };
};
