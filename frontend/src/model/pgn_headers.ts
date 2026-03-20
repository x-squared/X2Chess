/**
 * Pgn Headers module.
 *
 * Integration API:
 * - Primary exports from this module: `REQUIRED_PGN_TAG_DEFAULTS`, `X2_STYLE_HEADER_KEY`, `normalizeX2StyleValue`, `getHeaderValue`, `getX2StyleFromModel`, `setHeaderValue`, `ensureRequiredPgnHeaders`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through typed return values and callbacks; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

const cloneModel = (model: any): any => JSON.parse(JSON.stringify(model));

/**
 * Required Seven Tag Roster defaults used when missing in a PGN.
 */
export const REQUIRED_PGN_TAG_DEFAULTS = {
  Event: "?",
  Site: "?",
  Round: "?",
  Date: "??.??.????",
  White: "?",
  Black: "?",
  Result: "*",
};

/**
 * Custom tag: editor layout mode for this game (not standard PGN Seven Tag Roster).
 * Values: `plain` | `text` | `tree`. If the tag is missing, treat as `plain`.
 */
export const X2_STYLE_HEADER_KEY = "X2Style";

const X2_STYLE_VALUES = new Set(["plain", "text", "tree"]);

/**
 * Normalize a raw header value to a valid X2Style.
 *
 * @param {unknown} raw - Raw header string or unknown.
 * @returns {"plain"|"text"|"tree"} Normalized style; invalid/missing → `plain`.
 */
export const normalizeX2StyleValue = (raw: any): any => {
  const s = String(raw ?? "").trim().toLowerCase();
  return X2_STYLE_VALUES.has(s) ? /** @type {"plain"|"text"|"tree"} */ (s) : "plain";
};

/**
 * Read a PGN header value by key.
 *
 * @param {object} model - PGN model.
 * @param {string} key - PGN header key, for example `Event`.
 * @param {string} [fallback=""] - Value returned when key is missing.
 * @returns {string} Header value or fallback.
 */
export const getHeaderValue = (model: any, key: any, fallback: any = ""): any => {
  const header = model?.headers?.find((candidate: any): any => candidate?.key === key);
  return String(header?.value ?? fallback);
};

/**
 * Read X2Style from the PGN model headers.
 *
 * @param {object} model - PGN model.
 * @returns {"plain"|"text"|"tree"} Style; missing/invalid header → `plain`.
 */
export const getX2StyleFromModel = (model: any): any => {
  const raw = getHeaderValue(model, X2_STYLE_HEADER_KEY, "");
  return normalizeX2StyleValue(raw);
};

/**
 * Set (or remove) a PGN header value by key.
 *
 * - Existing headers keep their order.
 * - New non-empty values are appended to header list.
 * - Empty values remove the header.
 *
 * @param {object} model - PGN model to update.
 * @param {string} key - PGN header key, for example `White`.
 * @param {string} value - Target header value.
 * @returns {object} Updated PGN model clone.
 */
export const setHeaderValue = (model: any, key: any, value: any): any => {
  const next = cloneModel(model);
  const normalizedValue = String(value ?? "").trim();
  const existingIndex = Array.isArray(next.headers)
    ? next.headers.findIndex((header: any): any => header?.key === key)
    : -1;

  if (!Array.isArray(next.headers)) {
    next.headers = [];
  }

  if (!normalizedValue) {
    if (existingIndex >= 0) next.headers.splice(existingIndex, 1);
    return next;
  }

  if (existingIndex >= 0) {
    next.headers[existingIndex].value = normalizedValue;
    return next;
  }

  next.headers.push({ key, value: normalizedValue });
  return next;
};

/**
 * Ensure required PGN tags exist on the model.
 *
 * @param {object} model - PGN model to normalize.
 * @param {Record<string, string>} [requiredDefaults=REQUIRED_PGN_TAG_DEFAULTS] - Required key/default map.
 * @returns {object} Updated model with all required headers present.
 */
export const ensureRequiredPgnHeaders = (model: any, requiredDefaults: any = REQUIRED_PGN_TAG_DEFAULTS): any => {
  let next = cloneModel(model);
  Object.entries(requiredDefaults).forEach(([key, fallbackValue]: any): any => {
    const existing = getHeaderValue(next, key, "");
    if (existing.trim()) return;
    next = setHeaderValue(next, key, fallbackValue);
  });
  return next;
};
