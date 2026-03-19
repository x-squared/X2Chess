/**
 * Source adapter domain types.
 *
 * Integration API:
 * - `SOURCE_KIND`
 * - `isSourceRef(value)`
 *
 * Configuration API:
 * - Source refs are plain serializable objects.
 *
 * Communication API:
 * - Used by source registry and game session services.
 */

/**
 * Supported game source kinds.
 */
export const SOURCE_KIND = Object.freeze({
  FILE: "file",
  SQLITE: "sqlite",
});

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

