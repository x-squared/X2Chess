/**
 * PGN metadata extraction helpers shared by source adapters.
 *
 * Integration API:
 * - Import `PGN_STANDARD_METADATA_KEYS` and `extractPgnMetadata(...)` from adapters
 *   that need normalized metadata payloads.
 *
 * Configuration API:
 * - `extractPgnMetadata` accepts raw PGN text and optional key list override.
 *
 * Communication API:
 * - Returns a plain `{ metadata, availableMetadataKeys }` object.
 * - No side effects or storage access.
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

const parseHeaderLines = (pgnText) => {
  const source = String(pgnText || "").replaceAll("\r\n", "\n");
  const headers = {};
  source.split("\n").forEach((line) => {
    const match = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
    if (!match) return;
    const key = String(match[1] || "").trim();
    if (!key || Object.hasOwn(headers, key)) return;
    headers[key] = String(match[2] || "").trim();
  });
  return headers;
};

export const extractPgnMetadata = (pgnText, metadataKeys = PGN_STANDARD_METADATA_KEYS) => {
  const headers = parseHeaderLines(pgnText);
  const availableMetadataKeys = [];
  const metadata = {};
  (Array.isArray(metadataKeys) ? metadataKeys : []).forEach((fieldKey) => {
    const key = String(fieldKey || "").trim();
    if (!key) return;
    availableMetadataKeys.push(key);
    metadata[key] = String(headers[key] || "").trim();
  });
  return { metadata, availableMetadataKeys };
};

