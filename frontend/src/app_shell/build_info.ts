/**
 * Build Info module.
 *
 * Integration API:
 * - Primary exports from this module: `resolveBuildTimestampLabel`.
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
 * Convert raw build timestamp to user-facing label.
 *
 * @param {string} rawTimestamp - Raw timestamp string.
 * @returns {string} Human-readable label or fallback "unknown".
 */
export const resolveBuildTimestampLabel = (rawTimestamp: string): string => {
  const normalized = String(rawTimestamp || "");
  if (!normalized) return "unknown";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleString();
};
