/**
 * rule_fetcher — Fetch and extract chess data from a matched web import rule.
 *
 * Implements:
 * - Tier 1 (`strategy: "api"` / `"direct"`) — browser `fetch()`.
 * - Tier 2 (`strategy: "native-html"`) — Tauri `native_http_get` command +
 *   regex-based HTML extraction.  Requires an optional `NativeHttpGateway`.
 *
 * Tier 3 (`strategy: "webview"`) is recognised but returns `null`.
 *
 * Integration API:
 * - `fetchFromRule(rule, captures, nativeHttp?)` — execute a matched rule and
 *   return the result.  Pass a `NativeHttpGateway` to enable Tier 2.
 *
 * Configuration API:
 * - `nativeHttp` — optional gateway; when absent, `strategy: "native-html"` rules
 *   return `null` instead of attempting a native request.
 *
 * Communication API:
 * - Makes outbound `fetch()` requests (Tier 1) or delegates to `nativeHttp` (Tier 2).
 * - Returns `null` on network error, unexpected response shape, or unsupported strategy.
 */

import { expandTemplate } from "./rule_matcher";
import { extractFromHtml } from "./html_extractor";
import type { WebImportRule, WebImportResult } from "./web_import_types";

// ── Native HTTP gateway interface ─────────────────────────────────────────────

/**
 * Abstraction over the Tauri `native_http_get` command.
 *
 * Inject a real implementation (via `buildNativeHttpGateway`) in the Tauri
 * desktop runtime; omit or pass `undefined` in browser / test contexts.
 */
export type NativeHttpGateway = {
  /**
   * Perform an HTTP GET from the OS network stack.
   *
   * @param url - Target URL.
   * @param headers - Request headers (e.g. User-Agent).
   * @returns Response body as a UTF-8 string.
   * @throws If the request fails or returns a non-2xx status.
   */
  get(url: string, headers: Record<string, string>): Promise<string>;
};

// ── Dot-path extraction ───────────────────────────────────────────────────────

/**
 * Extract a value from a plain JSON object using a dot-separated path.
 *
 * Handles nested paths like `"game.pgn"` or `"data.fen"`.
 * Returns `null` if any segment along the path is absent.
 *
 * @param obj - The parsed JSON value (must be a plain object at top level).
 * @param path - Dot-separated field path, e.g. `"game.pgn"`.
 */
const getByDotPath = (obj: unknown, path: string): string | null => {
  const segments: string[] = path.split(".");
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : null;
};

// ── JSON response handling ────────────────────────────────────────────────────

/**
 * Extract a `WebImportResult` from a parsed JSON response body.
 *
 * @param json - Parsed JSON value from the API response.
 * @param rule - The matched import rule (used for `responseType` and `fieldPaths`).
 * @returns `WebImportResult` or `null` if the expected field is absent or empty.
 */
const extractFromJson = (json: unknown, rule: WebImportRule): WebImportResult | null => {
  const fenPath: string = rule.fieldPaths?.fen ?? "fen";
  const pgnPath: string = rule.fieldPaths?.pgn ?? "pgn";
  const titlePath: string = rule.fieldPaths?.title ?? "title";
  const title: string | undefined = getByDotPath(json, titlePath) ?? undefined;

  if (rule.responseType === "json.pgn") {
    const pgn: string | null = getByDotPath(json, pgnPath);
    if (!pgn) return null;
    return { kind: "pgn", value: pgn, title };
  }

  if (rule.responseType === "json.fen") {
    const fen: string | null = getByDotPath(json, fenPath);
    if (!fen) return null;
    return { kind: "fen", value: fen, title };
  }

  if (rule.responseType === "json.fen+pgn") {
    const pgn: string | null = getByDotPath(json, pgnPath);
    if (pgn) return { kind: "pgn", value: pgn, title };
    const fen: string | null = getByDotPath(json, fenPath);
    if (fen) return { kind: "fen", value: fen, title };
    return null;
  }

  return null;
};

// ── Main fetch function ───────────────────────────────────────────────────────

/**
 * Execute a matched web import rule and return the extracted chess data.
 *
 * Tier 1 (`"api"`, `"direct"`) — uses browser `fetch()`.
 * Tier 2 (`"native-html"`) — uses `nativeHttp.get()` when provided; returns `null`
 *   if no gateway is supplied (e.g. running in a browser without Tauri).
 * Tier 3 (`"webview"`) — not yet implemented; always returns `null`.
 *
 * @param rule - The matched `WebImportRule`.
 * @param captures - Regex capture groups from `matchRule` (index 0 = full match, 1 = `$1`, …).
 * @param nativeHttp - Optional Tauri native HTTP gateway; required for Tier 2 rules.
 * @returns Resolved `WebImportResult`, or `null` on network error, parse error, or missing data.
 */
export const fetchFromRule = async (
  rule: WebImportRule,
  captures: string[],
  nativeHttp?: NativeHttpGateway,
): Promise<WebImportResult | null> => {
  if (rule.strategy === "webview") return null;

  const fetchUrl: string | null = rule.fetchUrl
    ? expandTemplate(rule.fetchUrl, captures)
    : null;

  if (!fetchUrl) return null;

  // ── Tier 2: Tauri native HTTP + HTML extraction ───────────────────────────
  if (rule.strategy === "native-html") {
    if (!nativeHttp) return null;
    try {
      const html: string = await nativeHttp.get(fetchUrl, rule.requestHeaders ?? {});
      if (!rule.htmlExtract?.length) return null;
      const extracted: string | null = extractFromHtml(html, rule.htmlExtract);
      if (!extracted) return null;
      return { kind: "fen", value: extracted };
    } catch {
      return null;
    }
  }

  // ── Tier 1: browser fetch ─────────────────────────────────────────────────
  try {
    const response: Response = await fetch(fetchUrl, {
      headers: rule.requestHeaders ?? {},
    });

    if (!response.ok) return null;

    // Raw PGN body.
    if (rule.strategy === "direct" || rule.responseType === "pgn") {
      const text: string = await response.text();
      return text.trim() ? { kind: "pgn", value: text.trim() } : null;
    }

    // JSON body.
    const json: unknown = await response.json();
    return extractFromJson(json, rule);
  } catch {
    return null;
  }
};
