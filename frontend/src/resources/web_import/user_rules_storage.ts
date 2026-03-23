/**
 * user_rules_storage — persist and retrieve user-defined web import rules.
 *
 * Integration API:
 * - `loadUserRules()` — returns rules from localStorage (empty array if absent).
 * - `saveUserRules(rules)` — persists rules to localStorage and fires the
 *   `x2chess:userRulesChanged` window event so `useWebImport` can rebuild.
 *
 * Configuration API:
 * - Storage key: `USER_RULES_KEY` constant below.
 *
 * Communication API:
 * - `saveUserRules` dispatches `CustomEvent("x2chess:userRulesChanged")` on
 *   `window` so any listener can refresh without prop drilling.
 */

import type { WebImportRule } from "./web_import_types";

const USER_RULES_KEY = "x2chess.webImport.userRules";

/**
 * Load user-defined web import rules from localStorage.
 * Returns an empty array on any parse failure or when absent.
 */
export const loadUserRules = (): WebImportRule[] => {
  try {
    const raw = localStorage.getItem(USER_RULES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WebImportRule[]) : [];
  } catch {
    return [];
  }
};

/**
 * Persist user-defined web import rules to localStorage.
 * Fires `x2chess:userRulesChanged` on `window` after saving.
 */
export const saveUserRules = (rules: WebImportRule[]): void => {
  try {
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent("x2chess:userRulesChanged"));
  } catch {
    // localStorage may be full or unavailable — ignore.
  }
};

/**
 * Validate that a plain object looks like a valid `WebImportRule`.
 * Returns an error message string or `null` if valid.
 */
export const validateRule = (obj: unknown): string | null => {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return "Rule must be a JSON object.";
  }
  const r = obj as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.trim() === "") {
    return "Rule must have a non-empty string `id`.";
  }
  if (typeof r.label !== "string" || r.label.trim() === "") {
    return "Rule must have a non-empty string `label`.";
  }
  if (typeof r.urlPattern !== "string" || r.urlPattern.trim() === "") {
    return "Rule must have a non-empty string `urlPattern`.";
  }
  const validStrategies = new Set(["api", "direct", "native-html", "webview"]);
  if (typeof r.strategy !== "string" || !validStrategies.has(r.strategy)) {
    return "Rule `strategy` must be one of: api, direct, native-html, webview.";
  }
  // Validate that urlPattern compiles.
  try {
    new RegExp(r.urlPattern as string);
  } catch {
    return "Rule `urlPattern` is not a valid regular expression.";
  }
  return null;
};
