/**
 * rule_matcher — Pure URL detection and rule matching for the web import system.
 *
 * Integration API:
 * - `isUrl(value)` — call before the PGN text check in ingress handlers.
 * - `matchRule(url, rules)` — find the first rule whose `urlPattern` matches the URL.
 * - `expandTemplate(template, captures)` — substitute `$1`, `$2`, … into a URL template.
 *
 * Configuration API:
 * - No configuration; all inputs are explicit parameters.
 *
 * Communication API:
 * - Pure functions; no I/O, no side effects.
 */

import type { WebImportRule, RuleMatch } from "./web_import_types";

/**
 * Returns `true` if `value` looks like an HTTP or HTTPS URL.
 *
 * Intentionally permissive — the rule matcher will reject unrecognised hosts.
 * Used as a fast pre-check in ingress handlers before invoking the full matcher.
 *
 * @param value - Arbitrary string to test.
 */
export const isUrl = (value: string): boolean =>
  /^https?:\/\/\S+/i.test(value.trim());

/**
 * Find the first rule in `rules` whose `urlPattern` matches `url`.
 *
 * Patterns are compiled from the rule's `urlPattern` string (standard JS regex).
 * Invalid patterns are silently skipped so a bad user rule cannot break all matching.
 *
 * @param url - The full URL string to match against.
 * @param rules - Ordered array of rules to test; first match wins.
 * @returns The matched rule and its capture groups, or `null` if no rule matches.
 */
export const matchRule = (url: string, rules: WebImportRule[]): RuleMatch | null => {
  for (const rule of rules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.urlPattern);
    } catch {
      // Invalid pattern — skip this rule.
      continue;
    }
    const m: RegExpExecArray | null = regex.exec(url);
    if (m) {
      return { rule, captures: Array.from(m) };
    }
  }
  return null;
};

/**
 * Substitute regex capture groups into a URL template string.
 *
 * `$1` is replaced by `captures[1]`, `$2` by `captures[2]`, etc.
 * `$0` (full match) is not substituted to avoid accidental misuse.
 * Missing capture groups are replaced with an empty string.
 *
 * @param template - URL template string, e.g. `"https://lichess.org/game/export/$1"`.
 * @param captures - Capture group array from a `RegExp.exec()` call (index 0 = full match).
 * @returns Expanded URL string with all `$N` placeholders replaced.
 */
export const expandTemplate = (template: string, captures: string[]): string =>
  template.replace(/\$([1-9][0-9]*)/g, (_match: string, indexStr: string): string => {
    const index: number = Number(indexStr);
    return captures[index] ?? "";
  });
