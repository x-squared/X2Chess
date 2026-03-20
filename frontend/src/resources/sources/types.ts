/**
 * Source adapter domain types.
 *
 * Integration API:
 * - Import `SOURCE_KIND` for kind-safe comparisons (`file`, `sqlite`, ...).
 * - Use `isSourceRef(value)` when validating external/untyped source objects.
 *
 * Configuration API:
 * - Source references are plain serializable objects with at least:
 *   - `kind` (adapter key)
 *   - `locator` (resource/container identifier)
 *   - optional `recordId` (entry identifier inside resource)
 *
 * Communication API:
 * - Shared by gateway/registry/session modules as lightweight runtime guards.
 * - No side effects; constants + validation helpers only.
 */

/**
 * Supported game source kinds.
 */
export const SOURCE_KIND = Object.freeze({
  FILE: "file",
  PGN_DB: "pgn-db",
  SQLITE: "sqlite",
});

/**
 * Default metadata keys supported by PGN-oriented resources.
 */
export const DEFAULT_PGN_METADATA_KEYS = Object.freeze([
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
 * Validate metadata entry shape returned by a source adapter list record.
 *
 * @param {unknown} value - Candidate metadata object.
 * @returns {boolean} True when metadata is a plain object.
 */
export const isMetadataMap = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Validate source reference shape.
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is a valid source reference.
 */
export const isSourceRef = (value) => {
  if (!value || typeof value !== "object") return false;
  const source = /** @type {{kind?: unknown, locator?: unknown}} */ (value);
  return (
    typeof source.kind === "string"
    && typeof source.locator === "string"
    && source.kind.length > 0
    && source.locator.length > 0
  );
};

