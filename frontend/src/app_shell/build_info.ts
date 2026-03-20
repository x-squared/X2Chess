/**
 * App build-info helpers.
 *
 * Integration API:
 * - Import `resolveBuildTimestampLabel(rawTimestamp)` when rendering build info
 *   in UI labels or diagnostics.
 *
 * Configuration API:
 * - Input is the raw build timestamp string (typically injected by Vite define).
 * - If input is empty, return value is `"unknown"`.
 *
 * Communication API:
 * - Pure function only: no state updates, no DOM access, no I/O.
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
