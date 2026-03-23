/**
 * rule_registry — Merge built-in and user-defined web import rules.
 *
 * Integration API:
 * - `buildRegistry(userRules)` — returns the merged ordered rule list.
 *   Call this once on startup (or when user rules change) and pass the result
 *   to `matchRule`.
 *
 * Configuration API:
 * - `userRules` — rules loaded from `config/web-import-rules.json` (user-editable).
 *   Pass an empty array if the file does not exist.
 *
 * Communication API:
 * - Pure function; no I/O, no side effects.
 *
 * Precedence (highest → lowest):
 *   1. User rules — override any built-in rule with the same `id`.
 *   2. Built-in rules — shipped with the app.
 */

import { BUILT_IN_RULES } from "./built_in_rules";
import type { WebImportRule } from "./web_import_types";

/**
 * Build the active rule registry by merging user rules over built-in rules.
 *
 * User rules appear first and take precedence when two rules share the same `id`.
 * Within each group, original array order is preserved.
 *
 * @param userRules - Rules from the user-editable config file. Pass `[]` if absent.
 * @returns Ordered array of active `WebImportRule` objects (user rules first, then built-ins).
 */
export const buildRegistry = (userRules: WebImportRule[]): WebImportRule[] => {
  // User rule IDs that shadow built-in rules.
  const userIds = new Set<string>(userRules.map((r: WebImportRule): string => r.id));

  // Built-in rules not overridden by a user rule.
  const filteredBuiltIns: WebImportRule[] = BUILT_IN_RULES.filter(
    (r: WebImportRule): boolean => !userIds.has(r.id),
  );

  return [...userRules, ...filteredBuiltIns];
};
