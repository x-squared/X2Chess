/**
 * html_extractor — Apply a sequence of HTML extraction rules to a raw HTML string.
 *
 * All extraction is regex-based — no `DOMParser` or DOM globals — so this
 * module is usable in both browser and Node test environments, and handles
 * minified or malformed HTML more robustly than a DOM tree approach.
 *
 * Integration API:
 * - `extractFromHtml(html, rules)` — apply `HtmlExtractRule[]` in order; return
 *   the first successful match, or `null` if nothing matched.
 *
 * Configuration API:
 * - Rules are supplied by the calling `WebImportRule`; no module-level config.
 *
 * Communication API:
 * - Pure function; no I/O, no side effects.
 */

import type { HtmlExtractRule } from "./web_import_types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Escape special regex characters in a string literal so it can be used
 * verbatim inside a `new RegExp(...)` constructor.
 */
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Collect the text content of all `<script>` blocks in `html`.
 * Returns an array of raw script body strings (not decoded).
 */
const collectScriptBodies = (html: string): string[] => {
  const results: string[] = [];
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptPattern.exec(html)) !== null) {
    if (m[1]) results.push(m[1]);
  }
  return results;
};

// ── Extraction strategies ─────────────────────────────────────────────────────

/**
 * Extract an HTML attribute value from the first element where that attribute
 * appears.  The `selector` is used only for its attribute-name component
 * (the part inside `[...]`); complex CSS combinators are not supported.
 *
 * @param html - Full HTML response body.
 * @param selector - CSS selector; the attribute name is extracted from `[attr]` syntax.
 * @param attribute - Name of the attribute to extract.
 */
const extractCssAttr = (
  html: string,
  selector: string,
  attribute: string,
): string | null => {
  // Accept both quoted forms: attr="value" and attr='value'.
  const attrPattern = new RegExp(
    `${escapeRegex(attribute)}\\s*=\\s*["']([^"'\\n]{4,})["']`,
    "i",
  );
  const m = attrPattern.exec(html);
  return m ? m[1].trim() : null;
};

/**
 * Extract the text content of the first HTML element matching a very simple
 * tag selector (e.g. `span`, `div`, `td`).
 *
 * Only supports plain tag name selectors (no class, ID, or attribute filters).
 * The content is extracted up to the first child tag.
 *
 * @param html - Full HTML response body.
 * @param selector - Plain tag name, e.g. `"span"` or `"div"`.
 */
const extractCssText = (html: string, selector: string): string | null => {
  // Only support bare tag names for the regex approach.
  const tagName: string = /^[a-zA-Z][a-zA-Z0-9]*$/.test(selector.trim())
    ? selector.trim()
    : "";
  if (!tagName) return null;
  const pattern = new RegExp(`<${tagName}[^>]*>([^<]{4,})</${tagName}>`, "i");
  const m = pattern.exec(html);
  return m ? m[1].trim() : null;
};

/**
 * Search every `<script>` block in `html` for a regex pattern.
 * Returns the first capture group of the first match found.
 *
 * @param html - Full HTML response body.
 * @param pattern - Regex pattern string with exactly one capture group.
 */
const extractScriptRegex = (html: string, pattern: string): string | null => {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return null;
  }
  for (const body of collectScriptBodies(html)) {
    const m = regex.exec(body);
    if (m?.[1]) return m[1].trim();
  }
  return null;
};

/**
 * Extract the `content` attribute of a `<meta name="...">` tag.
 *
 * @param html - Full HTML response body.
 * @param name - Value of the `name` attribute to look for.
 */
const extractMeta = (html: string, name: string): string | null => {
  // Handle both attribute orderings: name first, content first.
  const patternA = new RegExp(
    `<meta[^>]+name\\s*=\\s*["']${escapeRegex(name)}["'][^>]+content\\s*=\\s*["']([^"'\\n]{4,})["']`,
    "i",
  );
  const patternB = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"'\\n]{4,})["'][^>]+name\\s*=\\s*["']${escapeRegex(name)}["']`,
    "i",
  );
  const mA = patternA.exec(html);
  if (mA) return mA[1].trim();
  const mB = patternB.exec(html);
  return mB ? mB[1].trim() : null;
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Apply an ordered list of `HtmlExtractRule` entries to raw HTML text.
 *
 * Rules are tried in array order; the first non-null result is returned.
 * Returns `null` if no rule produces a match.
 *
 * @param html - Raw HTML response body string.
 * @param rules - Ordered array of extraction rules from the `WebImportRule`.
 */
export const extractFromHtml = (
  html: string,
  rules: HtmlExtractRule[],
): string | null => {
  for (const rule of rules) {
    let result: string | null = null;

    if (rule.type === "css-attr") {
      result = extractCssAttr(html, rule.selector, rule.attribute);
    } else if (rule.type === "css-text") {
      result = extractCssText(html, rule.selector);
    } else if (rule.type === "script-regex") {
      result = extractScriptRegex(html, rule.pattern);
    } else if (rule.type === "meta") {
      result = extractMeta(html, rule.name);
    }

    if (result !== null && result.length > 0) return result;
  }
  return null;
};
