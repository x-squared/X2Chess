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
import { createVersionedStore } from "../../storage";

const USER_RULES_KEY = "x2chess.webImport.userRules";

const userRulesStore = createVersionedStore<WebImportRule[]>({
  key: USER_RULES_KEY,
  version: 1,
  defaultValue: [],
  migrations: [
    // v0→v1: raw payload was already a plain array — pass through.
    (raw) => (Array.isArray(raw) ? raw : []),
  ],
});

/**
 * Load user-defined web import rules from localStorage.
 * Returns an empty array on any parse failure or when absent.
 */
export const loadUserRules = (): WebImportRule[] => userRulesStore.read();

/**
 * Persist user-defined web import rules to localStorage.
 * Fires `x2chess:userRulesChanged` on `window` after saving.
 */
export const saveUserRules = (rules: WebImportRule[]): void => {
  userRulesStore.write(rules);
  globalThis.dispatchEvent(new CustomEvent("x2chess:userRulesChanged"));
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
    new RegExp(r.urlPattern);
  } catch {
    return "Rule `urlPattern` is not a valid regular expression.";
  }
  return null;
};
