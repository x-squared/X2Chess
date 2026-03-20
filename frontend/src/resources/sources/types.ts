import { DEFAULT_RESOURCE_VIEWER_METADATA_KEYS, PGN_STANDARD_METADATA_KEYS } from "../../../../resource/domain/metadata";

/**
 * Types module.
 *
 * Integration API:
 * - Primary exports from this module: `SOURCE_KIND`, `DEFAULT_PGN_METADATA_KEYS`, `isMetadataMap`, `isSourceRef`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through typed return values and callbacks; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

/**
 * Supported game source kinds.
 */
export const SOURCE_KIND = Object.freeze({
  DIRECTORY: "directory",
  FILE: "file",
  DB: "db",
});

/**
 * Default metadata keys supported by PGN-oriented resources.
 */
export const DEFAULT_PGN_METADATA_KEYS = PGN_STANDARD_METADATA_KEYS;

/**
 * Default metadata columns shown in resource viewer UIs.
 */
export const DEFAULT_RESOURCE_VIEWER_KEYS = DEFAULT_RESOURCE_VIEWER_METADATA_KEYS;

/**
 * Validate metadata entry shape returned by a source adapter list record.
 *
 * @param {unknown} value - Candidate metadata object.
 * @returns {boolean} True when metadata is a plain object.
 */
export const isMetadataMap = (value: any): any => Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Validate source reference shape.
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is a valid source reference.
 */
export const isSourceRef = (value: any): any => {
  if (!value || typeof value !== "object") return false;
  const source = /** @type {{kind?: unknown, locator?: unknown}} */ (value);
  return (
    typeof source.kind === "string"
    && typeof source.locator === "string"
    && source.kind.length > 0
    && source.locator.length > 0
  );
};

