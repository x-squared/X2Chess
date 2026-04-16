/**
 * session_helpers — pure utility functions shared across session service modules.
 *
 * Integration API:
 * - Import individual helpers into service modules that need them.
 *
 * Configuration API:
 * - No configuration; purely stateless pure functions.
 *
 * Communication API:
 * - No side effects; all functions are pure.
 */

// ── String normalization ──────────────────────────────────────────────────────

/** Return the last non-empty path segment of a locator string, or a fallback. */
export const lastLocatorSegment = (locator: string | null | undefined, fallback: string): string => {
  const segments: string[] = (locator ?? "").split("/");
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (segments[i]) return segments[i];
  }
  return fallback;
};

export const normalizeOptionalRecordId = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed: string = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const normalizeStringish = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

/**
 * Coerce an `unknown` value to a string with an explicit fallback.
 * Strings are trimmed; finite numbers are stringified; everything else
 * returns `fallback`. Use this instead of `String(unknownValue ?? fallback)`
 * to avoid `[object Object]` for non-primitive values.
 */
export const normalizeStringField = (value: unknown, fallback: string): string => {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const normalizeLocator = (locator: unknown): string =>
  normalizeStringish(locator).replace(/\/+$/, "");

export const buildSourceIdentityKey = (
  value: { kind?: unknown; locator?: unknown; recordId?: unknown } | null | undefined,
): string => {
  const kind: string = normalizeStringish(value?.kind);
  const locator: string = normalizeLocator(value?.locator);
  const recordId: string = normalizeOptionalRecordId(value?.recordId) ?? "";
  if (!kind || !locator) return "";
  return `${kind}|${locator}|${recordId}`;
};

// ── PGN header validation ─────────────────────────────────────────────────────

export const isPlaceholderHeaderValue = (key: string, value: string): boolean => {
  const trimmed: string = value.trim();
  if (key === "White" || key === "Black" || key === "Event") {
    return trimmed === "" || trimmed === "?";
  }
  if (key === "Date") {
    return trimmed === "" || trimmed === "??.??.????" || trimmed === "????.??.??";
  }
  return false;
};
