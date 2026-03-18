/**
 * App build-info helpers.
 *
 * Integration API:
 * - `resolveBuildTimestampLabel(rawTimestamp)`
 *
 * Configuration API:
 * - Accepts raw build timestamp string (usually injected by bundler define).
 *
 * Communication API:
 * - Pure formatting helper, no side effects.
 */

/**
 * Convert raw build timestamp to user-facing label.
 *
 * @param {string} rawTimestamp - Raw timestamp string.
 * @returns {string} Human-readable label or fallback "unknown".
 */
export const resolveBuildTimestampLabel = (rawTimestamp) => {
  const normalized = String(rawTimestamp || "");
  if (!normalized) return "unknown";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleString();
};
