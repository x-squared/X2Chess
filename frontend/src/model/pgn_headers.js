/**
 * PGN header command helpers.
 *
 * Intent:
 * - Provide immutable helpers for reading and updating PGN tag-pair headers.
 *
 * Integration API:
 * - `getHeaderValue(model, key, fallback?)`
 * - `setHeaderValue(model, key, value)`
 *
 * Configuration API:
 * - Callers choose header keys and fallback values explicitly.
 *
 * Communication API:
 * - Returns primitive values for reads and a cloned model for writes.
 */

const cloneModel = (model) => JSON.parse(JSON.stringify(model));

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
 * Read a PGN header value by key.
 *
 * @param {object} model - PGN model.
 * @param {string} key - PGN header key, for example `Event`.
 * @param {string} [fallback=""] - Value returned when key is missing.
 * @returns {string} Header value or fallback.
 */
export const getHeaderValue = (model, key, fallback = "") => {
  const header = model?.headers?.find((candidate) => candidate?.key === key);
  return String(header?.value ?? fallback);
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
export const setHeaderValue = (model, key, value) => {
  const next = cloneModel(model);
  const normalizedValue = String(value ?? "").trim();
  const existingIndex = Array.isArray(next.headers)
    ? next.headers.findIndex((header) => header?.key === key)
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
export const ensureRequiredPgnHeaders = (model, requiredDefaults = REQUIRED_PGN_TAG_DEFAULTS) => {
  let next = cloneModel(model);
  Object.entries(requiredDefaults).forEach(([key, fallbackValue]) => {
    const existing = getHeaderValue(next, key, "");
    if (existing.trim()) return;
    next = setHeaderValue(next, key, fallbackValue);
  });
  return next;
};
